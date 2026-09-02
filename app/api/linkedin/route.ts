import { type NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";
import { buildLinkedInBoard } from "@/lib/linkedin";
import { getJournalDate } from "@/lib/journal-date";
import { rateLimitMiddleware } from "@/lib/rate-limit";

function getRequestedDate(input: string | null): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return getJournalDate();
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 60,
  });
  if (limited) return limited;

  try {
    const requestedDate = getRequestedDate(req.nextUrl.searchParams.get("date"));
    const data = await buildLinkedInBoard(requestedDate);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError("build linkedin board", error);
  }
}
