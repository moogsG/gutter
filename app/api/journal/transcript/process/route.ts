import { type NextRequest, NextResponse } from "next/server";
import { generateCompletion } from "@/lib/llm-router";
import {
  executeJournalAgent,
  getConversationHistory,
  saveConversationMessage,
} from "@/lib/journal-agent";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import type { LLMMessage } from "@/lib/llm-router";
import type { JournalEntry, Signifier } from "@/types/journal";

type ProcessMode = "organize" | "talk" | "both";

interface ProcessRequest {
  text: string;
  mode: ProcessMode;
  date: string;
  sessionId?: string;
}

function toEntrySummary(entry: JournalEntry) {
  return {
    signifier: entry.signifier,
    text: entry.text,
    metadata: {
      lane: entry.lane,
      priority: entry.priority,
      waiting_on: entry.waiting_on,
      status: entry.status,
    },
  };
}

async function processOrganizeMode(text: string, date: string, sessionId: string) {
  const result = await executeJournalAgent({
    command: text,
    context: {
      currentDate: date,
      currentPage: "daily",
      sessionId,
      recentConversation: getConversationHistory(sessionId, 12),
    },
  });

  return {
    entries: result.createdEntries.map(toEntrySummary),
    aiResponse: result.message,
    ok: result.ok,
  };
}

async function processTalkMode(
  text: string,
  date: string,
  sessionId: string,
): Promise<{ signifier: Signifier; text: string; aiResponse: string; savedToJournal: boolean }> {
  const history = getConversationHistory(sessionId);

  const systemPrompt = `You are Jynx, a helpful AI assistant integrated into Gutter, a personal journaling app. The user is in Talk mode, where they're having a natural conversation with you.

Your role:
- Have natural, helpful conversations about the user's day, thoughts, and plans
- Ask thoughtful follow-up questions to help them think through things
- Be concise but warm and engaging
- Remember context from earlier in the conversation
- Help them process their thoughts, not just store them
- If they mention tasks or plans, gently ask clarifying questions
- Keep responses under 3 sentences unless more detail is specifically needed

This is a conversation, not task extraction. Be conversational, not transactional.`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: text },
  ];

  let aiResponse = "I hear you. What else is on your mind?";
  try {
    const completion = await generateCompletion({
      messages,
      temperature: 0.8,
      maxTokens: 200,
    });
    aiResponse = completion.content || aiResponse;
  } catch (error) {
    console.error("Error generating AI response:", error);
  }

  const explicitSave = /^(remember|don't forget|recall|keep in mind|note to self|save this|log this|jot this down)/i.test(text.trim());
  const isMemory = /^(remember|don't forget|recall|keep in mind|note to self)/i.test(text.trim());
  const signifier: Signifier = isMemory ? "memory" : "note";

  if (explicitSave) {
    const saveResult = await executeJournalAgent({
      command: `Save this as a ${signifier}: ${text}`,
      context: {
        currentDate: date,
        currentPage: "daily",
        sessionId,
        recentConversation: history,
      },
    });

    return {
      signifier,
      text,
      aiResponse,
      savedToJournal: saveResult.ok && saveResult.createdEntries.length > 0,
    };
  }

  return { signifier, text, aiResponse, savedToJournal: false };
}

export async function POST(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 20,
  });
  if (limited) return limited;

  try {
    const body: ProcessRequest = await req.json();
    const { text, mode, date } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!mode || !["organize", "talk", "both"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const sessionId = body.sessionId || `session-${date}`;
    saveConversationMessage(sessionId, date, "user", text);

    const result: any = { mode, original: text };

    if (mode === "organize") {
      const organized = await processOrganizeMode(text, date, sessionId);
      result.entries = organized.entries;
      result.conversational = {
        aiResponse: organized.aiResponse,
        savedToJournal: false,
        signifier: organized.entries[0]?.signifier || "note",
        text,
      };
    } else if (mode === "talk") {
      result.conversational = await processTalkMode(text, date, sessionId);
    } else if (mode === "both") {
      const organized = await processOrganizeMode(text, date, sessionId);
      result.entries = organized.entries;
      result.conversational = await processTalkMode(text, date, sessionId);
    }

    if (result.conversational?.aiResponse) {
      saveConversationMessage(sessionId, date, "assistant", result.conversational.aiResponse);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Transcript processing error:", error);
    return NextResponse.json({ error: "Failed to process transcript" }, { status: 500 });
  }
}
