import { type NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { fetchCalendarEvents } from "@/lib/calendar";

export async function GET(req: NextRequest) {
	// Rate limit: 30 requests per minute (calendar fetch)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 30,
	});
	if (limited) return limited;

	const from = req.nextUrl.searchParams.get("from");
	const to = req.nextUrl.searchParams.get("to");

	if (!from || !to) {
		return NextResponse.json(
			{ error: "Missing required params: from, to (YYYY-MM-DD)" },
			{ status: 400 },
		);
	}

	const result = await fetchCalendarEvents(from, to);

	if (!result.ok) {
		return NextResponse.json(
			{ error: result.error || "Failed to fetch calendar events" },
			{ status: 500 },
		);
	}

	return NextResponse.json(result.data || []);
}
