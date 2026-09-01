import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { formatCancunIsoDate, getHealthCutCategory, getHealthCutData, parseHealthCutTags } from "@/lib/health-cut";
import type { HealthCutCategory } from "@/types";
import { rateLimitMiddleware } from "@/lib/rate-limit";

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60_000,
    maxRequests: 30,
  });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(req.url);
    const requestedDate = searchParams.get("date")?.trim() || formatCancunIsoDate();

    if (!isValidIsoDate(requestedDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 },
      );
    }

    return NextResponse.json(getHealthCutData(requestedDate));
  } catch (error) {
    console.error("Failed to load health cut data", error);
    return NextResponse.json(
      { error: "Failed to load health cut data" },
      { status: 500 },
    );
  }
}

interface CleanupCandidateRow {
  id: string;
  date: string;
  text: string;
  status: string;
  tags: string | null;
}

function normalizePromptText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function isValidCategory(value: string): value is HealthCutCategory {
  return ["omad", "workout", "alcohol", "prep", "nutrition", "other"].includes(value);
}

export async function POST(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60_000,
    maxRequests: 10,
  });
  if (limited) return limited;

  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const requestedDate =
      typeof body.date === "string" && isValidIsoDate(body.date)
        ? body.date
        : formatCancunIsoDate();
    const category =
      typeof body.category === "string" && body.category.trim() !== ""
        ? body.category.trim()
        : null;

    if (action !== "cleanup-stale") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (category && !isValidCategory(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const db = getDb();
    const currentRows = db.prepare(`
      SELECT text, tags
      FROM journal_entries
      WHERE signifier = 'task'
        AND date = ?
        AND tags LIKE '%health-cut:%'
        AND status IN ('open', 'in-progress', 'blocked', 'done')
    `).all(requestedDate) as Array<{ text: string; tags: string | null }>;
    const activePromptKeys = new Set(
      currentRows.map((row) => {
        const rowCategory = getHealthCutCategory(parseHealthCutTags(row.tags));
        return `${rowCategory}::${normalizePromptText(row.text)}`;
      }),
    );
    const rows = db.prepare(`
      SELECT id, date, text, status, tags
      FROM journal_entries
      WHERE signifier = 'task'
        AND tags LIKE '%health-cut%'
        AND status IN ('open', 'in-progress', 'blocked')
        AND date < ?
      ORDER BY date ASC, sort_order ASC
    `).all(requestedDate) as CleanupCandidateRow[];

    const targetRows = rows.filter((row) => {
      const rowCategory = getHealthCutCategory(parseHealthCutTags(row.tags));
      const rowKey = `${rowCategory}::${normalizePromptText(row.text)}`;
      if (row.status !== "open") return false;
      if (!activePromptKeys.has(rowKey)) return false;
      if (!category) return true;
      return rowCategory === category;
    });

    if (targetRows.length) {
      const killMany = db.prepare(`
        UPDATE journal_entries
        SET status = 'killed',
            updated_at = datetime('now')
        WHERE id = ?
      `);
      for (const row of targetRows) {
        killMany.run(row.id);
      }
    }

    return NextResponse.json({
      ok: true,
      requestedDate,
      category,
      killedCount: targetRows.length,
      remainingAudit: getHealthCutData(requestedDate).audit,
    });
  } catch (error) {
    console.error("Failed to clean up health cut backlog", error);
    return NextResponse.json(
      { error: "Failed to clean up health cut backlog" },
      { status: 500 },
    );
  }
}
