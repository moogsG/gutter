import { beforeEach, describe, expect, it, vi } from "vitest";

const executeJournalAgent = vi.fn();
const getConversationHistory = vi.fn();
const saveConversationMessage = vi.fn();
const generateCompletion = vi.fn();

vi.mock("@/lib/journal-agent", () => ({
  executeJournalAgent,
  getConversationHistory,
  saveConversationMessage,
}));

vi.mock("@/lib/llm-router", () => ({
  generateCompletion,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitMiddleware: vi.fn(() => null),
}));

describe("/api/journal/transcript/process", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getConversationHistory.mockReturnValue([]);
    generateCompletion.mockResolvedValue({ content: "Absolutely, I can help with that." });
  });

  it("uses the journal agent for organize mode and returns created entries", async () => {
    executeJournalAgent.mockResolvedValue({
      ok: true,
      message: "Added both events to your calendar.",
      actions: [],
      createdEntries: [
        {
          id: "je-1",
          date: "2026-04-20",
          signifier: "appointment",
          text: "Anniversary Party at 7pm",
          status: "open",
          lane: null,
          priority: null,
          waiting_on: null,
          tags: [],
          sort_order: 0,
          created_at: "now",
          updated_at: "now",
        },
      ],
      updatedEntries: [],
    });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/journal/transcript/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Add these to my calendar",
        mode: "organize",
        date: "2026-04-20",
        sessionId: "session-1",
      }),
    }) as any);

    const json = await response.json();
    expect(executeJournalAgent).toHaveBeenCalledWith(expect.objectContaining({
      command: "Add these to my calendar",
      context: expect.objectContaining({ sessionId: "session-1" }),
    }));
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0]).toMatchObject({ signifier: "appointment", text: "Anniversary Party at 7pm" });
    expect(saveConversationMessage).toHaveBeenCalledWith("session-1", "2026-04-20", "user", "Add these to my calendar");
    expect(saveConversationMessage).toHaveBeenCalledWith("session-1", "2026-04-20", "assistant", "Added both events to your calendar.");
  });

  it("can save an explicit talk-mode memory via the journal agent", async () => {
    executeJournalAgent.mockResolvedValue({
      ok: true,
      message: "Saved it.",
      actions: [],
      createdEntries: [
        {
          id: "je-2",
          date: "2026-04-20",
          signifier: "memory",
          text: "Remember this: bring flowers",
          status: "open",
          tags: [],
          sort_order: 0,
          created_at: "now",
          updated_at: "now",
        },
      ],
      updatedEntries: [],
    });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/journal/transcript/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Remember this: bring flowers",
        mode: "talk",
        date: "2026-04-20",
        sessionId: "session-2",
      }),
    }) as any);

    const json = await response.json();
    expect(generateCompletion).toHaveBeenCalled();
    expect(executeJournalAgent).toHaveBeenCalledWith(expect.objectContaining({
      command: expect.stringContaining("Save this as a memory"),
    }));
    expect(json.conversational.savedToJournal).toBe(true);
    expect(saveConversationMessage).toHaveBeenCalledWith("session-2", "2026-04-20", "assistant", "Absolutely, I can help with that.");
  });
});
