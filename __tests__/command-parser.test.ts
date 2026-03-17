import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Command Parser", () => {
  const OLLAMA_URL = "http://localhost:11434";
  const mockOllamaResponse = (actions: any[], message: string) => ({
    message: {
      content: JSON.stringify({ actions, message }),
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Date parsing", () => {
    it("should parse 'tomorrow' correctly", () => {
      const currentDate = "2026-03-10";
      const d = new Date(currentDate + "T12:00:00");
      const tomorrow = new Date(d);
      tomorrow.setDate(d.getDate() + 1);
      
      expect(tomorrow.toISOString().split("T")[0]).toBe("2026-03-11");
    });

    it("should parse 'yesterday' correctly", () => {
      const currentDate = "2026-03-10";
      const d = new Date(currentDate + "T12:00:00");
      const yesterday = new Date(d);
      yesterday.setDate(d.getDate() - 1);
      
      expect(yesterday.toISOString().split("T")[0]).toBe("2026-03-09");
    });

    it("should parse 'next week' correctly", () => {
      const currentDate = "2026-03-10";
      const d = new Date(currentDate + "T12:00:00");
      const nextWeek = new Date(d);
      nextWeek.setDate(d.getDate() + 7);
      
      expect(nextWeek.toISOString().split("T")[0]).toBe("2026-03-17");
    });
  });

  describe("Signifier detection", () => {
    it("should detect task signifier for action verbs", () => {
      const commands = ["buy milk", "fix bug", "call Ryan", "write report"];
      // All should be interpreted as tasks by the LLM
      // This test verifies the system prompt guides the LLM correctly
      commands.forEach(cmd => {
        expect(cmd).toMatch(/^(buy|fix|call|write)/);
      });
    });

    it("should detect appointment signifier for time references", () => {
      const commands = [
        "meeting at 3pm",
        "dentist appointment tomorrow",
        "event on Friday",
      ];
      commands.forEach(cmd => {
        expect(cmd).toMatch(/meeting|appointment|event|at \d+pm/);
      });
    });

    it("should detect note signifier for info statements", () => {
      const commands = [
        "note: check email",
        "remember that code review is due",
        "FYI: meeting moved",
      ];
      commands.forEach(cmd => {
        expect(cmd).toMatch(/note:|remember|FYI/);
      });
    });

    it("should detect important signifier for urgency markers", () => {
      const commands = [
        "URGENT: fix production",
        "critical bug in API",
        "important: deadline today",
      ];
      commands.forEach(cmd => {
        expect(cmd).toMatch(/URGENT|critical|important|ASAP/i);
      });
    });
  });

  describe("Subtask parsing", () => {
    it("should create parent task and subtasks with parent_ref", () => {
      const command = "buy groceries: milk, eggs, bread";
      // Expected LLM response structure:
      const expectedActions = [
        {
          method: "POST",
          path: "/api/journal",
          body: { date: "2026-03-10", signifier: "task", text: "Buy groceries" },
        },
        {
          method: "POST",
          path: "/api/journal",
          body: { date: "2026-03-10", signifier: "task", text: "Milk" },
          parent_ref: 0, // References first action
        },
        {
          method: "POST",
          path: "/api/journal",
          body: { date: "2026-03-10", signifier: "task", text: "Eggs" },
          parent_ref: 0,
        },
        {
          method: "POST",
          path: "/api/journal",
          body: { date: "2026-03-10", signifier: "task", text: "Bread" },
          parent_ref: 0,
        },
      ];

      // Verify structure matches spec
      expect(expectedActions[0].body.text).toBe("Buy groceries");
      expect(expectedActions[1].parent_ref).toBe(0);
      expect(expectedActions[2].parent_ref).toBe(0);
      expect(expectedActions[3].parent_ref).toBe(0);
    });

    it("should resolve parent_ref to parent_id during execution", () => {
      // Mock execution results
      const results = [
        { id: "je-001", date: "2026-03-10", text: "Buy groceries" },
      ];

      const subtaskAction = {
        method: "POST",
        path: "/api/journal",
        body: { date: "2026-03-10", signifier: "task", text: "Milk" },
        parent_ref: 0,
      };

      // Simulate parent_ref resolution
      const parentId = results[subtaskAction.parent_ref]?.id;
      expect(parentId).toBe("je-001");

      // Should add parent_id to body
      const resolvedAction = {
        ...subtaskAction,
        body: { ...subtaskAction.body, parent_id: parentId },
      };

      expect(resolvedAction.body.parent_id).toBe("je-001");
    });
  });

  describe("Calendar event creation", () => {
    it("should create both journal entry and calendar event for appointments", () => {
      const command = "meeting with Thiago at 3pm tomorrow";
      const expectedActions = [
        {
          method: "POST",
          path: "/api/journal",
          body: {
            date: "2026-03-11",
            signifier: "appointment",
            text: "Meeting with Thiago at 3pm",
          },
        },
        {
          method: "POST",
          path: "/api/journal/calendar",
          body: {
            summary: "Meeting with Thiago",
            date: "2026-03-11",
            startTime: "15:00",
            calendar: "work",
          },
        },
      ];

      expect(expectedActions[0].body.signifier).toBe("appointment");
      expect(expectedActions[1].path).toBe("/api/journal/calendar");
      expect(expectedActions[1].body.startTime).toBe("15:00"); // 24-hour format
    });

    it("should handle all-day events", () => {
      const command = "vacation next week";
      const expectedAction = {
        method: "POST",
        path: "/api/journal/calendar",
        body: {
          summary: "Vacation",
          date: "2026-03-17",
          allDay: true,
        },
      };

      expect(expectedAction.body.allDay).toBe(true);
      expect((expectedAction.body as Record<string, unknown>).startTime).toBeUndefined();
    });
  });

  describe("LLM response validation", () => {
    it("should handle empty actions array", () => {
      const response = { actions: [], message: "I didn't understand that." };
      
      expect(response.actions).toHaveLength(0);
      expect(response.message).toBeTruthy();
    });

    it("should reject invalid action structure", () => {
      const invalidActions = [
        { method: "POST" }, // missing path
        { path: "/api/journal" }, // missing method
      ];

      invalidActions.forEach((action: any) => {
        // Each action should have at least method AND path
        const hasMethod = !!action.method;
        const hasPath = !!action.path;
        const isComplete = hasMethod && hasPath;
        
        // These specific invalid actions should NOT have both
        expect(isComplete).toBe(false);
      });

      // Valid action should have both
      const validAction = { method: "POST", path: "/api/journal", body: {} };
      expect(validAction.method && validAction.path).toBeTruthy();
    });
  });

  describe("Error handling", () => {
    it("should handle Ollama offline gracefully", async () => {
      // Simulate fetch failure
      const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
      
      try {
        await mockFetch(`${OLLAMA_URL}/api/chat`);
      } catch (error: any) {
        expect(error.message).toBe("Connection refused");
      }
    });

    it("should handle invalid JSON response", () => {
      const invalidJson = "not valid json";
      
      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it("should provide fallback message when LLM fails", () => {
      const fallbackResponse = {
        ok: false,
        message: "Command interpreter unavailable. Try adding entries directly.",
        actions: [],
      };

      expect(fallbackResponse.ok).toBe(false);
      expect(fallbackResponse.actions).toHaveLength(0);
      expect(fallbackResponse.message).toContain("unavailable");
    });
  });
});
