import { NextRequest, NextResponse } from "next/server";
import { getCancunTodayDate, getMealPlanData } from "@/lib/meal-plan";
import { clearMealChecklistWeek, updateMealChecklistItem } from "@/lib/meal-plan-checklist";

function getRequestedDate(request: NextRequest): string {
  return request.nextUrl.searchParams.get("date") || getCancunTodayDate();
}

export async function GET(request: NextRequest) {
  try {
    const data = await getMealPlanData(getRequestedDate(request));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load meal plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "regenerate" | "toggle-check" | "clear-checks";
      date?: string;
      weekOf?: string;
      sectionId?: string;
      item?: string;
      checked?: boolean;
    };
    const action = body.action || "regenerate";
    const requestedDate = body.date || getCancunTodayDate();

    if (action === "regenerate") {
      const data = await getMealPlanData(requestedDate, { forceRegenerate: true });
      return NextResponse.json(data);
    }

    if (action === "toggle-check") {
      if (!body.weekOf || !body.sectionId || !body.item) {
        return NextResponse.json({ error: "Checklist update requires weekOf, sectionId, and item." }, { status: 400 });
      }

      await updateMealChecklistItem({
        weekOf: body.weekOf,
        sectionId: body.sectionId,
        item: body.item,
        checked: body.checked,
      });
      return NextResponse.json(await getMealPlanData(requestedDate));
    }

    if (action === "clear-checks") {
      if (!body.weekOf) {
        return NextResponse.json({ error: "Checklist reset requires weekOf." }, { status: 400 });
      }

      await clearMealChecklistWeek(body.weekOf);
      return NextResponse.json(await getMealPlanData(requestedDate));
    }

    return NextResponse.json({ error: "Unsupported meal-plan action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to regenerate meal plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
