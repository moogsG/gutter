import { NextRequest, NextResponse } from "next/server";
import { searchMeetingContext } from "@/lib/vector-store";

/**
 * GET /api/context/meeting?title=<meeting title>[&limit=<n>]
 *
 * Returns top-K relevant past journal entries and meeting transcripts
 * for use as RAG context in meeting prep prompts (ollama-prep.ts).
 */
export async function GET(req: NextRequest) {
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
