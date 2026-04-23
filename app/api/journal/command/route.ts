import { type NextRequest, NextResponse } from "next/server";
import { executeJournalAgent, getConversationHistory } from "@/lib/journal-agent";
import { rateLimitMiddleware } from "@/lib/rate-limit";

interface CommandRequest {
  command: string;
  context?: {
    currentDate?: string;
    currentPage?: string;
    sessionId?: string;
  };
}

export async function POST(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 30,
  });
  if (limited) return limited;

  try {
    const body: CommandRequest = await req.json();
    const { command, context } = body;

    if (!command?.trim()) {
      return NextResponse.json(
        { ok: false, message: "No command provided", actions: [] },
        { status: 400 },
      );
    }

    const sessionId = context?.sessionId;
    const result = await executeJournalAgent({
      command,
      context: {
        ...context,
        recentConversation: sessionId ? getConversationHistory(sessionId, 12) : [],
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Command execution error:", error);
    return NextResponse.json(
      { ok: false, message: "Command failed to execute", actions: [] },
      { status: 500 },
    );
  }
}
