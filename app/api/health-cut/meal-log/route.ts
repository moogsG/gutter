import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleApiError, handleValidationError } from "@/lib/api-error-handler";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logValidationFailure } from "@/lib/security-logger";
import { validateJournalEntry } from "@/lib/validation";
import { upsertJournalEntry } from "@/lib/vector-store";

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 20,
  });
  if (limited) return limited;

  try {
    const body = (await req.json()) as { date?: string; text?: string };
    const date = body.date?.trim();
    const text = body.text?.trim();

    if (!date || !text) {
      return handleValidationError("Date and text are required");
    }

    if (!isValidIsoDate(date)) {
      return handleValidationError("Invalid date format. Use YYYY-MM-DD");
    }

    const validation = validateJournalEntry({
      content: text,
      tags: ["health-log", "health-log:meal", "health-cut"],
    });

    if (!validation.valid) {
      await logValidationFailure(req, "/api/health-cut/meal-log", {
        errors: validation.errors,
      });
      return handleValidationError("Validation failed", validation.errors.join(", "));
    }

    const sanitizedText = validation.sanitized?.content || text;
    const sanitizedTags = validation.sanitized?.tags || ["health-log", "health-log:meal", "health-cut"];
    const db = getDb();
    const now = new Date().toISOString();
    const id = `je-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const maxOrder = db
      .prepare("SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ? AND parent_id IS NULL")
      .get(date) as { max: number | null };
    const sortOrder = (maxOrder?.max ?? -1) + 1;

    db.prepare(
      `INSERT INTO journal_entries
        (id, date, signifier, text, status, lane, priority, waiting_on, tags, sort_order, parent_id, created_at, updated_at)
       VALUES (?, ?, 'note', ?, 'open', 'personal', NULL, NULL, ?, ?, NULL, ?, ?)`
    ).run(id, date, sanitizedText, JSON.stringify(sanitizedTags), sortOrder, now, now);

    db.prepare(
      `UPDATE journal_entries
       SET status = 'done', updated_at = ?
       WHERE date = ?
         AND signifier = 'task'
         AND status != 'done'
         AND tags LIKE '%health-cut:nutrition%'`
    ).run(now, date);

    upsertJournalEntry({
      id,
      text: sanitizedText,
      date,
      signifier: "note",
      collection_id: undefined,
    }).catch((error) => console.error("[vector-store] meal log upsert failed:", error));

    return NextResponse.json({
      ok: true,
      entry: {
        id,
        date,
        text: sanitizedText,
        created_at: now,
      },
    });
  } catch (error) {
    return handleApiError("create health meal log", error);
  }
}
