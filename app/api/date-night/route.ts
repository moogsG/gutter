import { NextRequest, NextResponse } from "next/server";
import { getDateNightData } from "@/lib/date-night";
import { getCancunTodayDate } from "@/lib/meal-plan";

function getRequestedDate(request: NextRequest): string {
  return request.nextUrl.searchParams.get("date") || getCancunTodayDate();
}

export async function GET(request: NextRequest) {
  try {
    const data = await getDateNightData(getRequestedDate(request));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load date night status";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
