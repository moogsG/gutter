import { type NextRequest, NextResponse } from "next/server";
import { getJiraStatus } from "@/lib/jira";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
	// Rate limit: 50 requests per minute (read operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 50,
	});
	if (limited) return limited;

	const status = getJiraStatus();

	return NextResponse.json({
		ok: true,
		jira: status,
	});
}
