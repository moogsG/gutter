import { type NextRequest, NextResponse } from "next/server";
import { getHabitsMomentumData } from "@/lib/habits";
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
    const requestedDate = searchParams.get("date")?.trim();

    if (requestedDate && !isValidIsoDate(requestedDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 },
      );
    }

    return NextResponse.json(await getHabitsMomentumData(requestedDate || undefined));
  } catch (error) {
    console.error("[habits] failed to build momentum data", error);
    return NextResponse.json(
      { error: "Failed to build habits momentum data" },
      { status: 500 },
    );
  }
}
