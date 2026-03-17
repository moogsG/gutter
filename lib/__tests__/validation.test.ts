/**
 * Tests for lib/validation.ts
 */

import { describe, expect, it } from "vitest";
import {
	parseJsonBody,
	sanitizeMarkdown,
	sanitizeText,
	validateId,
	validateJournalEntry,
	validateTask,
} from "@/lib/validation";

describe("sanitizeText()", () => {
	it("escapes HTML special characters", () => {
		const input = '<script>alert("xss")</script>';
		const output = sanitizeText(input);
		expect(output).toBe(
			"&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;",
		);
		expect(output).not.toContain("<");
		expect(output).not.toContain(">");
	});

	it("handles quotes and apostrophes", () => {
		expect(sanitizeText(`"Hello"`)).toBe("&quot;Hello&quot;");
		expect(sanitizeText("It's great")).toBe("It&#x27;s great");
	});

	it("trims whitespace", () => {
		expect(sanitizeText("  hello  ")).toBe("hello");
	});

	it("returns empty string for null/undefined", () => {
		expect(sanitizeText(null)).toBe("");
		expect(sanitizeText(undefined)).toBe("");
	});

	it("escapes forward slashes", () => {
		expect(sanitizeText("a/b/c")).toBe("a&#x2F;b&#x2F;c");
	});
});

describe("sanitizeMarkdown()", () => {
	it("removes script tags", () => {
		const input =
			'# Heading\n<script>alert("xss")</script>\nSome text\n<script src="evil.js"></script>';
		const output = sanitizeMarkdown(input);
		expect(output).not.toContain("<script");
		expect(output).toContain("# Heading");
		expect(output).toContain("Some text");
	});

	it("removes inline event handlers", () => {
		const input = '<a href="#" onclick="alert(1)">Link</a>';
		const output = sanitizeMarkdown(input);
		expect(output).not.toContain("onclick=");
	});

	it("removes javascript: protocol", () => {
		const input = '<a href="javascript:alert(1)">Link</a>';
		const output = sanitizeMarkdown(input);
		expect(output).not.toContain("javascript:");
	});

	it("trims whitespace", () => {
		expect(sanitizeMarkdown("  markdown  ")).toBe("markdown");
	});

	it("returns empty string for null/undefined", () => {
		expect(sanitizeMarkdown(null)).toBe("");
		expect(sanitizeMarkdown(undefined)).toBe("");
	});

	it("preserves basic markdown", () => {
		const input = "# Title\n**bold** *italic* `code`";
		const output = sanitizeMarkdown(input);
		expect(output).toBe(input);
	});

	it("removes various event handlers", () => {
		const input = '<div onload="evil()" onmouseover="bad()"></div>';
		const output = sanitizeMarkdown(input);
		expect(output).not.toContain("onload=");
		expect(output).not.toContain("onmouseover=");
	});
});

describe("validateJournalEntry()", () => {
	it("validates valid entry", () => {
		const result = validateJournalEntry({
			content: "My journal entry",
			tags: ["personal", "idea"],
			project: "Gutter",
		});

		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.sanitized?.content).toBe("My journal entry");
		expect(result.sanitized?.tags).toEqual(["personal", "idea"]);
	});

	it("rejects non-string content", () => {
		const result = validateJournalEntry({ content: 123 });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Content must be a string");
	});

	it("rejects content exceeding 50000 characters", () => {
		const result = validateJournalEntry({ content: "a".repeat(50001) });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"Content exceeds maximum length (50000 characters)",
		);
	});

	it("rejects non-array tags", () => {
		const result = validateJournalEntry({ tags: "not-an-array" });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Tags must be an array");
	});

	it("rejects tags with non-string elements", () => {
		const result = validateJournalEntry({ tags: ["valid", 123, "also-valid"] });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("All tags must be strings");
	});

	it("rejects more than 20 tags", () => {
		const tags = Array(21).fill("tag");
		const result = validateJournalEntry({ tags });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Maximum 20 tags allowed");
	});

	it("rejects non-string project", () => {
		const result = validateJournalEntry({ project: 123 });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Project must be a string");
	});

	it("rejects project exceeding 100 characters", () => {
		const result = validateJournalEntry({ project: "a".repeat(101) });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Project name too long (max 100 characters)");
	});

	it("sanitizes valid input", () => {
		const result = validateJournalEntry({
			content: '<script>alert("xss")</script>**bold**',
			tags: ["<script>tag</script>", "normal"],
			project: '<a href="#">Project</a>',
		});

		expect(result.valid).toBe(true);
		expect(result.sanitized?.content).not.toContain("<script");
		expect(result.sanitized?.tags[0]).not.toContain("<");
		expect(result.sanitized?.project).not.toContain("<");
	});

	it("truncates long tags to 50 characters", () => {
		const result = validateJournalEntry({
			tags: ["a".repeat(100)],
		});

		expect(result.valid).toBe(true);
		expect(result.sanitized?.tags[0]).toHaveLength(50);
	});

	it("allows empty/undefined fields", () => {
		const result = validateJournalEntry({});
		expect(result.valid).toBe(true);
	});
});

describe("validateTask()", () => {
	it("validates valid task", () => {
		const result = validateTask({
			title: "Fix bug",
			description: "Fix the auth issue",
			project: "Gutter",
			priority: "high",
			status: "in-progress",
		});

		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.sanitized?.title).toBe("Fix bug");
	});

	it("rejects non-string title", () => {
		const result = validateTask({ title: 123 });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Title must be a string");
	});

	it("rejects empty title", () => {
		const result = validateTask({ title: "" });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Title cannot be empty");
	});

	it("rejects title exceeding 500 characters", () => {
		const result = validateTask({ title: "a".repeat(501) });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Title too long (max 500 characters)");
	});

	it("rejects non-string description", () => {
		const result = validateTask({ description: 123 });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Description must be a string");
	});

	it("rejects description exceeding 10000 characters", () => {
		const result = validateTask({ description: "a".repeat(10001) });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Description too long (max 10000 characters)");
	});

	it("rejects non-string project", () => {
		const result = validateTask({ project: 123 });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Project must be a string");
	});

	it("rejects non-string priority", () => {
		const result = validateTask({ priority: 123 });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Priority must be a string");
	});

	it("rejects invalid priority value", () => {
		const result = validateTask({ priority: "super-urgent" });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Invalid priority value");
	});

	it("accepts valid priority values", () => {
		const priorities = ["low", "medium", "high", "urgent"];
		for (const priority of priorities) {
			const result = validateTask({ title: "Test", priority });
			expect(result.valid).toBe(true);
		}
	});

	it("rejects non-string status", () => {
		const result = validateTask({ status: 123 });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Status must be a string");
	});

	it("rejects invalid status value", () => {
		const result = validateTask({ status: "pending" });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Invalid status value");
	});

	it("accepts valid status values", () => {
		const statuses = ["open", "in-progress", "blocked", "done", "cancelled"];
		for (const status of statuses) {
			const result = validateTask({ title: "Test", status });
			expect(result.valid).toBe(true);
		}
	});

	it("sanitizes task fields", () => {
		const result = validateTask({
			title: '<script>alert("xss")</script>',
			description: "**bold** <script>bad</script>",
			project: "<tag>",
		});

		expect(result.valid).toBe(true);
		expect(result.sanitized?.title).not.toContain("<");
		expect(result.sanitized?.description).not.toContain("<script");
		expect(result.sanitized?.project).not.toContain("<");
	});

	it("allows undefined fields", () => {
		const result = validateTask({});
		expect(result.valid).toBe(true);
	});
});

describe("validateId()", () => {
	it("accepts valid numeric ID", () => {
		const result = validateId(123);
		expect(result.valid).toBe(true);
	});

	it("accepts valid string ID", () => {
		const result = validateId("abc-123");
		expect(result.valid).toBe(true);
	});

	it("rejects non-string/non-number", () => {
		const result = validateId({});
		expect(result.valid).toBe(false);
		expect(result.error).toBe("ID must be a string or number");
	});

	it("rejects SQL injection patterns", () => {
		const malicious = [
			"1; DROP TABLE users",
			"1' OR '1'='1",
			'1" OR "1"="1',
			"1 UNION SELECT * FROM users",
			"1--",
		];

		for (const id of malicious) {
			const result = validateId(id);
			expect(result.valid).toBe(false);
			expect(result.error).toBe("Invalid ID format");
		}
	});

	it("rejects ID less than 1", () => {
		const result = validateId(0);
		expect(result.valid).toBe(false);
		expect(result.error).toBe("ID out of valid range");
	});

	it("rejects ID greater than MAX_SAFE_INTEGER", () => {
		const result = validateId(Number.MAX_SAFE_INTEGER + 1);
		expect(result.valid).toBe(false);
		expect(result.error).toBe("ID out of valid range");
	});

	it("accepts alphanumeric IDs", () => {
		const result = validateId("abc123def");
		expect(result.valid).toBe(true);
	});
});

describe("parseJsonBody()", () => {
	it("parses valid JSON request", async () => {
		const req = new Request("http://localhost", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "test" }),
		});

		const result = await parseJsonBody(req);
		expect(result.success).toBe(true);
		expect(result.data).toEqual({ name: "test" });
	});

	it("rejects non-JSON content type", async () => {
		const req = new Request("http://localhost", {
			method: "POST",
			headers: { "content-type": "text/plain" },
			body: "plain text",
		});

		const result = await parseJsonBody(req);
		expect(result.success).toBe(false);
		expect(result.error).toBe("Content-Type must be application/json");
	});

	it("rejects invalid JSON", async () => {
		const req = new Request("http://localhost", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "not valid json{",
		});

		const result = await parseJsonBody(req);
		expect(result.success).toBe(false);
		expect(result.error).toBe("Invalid JSON in request body");
	});

	it("handles missing content-type header", async () => {
		const req = new Request("http://localhost", {
			method: "POST",
			body: JSON.stringify({ name: "test" }),
		});

		const result = await parseJsonBody(req);
		expect(result.success).toBe(false);
	});

	it("accepts content-type with charset", async () => {
		const req = new Request("http://localhost", {
			method: "POST",
			headers: { "content-type": "application/json; charset=utf-8" },
			body: JSON.stringify({ name: "test" }),
		});

		const result = await parseJsonBody(req);
		expect(result.success).toBe(true);
	});
});
