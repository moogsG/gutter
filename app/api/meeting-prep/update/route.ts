import { isValidMeetingOccurrenceDate } from "@/lib/meeting-occurrence";
import { updateMeetingPrep } from "@/lib/meeting-prep-update";
import { rateLimitMiddleware } from "@/lib/rate-limit";

// POST: Update prep data for a meeting (called by Jynx after processing)
export async function POST(request: Request) {
	// Rate limit: 20 requests per minute (write operation)
	const limited = rateLimitMiddleware(request, {
		windowMs: 60000,
		maxRequests: 20,
	});
	if (limited) return limited;

	try {
		const input = await request.json();

		if (!input.eventId) {
			return Response.json({ error: "Missing eventId" }, { status: 400 });
		}
		if (
			input.occurrenceDate !== undefined &&
			!isValidMeetingOccurrenceDate(input.occurrenceDate)
		) {
			return Response.json(
				{ error: "occurrenceDate must be a valid YYYY-MM-DD date" },
				{ status: 400 },
			);
		}

		const result = updateMeetingPrep(input);
		return Response.json({ ok: true, id: result.id });
	} catch (error) {
		console.error("Meeting prep update error:", error);
		return Response.json(
			{ error: "Failed to update meeting prep" },
			{ status: 500 },
		);
	}
}
