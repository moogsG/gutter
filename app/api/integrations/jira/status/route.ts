import { NextResponse } from "next/server";
import { getJiraStatus } from "@/lib/jira";

export async function GET() {
  const status = getJiraStatus();

  return NextResponse.json({
    ok: true,
    jira: status,
  });
}
