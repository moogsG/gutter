import { type NextRequest, NextResponse } from "next/server";
import { JIRA_ENABLED, updateIssueStatus } from "@/lib/jira";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
	// Rate limit: 10 requests per minute (external API write operation)
	const limited = rateLimitMiddleware(request, {
		windowMs: 60000,
		maxRequests: 10,
	});
	if (limited) return limited;

	try {
		if (!JIRA_ENABLED) {
			return NextResponse.json(
				{ error: "Jira integration is disabled" },
				{ status: 503 },
			);
		}

		const body = await request.json();
		const { issueKey, status } = body;

		if (!issueKey || !status) {
			return NextResponse.json(
				{ error: "Missing issueKey or status" },
				{ status: 400 },
			);
		}

		await updateIssueStatus(issueKey, status);

		return NextResponse.json({
			ok: true,
			message: `Updated ${issueKey} to ${status}`,
		});
	} catch (error: any) {
		console.error("[Jira API] Failed to update issue:", error);

		return NextResponse.json(
			{
				ok: false,
				error: error.message || "Failed to update issue status",
			},
			{ status: 500 },
		);
	}
}
