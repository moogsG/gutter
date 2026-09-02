import type { NextRequest } from "next/server";
import { fetchCalendarEvents } from "@/lib/calendar";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
	// Rate limit calendar fetches (50 per minute)
	const limited = rateLimitMiddleware(request, {
		windowMs: 60000,
		maxRequests: 50,
	});
	if (limited) return limited;

	try {
		const { searchParams } = new URL(request.url);
		const month = searchParams.get("month");

		let fromStr: string;
		let toStr: string;

		if (month) {
			const [year, monthNum] = month.split("-");
			const lastDay = new Date(Date.UTC(parseInt(year, 10), parseInt(monthNum, 10), 0)).getUTCDate();
			fromStr = `${year}-${monthNum}-01`;
			toStr = `${year}-${monthNum}-${String(lastDay).padStart(2, "0")}`;
		} else {
			fromStr = getJournalDate();
			toStr = shiftJournalDate(fromStr, 7);
		}

		const result = await fetchCalendarEvents(fromStr, toStr);
		if (!result.ok) {
			throw new Error(result.error || "Failed to fetch calendar events");
		}

		let upcoming = (result.data || [])
			.sort(
				(a, b) =>
					new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
			)
			.map((e) => ({
				id: e.id,
				title: e.summary,
				startDate: e.startDate,
				endDate: e.endDate,
				calendar: e.calendar,
				allDay: e.allDay,
				location: e.location,
			}));

		if (!month) {
			upcoming = upcoming.filter((e: any) => !e.allDay).slice(0, 5);
		}

		return Response.json({ events: upcoming });
	} catch (error) {
		console.error("Calendar fetch error:", error);
		return Response.json(
			{ error: "Failed to fetch calendar" },
			{ status: 500 },
		);
	}
}
