import { NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { fetchSlackContext } from "@/lib/slack-context";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 20,
  });
  if (limited) return limited;

  try {
    const data = await fetchSlackContext();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Slack context API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch Slack context",
      },
      { status: 500 },
    );
  }
}
