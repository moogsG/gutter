import { NextRequest, NextResponse } from "next/server";
import { getSchoolBoardData } from "@/lib/school";
import { getJournalDate } from "@/lib/journal-date";

function getRequestedDate(request: NextRequest): string {
  return request.nextUrl.searchParams.get("date") || getJournalDate();
}

export async function GET(request: NextRequest) {
  try {
    const data = await getSchoolBoardData(getRequestedDate(request));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load school runway";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
