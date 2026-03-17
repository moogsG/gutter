import { NextRequest, NextResponse } from "next/server";
import { searchMeetingContext } from "@/lib/vector-store";
import { rateLimitMiddleware } from "@/lib/rate-limit";

/**
 * GET /api/context/meeting?title=<meeting title>[&limit=<n>]
 *
 * Returns top-K relevant past journal entries and meeting transcripts
 * for use as RAG context in meeting prep prompts (ollama-prep.ts).
 */
export async function GET(req: NextRequest) {
  // Rate limit: 20 requests per minute
  const limited = rateLimitMiddleware(req, { windowMs: 60000, maxRequests: 20 });
  if (limited) return limited;
  const title = req.nextUrl.searchParams.get("title");
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") || "5", 10),
    20
  );

  if (!title || title.trim().length < 2) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const results = await searchMeetingContext(title.trim(), limit);
    return NextResponse.json(results);
  } catch (error) {
    console.error("[/api/context/meeting] error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
