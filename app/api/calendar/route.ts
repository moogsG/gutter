import type { NextRequest } from "next/server";
import { fetchCalendarEvents } from "@/lib/calendar";
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
			const startDate = new Date(
				parseInt(year, 10),
				parseInt(monthNum, 10) - 1,
				1,
			);
			const endDate = new Date(parseInt(year, 10), parseInt(monthNum, 10), 0);
			fromStr = startDate.toISOString().split("T")[0];
			toStr = endDate.toISOString().split("T")[0];
		} else {
			const now = new Date();
			const endDate = new Date();
			endDate.setDate(endDate.getDate() + 7);
			fromStr = now.toISOString().split("T")[0];
			toStr = endDate.toISOString().split("T")[0];
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
