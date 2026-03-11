import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getJournalDb } from "@/lib/journal-db";
import { getDb } from "@/lib/db";
import { createCalendarEvent } from "@/lib/calendar";

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.JOURNAL_COMMAND_MODEL || "qwen2.5-coder:7b";

interface CommandRequest {
  command: string;
  context?: {
    currentDate?: string;
    currentPage?: string;
  };
}

interface LLMAction {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  parent_ref?: number; // index into actions array — use that action's result id as parent_id
}

interface LLMResponse {
  actions: LLMAction[];
  message: string;
}

const SYSTEM_PROMPT = `You are a bullet journal command interpreter. Parse natural language commands into API calls.

## Data Model
Signifiers: task, appointment, note, memory, important
Statuses: open, done, migrated, killed
Dates: YYYY-MM-DD format. Months: YYYY-MM format.

## API Endpoints
- POST /api/journal — Create entry: { date, signifier, text, tags?, parent_id? }
- PATCH /api/journal/:id — Update: { status?, text?, signifier?, collection_id?, parent_id? }
- DELETE /api/journal/:id — Soft delete (kills entry)
- POST /api/journal/migrate — Migrate: { entryIds: string[], targetDate: string }
- GET /api/journal/unresolved?month=YYYY-MM — Open tasks/appointments for a month
- POST /api/collections — Create: { title, icon? }
- GET /api/collections — List all collections
- POST /api/future-log — Create: { target_month: "YYYY-MM", signifier, text }
- POST /api/journal/calendar — Create calendar event: { summary, date: "YYYY-MM-DD", startTime?: "HH:mm", endTime?: "HH:mm", allDay?: boolean, calendar?: "work"|"home"|"family"|"jw"|"school", location?, description? }

## Calendar Events
When a command mentions scheduling, meetings, appointments, or time-bound events:
1. Create a journal entry with signifier "appointment"
2. Also create a calendar event via POST /api/journal/calendar
Both actions in the same response. Default calendar is "home" unless context suggests work/family/jw/school.
Times must be 24-hour format (e.g. "14:00" not "2:00 PM"). If no end time given, omit it (defaults to 1 hour).

## Subtasks
Tasks can have subtasks. Use "parent_ref" to reference an earlier action's result as parent.
Example: "Buy groceries: milk, eggs, bread" becomes a parent task + 3 subtasks.
The parent_ref field is an index into the actions array (0-based). The executor will use the created id from that action as parent_id.

## Signifier Detection
- Action verbs (buy, fix, call, build, clean, do, finish, email, schedule, write, review) → task
- Time/event references (meeting, appointment, event, "at 3pm") → appointment
- Info statements (note:, remember that, FYI) → note
- Meaningful moments (grateful, highlight, loved, amazing) → memory
- Urgent markers (urgent, critical, important, ASAP, priority) → important
- Default: task

## Rules
- Return ONLY valid JSON, no markdown, no explanation
- Resolve relative dates from the provided currentDate
- "yesterday" = currentDate - 1 day, "tomorrow" = currentDate + 1 day
- For month references in future log, use YYYY-MM format
- If a command needs an entry ID you don't have, use a "search" action with method GET
- The "message" field should be a short human-readable confirmation

## Response Format
{
  "actions": [
    { "method": "POST", "path": "/api/journal", "body": { "date": "2026-03-05", "signifier": "task", "text": "Buy milk" } }
  ],
  "message": "Added task: Buy milk"
}

Calendar example:
{
  "actions": [
    { "method": "POST", "path": "/api/journal", "body": { "date": "2026-03-06", "signifier": "appointment", "text": "Meeting with Thiago at 3pm — autopilot review" } },
    { "method": "POST", "path": "/api/journal/calendar", "body": { "summary": "Meeting with Thiago — autopilot review", "date": "2026-03-06", "startTime": "15:00", "calendar": "work" } }
  ],
  "message": "Scheduled meeting with Thiago tomorrow at 3pm and added journal entry"
}

Subtask example:
{
  "actions": [
    { "method": "POST", "path": "/api/journal", "body": { "date": "2026-03-05", "signifier": "task", "text": "Buy groceries" } },
    { "method": "POST", "path": "/api/journal", "body": { "date": "2026-03-05", "signifier": "task", "text": "Milk" }, "parent_ref": 0 },
    { "method": "POST", "path": "/api/journal", "body": { "date": "2026-03-05", "signifier": "task", "text": "Eggs" }, "parent_ref": 0 }
  ],
  "message": "Added task: Buy groceries with 2 subtasks"
}

If unclear:
{ "actions": [], "message": "I didn't understand that. Try 'buy milk' or 'create a Books collection'." }`;

function buildUserPrompt(command: string, context?: CommandRequest["context"]): string {
  const date = context?.currentDate || new Date().toISOString().split("T")[0];
  const page = context?.currentPage || "daily";

  // Calculate relative dates
  const d = new Date(date + "T12:00:00");
  const yesterday = new Date(d);
  yesterday.setDate(d.getDate() - 1);
  const tomorrow = new Date(d);
  tomorrow.setDate(d.getDate() + 1);

  return `Current date: ${date} (yesterday: ${yesterday.toISOString().split("T")[0]}, tomorrow: ${tomorrow.toISOString().split("T")[0]})
Current page: ${page}
Current month: ${date.substring(0, 7)}

Command: ${command}`;
}

async function callOllama(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      format: "json",
      options: {
        temperature: 0.1,
        num_predict: 512,
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

  // Validate structure
  if (!parsed.actions || !Array.isArray(parsed.actions)) {
    return { actions: [], message: parsed.message || "Command not understood." };
  }

  return {
    actions: parsed.actions,
    message: parsed.message || "Done.",
  };
}

async function executeAction(action: LLMAction): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  // Execute all actions locally against the DB to avoid self-signed cert issues
  // and unnecessary HTTP round-trips
  if (action.method === "GET") {
    return executeGetLocally(action);
  }

  return await executeMutationLocally(action);
}

async function executeMutationLocally(action: LLMAction): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const db = getJournalDb();

    // POST /api/journal — Create entry
    if (action.method === "POST" && action.path === "/api/journal" && action.body) {
      const { date, signifier, text, tags = [], parent_id } = action.body as any;
      if (!date || !signifier || !text) {
        return { ok: false, error: "Missing required fields: date, signifier, text" };
      }
      const maxOrder = parent_id
        ? db.prepare("SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ? AND parent_id = ?").get(date as string, parent_id) as { max: number | null }
        : db.prepare("SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ? AND parent_id IS NULL").get(date as string) as { max: number | null };
      const sortOrder = (maxOrder?.max ?? -1) + 1;
      const id = uniqueId("je");
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO journal_entries (id, date, signifier, text, status, tags, sort_order, parent_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`
      ).run(id, date, signifier, text, JSON.stringify(tags), sortOrder, parent_id || null, now, now);
      return { ok: true, data: { id, date, signifier, text, status: "open", parent_id } };
    }

    // PATCH /api/journal/:id — Update entry
    if (action.method === "PATCH" && action.path.startsWith("/api/journal/")) {
      const id = action.path.split("/").pop();
      if (!id || !action.body) return { ok: false, error: "Missing id or body" };
      const updates: string[] = ["updated_at = ?"];
      const values: any[] = [new Date().toISOString()];
      const body = action.body as any;
      if (body.status) { updates.push("status = ?"); values.push(body.status); }
      if (body.text) { updates.push("text = ?"); values.push(body.text); }
      if (body.signifier) { updates.push("signifier = ?"); values.push(body.signifier); }
      if (body.collection_id !== undefined) { updates.push("collection_id = ?"); values.push(body.collection_id); }
      values.push(id);
      const result = db.prepare(`UPDATE journal_entries SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      return { ok: result.changes > 0, data: { id, updated: result.changes } };
    }

    // DELETE /api/journal/:id — Kill entry
    if (action.method === "DELETE" && action.path.startsWith("/api/journal/")) {
      const id = action.path.split("/").pop();
      if (!id) return { ok: false, error: "Missing id" };
      const result = db.prepare("UPDATE journal_entries SET status = 'killed', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), id);
      return { ok: result.changes > 0, data: { id, killed: true } };
    }

    // POST /api/journal/migrate
    if (action.method === "POST" && action.path.includes("/migrate") && action.body) {
      const { entryIds, targetDate } = action.body as any;
      if (!entryIds?.length || !targetDate) return { ok: false, error: "Missing entryIds or targetDate" };
      const now = new Date().toISOString();
      let migrated = 0;
      for (const entryId of entryIds) {
        const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(entryId) as any;
        if (!entry) continue;
        const maxOrder = db.prepare("SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ?")
          .get(targetDate) as { max: number | null };
        const newId = uniqueId("je");
        db.prepare(
          `INSERT INTO journal_entries (id, date, signifier, text, status, migrated_from, tags, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`
        ).run(newId, targetDate, entry.signifier, entry.text, entryId, entry.tags || "[]", (maxOrder?.max ?? -1) + 1, now, now);
        db.prepare("UPDATE journal_entries SET status = 'migrated', migrated_to = ?, updated_at = ? WHERE id = ?")
          .run(newId, now, entryId);
        migrated++;
      }
      return { ok: true, data: { migrated } };
    }

    // POST /api/collections
    if (action.method === "POST" && action.path === "/api/collections" && action.body) {
      const { title, icon } = action.body as any;
      if (!title) return { ok: false, error: "Missing title" };
      const id = uniqueId("col");
      db.prepare("INSERT INTO collections (id, title, icon) VALUES (?, ?, ?)").run(id, title, icon || null);
      return { ok: true, data: { id, title, icon } };
    }

    // POST /api/future-log
    if (action.method === "POST" && action.path.includes("/future-log") && action.body) {
      const { target_month, signifier, text } = action.body as any;
      if (!target_month || !signifier || !text) return { ok: false, error: "Missing fields" };
      const id = uniqueId("fl");
      db.prepare("INSERT INTO future_log (id, target_month, signifier, text) VALUES (?, ?, ?, ?)")
        .run(id, target_month, signifier, text);
      return { ok: true, data: { id, target_month, signifier, text } };
    }

    // POST /api/journal/calendar — Create calendar event (via shared calendar module)
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
        // If calendar is disabled, return gracefully without failing the whole command
        if (result.disabled) {
          return { ok: true, data: { skipped: true, reason: "Calendar integration disabled" } };
        }
        // For other errors, return error but don't crash
        console.error("[Calendar] Failed to create event:", result.error);
        return { ok: false, error: `Calendar creation failed: ${result.error}` };
      }

      return { ok: true, data: result.data };
    }

    return { ok: false, error: `Unsupported action: ${action.method} ${action.path}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function executeGetLocally(action: LLMAction): { ok: boolean; data?: unknown; error?: string } {
  try {
    const db = getJournalDb();

    // /api/journal?date=YYYY-MM-DD
    if (action.path === "/api/journal" && action.query?.date) {
      const entries = db
        .prepare("SELECT * FROM journal_entries WHERE date = ? AND status = 'open' ORDER BY sort_order ASC")
        .all(action.query.date);
      return { ok: true, data: entries };
    }

    // /api/journal/unresolved?month=YYYY-MM
    if (action.path.includes("/unresolved") && action.query?.month) {
      const entries = db
        .prepare(
          "SELECT * FROM journal_entries WHERE date LIKE ? AND (signifier = 'task' OR signifier = 'appointment') AND status = 'open' ORDER BY date ASC"
        )
        .all(`${action.query.month}%`);
      return { ok: true, data: entries };
    }

    // /api/collections
    if (action.path === "/api/collections") {
      const collections = getDb()
        .prepare("SELECT * FROM collections ORDER BY created_at DESC")
        .all();
      return { ok: true, data: collections };
    }

    return { ok: false, error: "Unsupported GET path" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CommandRequest = await req.json();
    const { command, context } = body;

    if (!command?.trim()) {
      return NextResponse.json(
        { ok: false, message: "No command provided", actions: [] },
        { status: 400 }
      );
    }

    // Call Ollama to interpret the command
    const userPrompt = buildUserPrompt(command, context);
    let llmResult: LLMResponse;

    try {
      llmResult = await callOllama(SYSTEM_PROMPT, userPrompt);
    } catch (err) {
      console.error("LLM interpretation failed:", err);
      // Fallback: try to parse as a simple task entry
      return NextResponse.json({
        ok: false,
        message: "Command interpreter unavailable. Try adding entries directly.",
        actions: [],
      }, { status: 503 });
    }

    if (llmResult.actions.length === 0) {
      return NextResponse.json({
        ok: true,
        message: llmResult.message,
        actions: [],
      });
    }

    // Execute each action in sequence, resolving parent_ref chains
    const results: Array<{ action: LLMAction; result: { ok: boolean; data?: unknown; error?: string } }> = [];
    const resultIds: (string | null)[] = [];
    let allOk = true;

    for (const action of llmResult.actions) {
      // Resolve parent_ref to actual parent_id
      if (action.parent_ref !== undefined && action.parent_ref !== null && action.body) {
        const parentId = resultIds[action.parent_ref];
        if (parentId) {
          action.body.parent_id = parentId;
        }
      }

      const result = await executeAction(action);
      results.push({ action, result });

      // Capture created id for parent_ref resolution
      const createdId = (result.data as { id?: string })?.id ?? null;
      resultIds.push(createdId);

      if (!result.ok) {
        allOk = false;
        break;
      }
    }

    return NextResponse.json({
      ok: allOk,
      message: allOk ? llmResult.message : `Failed: ${results[results.length - 1]?.result.error || "Unknown error"}`,
      actions: results.map((r) => ({
        method: r.action.method,
        path: r.action.path,
        success: r.result.ok,
      })),
    });
  } catch (error) {
    console.error("Command execution error:", error);
    return NextResponse.json(
      { ok: false, message: "Command failed to execute", actions: [] },
      { status: 500 }
    );
  }
}
