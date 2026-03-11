import { NextRequest, NextResponse } from "next/server";
import { createIssue, JIRA_ENABLED } from "@/lib/jira";

export async function POST(request: NextRequest) {
  try {
    if (!JIRA_ENABLED) {
      return NextResponse.json(
        { error: "Jira integration is disabled" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { summary, description } = body;

    if (!summary) {
      return NextResponse.json(
        { error: "Missing summary" },
        { status: 400 }
      );
    }

    const issueKey = await createIssue(summary, description);

    return NextResponse.json({
      ok: true,
      issueKey,
      message: `Created ${issueKey}`,
    });
  } catch (error: any) {
    console.error("[Jira API] Failed to create issue:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to create Jira issue",
      },
      { status: 500 }
    );
  }
}
