import { NextRequest, NextResponse } from "next/server";
import { getChoreBoardData, updateChoreBoard } from "@/lib/chores";

export async function GET() {
  try {
    return NextResponse.json(getChoreBoardData());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load chores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "complete" | "pick" | "reset" | "reopen";
      selection?: string;
    };

    if (!body.action || !["complete", "pick", "reset", "reopen"].includes(body.action)) {
      return NextResponse.json({ error: "Unsupported chore action" }, { status: 400 });
    }

    return NextResponse.json(updateChoreBoard(body.action, body.selection));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update chores";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
