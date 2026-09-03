import { type NextRequest, NextResponse } from "next/server";
import {
  getHabitsMomentumData,
  isHabitId,
  isValidHabitDate,
  setHabitCheckIn,
} from "@/lib/habits";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60_000,
    maxRequests: 30,
  });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(req.url);
    const requestedDate = searchParams.get("date")?.trim();

    if (requestedDate && !isValidHabitDate(requestedDate)) {
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

export async function POST(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60_000,
    maxRequests: 30,
  });
  if (limited) return limited;

  try {
    const body = await req.json() as { habitId?: unknown; date?: unknown; state?: unknown };
    if (
      !isHabitId(body.habitId)
      || !isValidHabitDate(body.date)
      || !["done", "skipped", "unlogged"].includes(String(body.state))
    ) {
      return NextResponse.json({ error: "Invalid habit check-in." }, { status: 400 });
    }

    return NextResponse.json(
      setHabitCheckIn(body.habitId, body.date, body.state as "done" | "skipped" | "unlogged"),
    );
  } catch (error) {
    console.error("[habits] failed to save check-in", error);
    return NextResponse.json({ error: "Failed to save habit check-in" }, { status: 500 });
  }
}
