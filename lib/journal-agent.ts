import { randomBytes } from "node:crypto";
import { createCalendarEvent } from "@/lib/calendar";
import { getDb } from "@/lib/db";
import type { EntryStatus, JournalEntry, Signifier, TaskLane, TaskPriority } from "@/types/journal";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.JOURNAL_COMMAND_MODEL || "qwen2.5-coder:7b";

export interface JournalAgentContext {
  currentDate?: string;
  currentPage?: string;
  sessionId?: string;
  recentConversation?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

export interface JournalAgentRequest {
  command: string;
  context?: JournalAgentContext;
}

export interface JournalAgentAction {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  parent_ref?: number;
}

interface JournalAgentPlan {
  actions: JournalAgentAction[];
  message: string;
}

const CANONICAL_SIGNIFIERS = new Set([
  "task",
  "appointment",
  "note",
  "memory",
  "important",
]);

function normalizeSignifier(value: unknown): Signifier | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  const symbolMap: Record<string, Signifier> = {
    "•": "task",
    "-": "note",
    "—": "note",
    "○": "appointment",
    "~": "memory",
    "*": "important",
    "!": "important",
  };
  const mapped = symbolMap[raw] || raw;
  return CANONICAL_SIGNIFIERS.has(mapped) ? (mapped as Signifier) : null;
}

interface ActionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface JournalAgentExecutionResult {
  ok: boolean;
  message: string;
  actions: Array<{ method: string; path: string; success: boolean }>;
  createdEntries: JournalEntry[];
  updatedEntries: JournalEntry[];
}

const SYSTEM_PROMPT = `You are Gutter's internal capture agent. Convert natural language into structured local API actions.

## Core behavior
- You have full local Gutter powers to create, edit, complete, migrate, and schedule journal items.
- Prefer executing the user's intent, not merely extracting text.
- When the user refers to prior conversation with words like "these", "that", "them", or "it", use the provided recent conversation context to resolve what they mean.
- For conversational capture transcripts, infer the concrete actions the user wants. Do not create a fake task for meta-phrases like "add these to my calendar".
- If the user asks to complete or mark something done, prefer PATCH /api/journal/:id with status: "done" after finding the right entry.
- If the user asks to update or reschedule something, PATCH the existing entry when possible rather than creating a duplicate.

## Data model
Signifiers: task, appointment, note, memory, important
Statuses: open, in-progress, blocked, done, migrated, killed
Dates: YYYY-MM-DD format. Months: YYYY-MM format.
Lanes: work, personal, family, jw, petalz
Priorities: low, normal, high

## API endpoints
- POST /api/journal — Create entry: { date, signifier, text, tags?, parent_id?, lane?, priority?, waiting_on? }
- PATCH /api/journal/:id — Update: { status?, text?, signifier?, collection_id?, parent_id?, lane?, priority?, waiting_on?, date? }
- DELETE /api/journal/:id — Soft delete
- POST /api/journal/migrate — Migrate: { entryIds: string[], targetDate: string }
- GET /api/journal/unresolved?month=YYYY-MM
- GET /api/journal?date=YYYY-MM-DD
- POST /api/collections — Create: { title, icon? }
- GET /api/collections
- POST /api/future-log — Create: { target_month: "YYYY-MM", signifier, text }
- POST /api/journal/calendar — Create calendar event: { summary, date: "YYYY-MM-DD", startTime?: "HH:mm", endTime?: "HH:mm", allDay?: boolean, calendar?: "work"|"home"|"family"|"jw"|"school", location?, description? }

## Search helper
If you need an existing entry id, first use GET /api/journal?date=YYYY-MM-DD or GET /api/journal/unresolved?month=YYYY-MM to find it, then PATCH/DELETE using the returned id. Match by meaning, not exact phrasing only.

## Calendar rules
When the user schedules or adds a time-bound event:
1. Create or update a journal entry with signifier "appointment"
2. Also create a calendar event via POST /api/journal/calendar unless the request is explicitly journal-only
Do both in the same response. Default calendar is "home" unless context suggests work, family, jw, or school.
Times must be 24-hour format. If no end time is given, omit it.

## Subtasks
Tasks can have subtasks. Use parent_ref to reference a prior created action.

## Detection rules
- Action verbs usually mean task
- Time-bound events usually mean appointment
- Info statements usually mean note
- Highlights or cherished memories usually mean memory
- Urgent markers can use important or high priority

## Output rules
- Return ONLY valid JSON
- Resolve relative dates from currentDate
- Use recent conversation context when provided
- message should be a short human-readable confirmation
- If you are not confident, return no actions with a brief clarification message
`;

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export function getConversationHistory(sessionId: string, limit = 10) {
  const db = getDb();

  try {
    const rows = db.prepare(`
      SELECT role, content FROM conversation_history
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(sessionId, limit) as Array<{ role: string; content: string }>;

    return rows.reverse().map((row) => ({
      role: row.role as "system" | "user" | "assistant",
      content: row.content,
    }));
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    return [];
  }
}

export function saveConversationMessage(sessionId: string, date: string, role: string, content: string) {
  const db = getDb();

  try {
    db.prepare(`
      INSERT INTO conversation_history (id, date, session_id, role, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(uniqueId("ch"), date, sessionId, role, content);
  } catch (error) {
    console.error("Error saving conversation message:", error);
  }
}

function buildUserPrompt(command: string, context?: JournalAgentContext): string {
  const date = context?.currentDate || new Date().toISOString().split("T")[0];
  const page = context?.currentPage || "daily";
  const d = new Date(`${date}T12:00:00`);
  const yesterday = new Date(d);
  yesterday.setDate(d.getDate() - 1);
  const tomorrow = new Date(d);
  tomorrow.setDate(d.getDate() + 1);
  const conversation = (context?.recentConversation || [])
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");

  return `Current date: ${date} (yesterday: ${yesterday.toISOString().split("T")[0]}, tomorrow: ${tomorrow.toISOString().split("T")[0]})
Current page: ${page}
Current month: ${date.substring(0, 7)}
Session ID: ${context?.sessionId || "none"}
Recent conversation context:
${conversation || "(none)"}

Command: ${command}`;
}

async function planJournalActions(command: string, context?: JournalAgentContext): Promise<JournalAgentPlan> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(command, context) },
      ],
      stream: false,
      format: "json",
      options: {
        temperature: 0.1,
        num_predict: 768,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.message?.content?.trim();

  if (!content) {
    throw new Error("Empty response from Ollama");
  }

  const parsed = JSON.parse(content);
  return {
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    message: parsed.message || "Done.",
  };
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRowToEntry(row: any): JournalEntry {
  return {
    ...row,
    tags: normalizeTags(row.tags),
  } as JournalEntry;
}

function fetchEntryById(id: string): JournalEntry | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
  return row ? mapRowToEntry(row) : null;
}

async function executeMutationLocally(action: JournalAgentAction): Promise<ActionResult> {
  try {
    const db = getDb();

    if (action.method === "POST" && action.path === "/api/journal" && action.body) {
      const { date, signifier, text, tags = [], parent_id, lane, priority, waiting_on } = action.body as any;
      if (!date || !signifier || !text) {
        return { ok: false, error: "Missing required fields: date, signifier, text" };
      }

      const normalizedSignifier = normalizeSignifier(signifier);
      if (!normalizedSignifier) {
        return { ok: false, error: `Invalid signifier: ${String(signifier)}` };
      }

      const maxOrder = parent_id
        ? db.prepare("SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ? AND parent_id = ?").get(date as string, parent_id) as { max: number | null }
        : db.prepare("SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ? AND parent_id IS NULL").get(date as string) as { max: number | null };

      const id = uniqueId("je");
      const now = new Date().toISOString();
      const sortOrder = (maxOrder?.max ?? -1) + 1;

      db.prepare(`
        INSERT INTO journal_entries (id, date, signifier, text, status, tags, sort_order, parent_id, lane, priority, waiting_on, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        date,
        normalizedSignifier,
        text,
        JSON.stringify(tags),
        sortOrder,
        parent_id || null,
        lane || null,
        priority || null,
        waiting_on || null,
        now,
        now,
      );

      return { ok: true, data: fetchEntryById(id) };
    }

    if (action.method === "PATCH" && action.path.startsWith("/api/journal/")) {
      const id = action.path.split("/").pop();
      if (!id || !action.body) return { ok: false, error: "Missing id or body" };

      const updates: string[] = ["updated_at = ?"];
      const values: Array<string | null> = [new Date().toISOString()];
      const body = action.body as Record<string, unknown>;

      if (body.signifier !== undefined) {
        const normalizedSignifier = normalizeSignifier(body.signifier);
        if (!normalizedSignifier) {
          return { ok: false, error: `Invalid signifier: ${String(body.signifier)}` };
        }
        body.signifier = normalizedSignifier;
      }

      for (const field of ["status", "text", "signifier", "collection_id", "parent_id", "lane", "priority", "waiting_on", "date"]) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push((body[field] as string | null) ?? null);
        }
      }

      values.push(id);
      const result = db.prepare(`UPDATE journal_entries SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      return result.changes > 0
        ? { ok: true, data: fetchEntryById(id) }
        : { ok: false, error: `Entry not found: ${id}` };
    }

    if (action.method === "DELETE" && action.path.startsWith("/api/journal/")) {
      const id = action.path.split("/").pop();
      if (!id) return { ok: false, error: "Missing id" };
      const result = db.prepare("UPDATE journal_entries SET status = 'killed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
      return result.changes > 0 ? { ok: true, data: { id, killed: true } } : { ok: false, error: `Entry not found: ${id}` };
    }

    if (action.method === "POST" && action.path.includes("/migrate") && action.body) {
      const { entryIds, targetDate } = action.body as any;
      if (!entryIds?.length || !targetDate) return { ok: false, error: "Missing entryIds or targetDate" };
      const now = new Date().toISOString();
      for (const entryId of entryIds) {
        const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(entryId) as any;
        if (!entry) continue;
        const maxOrder = db.prepare("SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ?").get(targetDate) as { max: number | null };
        const newId = uniqueId("je");
        db.prepare(`
          INSERT INTO journal_entries (id, date, signifier, text, status, migrated_from, tags, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
        `).run(newId, targetDate, entry.signifier, entry.text, entryId, entry.tags || "[]", (maxOrder?.max ?? -1) + 1, now, now);
        db.prepare("UPDATE journal_entries SET status = 'migrated', migrated_to = ?, updated_at = ? WHERE id = ?").run(newId, now, entryId);
      }
      return { ok: true, data: { migrated: entryIds.length } };
    }

    if (action.method === "POST" && action.path === "/api/collections" && action.body) {
      const { title, icon } = action.body as any;
      if (!title) return { ok: false, error: "Missing title" };
      const id = uniqueId("col");
      getDb().prepare("INSERT INTO collections (id, title, icon) VALUES (?, ?, ?)").run(id, title, icon || null);
      return { ok: true, data: { id, title, icon } };
    }

    if (action.method === "POST" && action.path.includes("/future-log") && action.body) {
      const { target_month, signifier, text } = action.body as any;
      if (!target_month || !signifier || !text) return { ok: false, error: "Missing fields" };
      const id = uniqueId("fl");
      getDb().prepare("INSERT INTO future_log (id, target_month, signifier, text) VALUES (?, ?, ?, ?)").run(id, target_month, signifier, text);
      return { ok: true, data: { id, target_month, signifier, text } };
    }

    if (action.method === "POST" && action.path.includes("/calendar") && action.body) {
      const body = action.body as any;
      const result = await createCalendarEvent({
        summary: body.summary || "",
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        allDay: body.allDay,
        calendar: body.calendar,
        location: body.location,
        description: body.description,
      });

      if (!result.ok) {
        if (result.disabled) {
          return { ok: true, data: { skipped: true, reason: "Calendar integration disabled" } };
        }
        return { ok: false, error: `Calendar creation failed: ${result.error}` };
      }

      return { ok: true, data: result.data };
    }

    return { ok: false, error: `Unsupported action: ${action.method} ${action.path}` };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function executeGetLocally(action: JournalAgentAction): ActionResult {
  try {
    const db = getDb();

    if (action.path === "/api/journal" && action.query?.date) {
      const rows = db.prepare("SELECT * FROM journal_entries WHERE date = ? AND status != 'killed' ORDER BY sort_order ASC").all(action.query.date);
      return { ok: true, data: (rows as any[]).map(mapRowToEntry) };
    }

    if (action.path.includes("/unresolved") && action.query?.month) {
      const rows = db.prepare("SELECT * FROM journal_entries WHERE date LIKE ? AND (signifier = 'task' OR signifier = 'appointment') AND status IN ('open', 'in-progress', 'blocked') ORDER BY date ASC, sort_order ASC").all(`${action.query.month}%`);
      return { ok: true, data: (rows as any[]).map(mapRowToEntry) };
    }

    if (action.path === "/api/collections") {
      const rows = db.prepare("SELECT * FROM collections ORDER BY created_at DESC").all();
      return { ok: true, data: rows };
    }

    return { ok: false, error: "Unsupported GET path" };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function executeAction(action: JournalAgentAction): Promise<ActionResult> {
  if (action.method === "GET") return executeGetLocally(action);
  return executeMutationLocally(action);
}

export async function executeJournalAgent(request: JournalAgentRequest): Promise<JournalAgentExecutionResult> {
  const plan = await planJournalActions(request.command, request.context);

  if (plan.actions.length === 0) {
    return { ok: true, message: plan.message, actions: [], createdEntries: [], updatedEntries: [] };
  }

  const createdEntries: JournalEntry[] = [];
  const updatedEntries: JournalEntry[] = [];
  const actions: Array<{ method: string; path: string; success: boolean }> = [];
  const resultIds: Array<string | null> = [];
  let allOk = true;
  let failure = "Unknown error";

  for (const action of plan.actions) {
    if (action.parent_ref !== undefined && action.body) {
      const parentId = resultIds[action.parent_ref];
      if (parentId) action.body.parent_id = parentId;
    }

    const result = await executeAction(action);
    actions.push({ method: action.method, path: action.path, success: result.ok });

    const maybeEntry = result.data as JournalEntry | undefined;
    const createdId = (result.data as { id?: string } | undefined)?.id ?? maybeEntry?.id ?? null;
    resultIds.push(createdId);

    if (result.ok && maybeEntry?.id && action.path === "/api/journal" && action.method === "POST") {
      createdEntries.push(maybeEntry);
    }

    if (result.ok && maybeEntry?.id && action.path.startsWith("/api/journal/") && action.method === "PATCH") {
      updatedEntries.push(maybeEntry);
    }

    if (!result.ok) {
      allOk = false;
      failure = result.error || failure;
      break;
    }
  }

  return {
    ok: allOk,
    message: allOk ? plan.message : `Failed: ${failure}`,
    actions,
    createdEntries,
    updatedEntries,
  };
}
