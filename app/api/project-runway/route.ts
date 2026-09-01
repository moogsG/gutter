import { type NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";
import { buildProjectRunway } from "@/lib/project-runway";
import { rateLimitMiddleware } from "@/lib/rate-limit";

function getRequestedDate(input: string | null): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 60,
  });
  if (limited) return limited;

  try {
    const requestedDate = getRequestedDate(req.nextUrl.searchParams.get("date"));
    const data = await buildProjectRunway(requestedDate);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError("build project runway", error);
  }
}
