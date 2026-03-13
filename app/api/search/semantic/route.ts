import { NextRequest, NextResponse } from "next/server";
import { searchJournalEntries } from "@/lib/vector-store";

/**
 * GET /api/search/semantic?q=<query>[&limit=<n>]
 *
 * Returns top-K semantically similar journal entries.
 * Used as a fallback by the OmniBar when FTS returns < 3 results.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") || "5", 10),
    20
  );

  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchJournalEntries(query.trim(), limit);
    return NextResponse.json(results);
  } catch (error) {
    console.error("[/api/search/semantic] error:", error);
    // Return empty array so OmniBar can degrade gracefully
    return NextResponse.json([]);
  }
}
