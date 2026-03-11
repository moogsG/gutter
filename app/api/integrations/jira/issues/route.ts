import { NextRequest, NextResponse } from "next/server";
import { fetchAssignedIssues, JIRA_ENABLED } from "@/lib/jira";

export async function GET(request: NextRequest) {
  try {
    if (!JIRA_ENABLED) {
      return NextResponse.json(
        { error: "Jira integration is disabled" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const issues = await fetchAssignedIssues(forceRefresh);

    return NextResponse.json({
      ok: true,
      issues,
      count: issues.length,
    });
  } catch (error: any) {
    console.error("[Jira API] Failed to fetch issues:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to fetch Jira issues",
        issues: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}
