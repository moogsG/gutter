import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { generateCompletion, getLLMInfo } from "@/lib/llm-router";

// Mock fetch globally
const originalFetch = global.fetch;
let mockFetch: any;

beforeEach(() => {
	mockFetch = (url: string, options?: any) => {
		// Store the request for assertions
		mockFetch.lastUrl = url;
		mockFetch.lastOptions = options;

		// Return mock responses based on URL
		if (url.includes("localhost:11434") || url.includes("ollama")) {
			return Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						message: {
							content: "Test response from Ollama",
							tool_calls: [],
						},
						prompt_eval_count: 100,
						eval_count: 50,
					}),
			} as any);
		}

		if (url.includes("openai")) {
			return Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [
							{
								message: {
									content: "Test response from OpenAI",
									tool_calls: [],
								},
							},
						],
						usage: {
							prompt_tokens: 100,
							completion_tokens: 50,
							total_tokens: 150,
						},
					}),
			} as any);
		}

		if (url.includes("anthropic")) {
			return Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						content: [
							{
								type: "text",
								text: "Test response from Anthropic",
							},
						],
						usage: {
							input_tokens: 100,
							output_tokens: 50,
						},
					}),
			} as any);
		}

		if (url.includes("generativelanguage")) {
			return Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						candidates: [
							{
								content: {
									parts: [
										{
											text: "Test response from Google",
										},
									],
								},
							},
						],
						usageMetadata: {
							promptTokenCount: 100,
							candidatesTokenCount: 50,
							totalTokenCount: 150,
						},
					}),
			} as any);
		}

		return Promise.resolve({
			ok: false,
			status: 404,
			statusText: "Not Found",
			text: () => Promise.resolve("Not Found"),
		} as any);
	};

	global.fetch = mockFetch as any;
});

afterEach(() => {
	global.fetch = originalFetch;
	// Clear env vars
	delete process.env.LLM_PROVIDER;
	delete process.env.LLM_MODEL;
	delete process.env.LLM_API_KEY;
	delete process.env.LLM_BASE_URL;
});

// ─── Configuration Tests ─────────────────────────────────────────────

describe("getLLMInfo()", () => {
	test("returns default provider (ollama)", () => {
		const info = getLLMInfo();
		expect(info.provider).toBe("ollama");
		expect(info.model).toBe("llama3.1:8b");
	});

	test("returns configured provider", () => {
		process.env.LLM_PROVIDER = "openai";
		process.env.LLM_MODEL = "gpt-4o";

		const info = getLLMInfo();
		expect(info.provider).toBe("openai");
		expect(info.model).toBe("gpt-4o");
	});
});

// ─── Ollama Provider Tests ───────────────────────────────────────────

describe("Ollama provider", () => {
	beforeEach(() => {
		process.env.LLM_PROVIDER = "ollama";
	});

	test("makes request to correct endpoint", async () => {
		await generateCompletion({
			messages: [{ role: "user", content: "Hello" }],
		});

		expect(mockFetch.lastUrl).toContain("localhost:11434/api/chat");
	});

	test("sends correct payload format", async () => {
		await generateCompletion({
			messages: [{ role: "user", content: "Test" }],
			temperature: 0.5,
		});

		const payload = JSON.parse(mockFetch.lastOptions.body);
		expect(payload.model).toBe("llama3.1:8b");
		expect(payload.messages).toEqual([{ role: "user", content: "Test" }]);
		expect(payload.options.temperature).toBe(0.5);
		expect(payload.stream).toBe(false);
	});

	test("includes tools when provided", async () => {
		await generateCompletion({
			messages: [{ role: "user", content: "Test" }],
			tools: [
				{
					type: "function",
					function: {
						name: "test_tool",
						description: "Test",
						parameters: { type: "object", properties: {} },
					},
				},
			],
		});

		const payload = JSON.parse(mockFetch.lastOptions.body);
		expect(payload.tools).toBeDefined();
		expect(payload.tools[0].function.name).toBe("test_tool");
	});

	test("parses response correctly", async () => {
		const response = await generateCompletion({
			messages: [{ role: "user", content: "Test" }],
		});

		expect(response.content).toBe("Test response from Ollama");
		expect(response.usage?.promptTokens).toBe(100);
		expect(response.usage?.completionTokens).toBe(50);
		expect(response.usage?.totalTokens).toBe(150);
	});
});

// ─── OpenAI Provider Tests ───────────────────────────────────────────

describe("OpenAI provider", () => {
	beforeEach(() => {
		process.env.LLM_PROVIDER = "openai";
		process.env.LLM_API_KEY = "sk-test-key";
	});

	test("makes request to correct endpoint", async () => {
		await generateCompletion({
			messages: [{ role: "user", content: "Hello" }],
		});

		expect(mockFetch.lastUrl).toContain("api.openai.com/v1/chat/completions");
	});

	test("includes API key in headers", async () => {
		await generateCompletion({
			messages: [{ role: "user", content: "Test" }],
		});

		expect(mockFetch.lastOptions.headers.Authorization).toBe(
			"Bearer sk-test-key",
		);
	});

	test("sends correct payload format", async () => {
		await generateCompletion({
			messages: [{ role: "user", content: "Test" }],
			temperature: 0.8,
			maxTokens: 1000,
		});

		const payload = JSON.parse(mockFetch.lastOptions.body);
		expect(payload.model).toBe("gpt-4o");
		expect(payload.temperature).toBe(0.8);
		expect(payload.max_tokens).toBe(1000);
	});

	test("parses response correctly", async () => {
		const response = await generateCompletion({
			messages: [{ role: "user", content: "Test" }],
		});

		expect(response.content).toBe("Test response from OpenAI");
		expect(response.usage?.totalTokens).toBe(150);
	});
});

// ─── Anthropic Provider Tests ────────────────────────────────────────

describe("Anthropic provider", () => {
	beforeEach(() => {
		process.env.LLM_PROVIDER = "anthropic";
		process.env.LLM_API_KEY = "sk-ant-test";
	});

	test("makes request to correct endpoint", async () => {
		await generateCompletion({
			messages: [{ role: "user", content: "Hello" }],
		});

		expect(mockFetch.lastUrl).toContain("api.anthropic.com/v1/messages");
	});

	test("includes correct headers", async () => {
		await generateCompletion({
			messages: [{ role: "user", content: "Test" }],
		});

		expect(mockFetch.lastOptions.headers["x-api-key"]).toBe("sk-ant-test");
		expect(mockFetch.lastOptions.headers["anthropic-version"]).toBe(
			"2023-06-01",
		);
	});

	test("separates system message", async () => {
		await generateCompletion({
			messages: [
				{ role: "system", content: "You are helpful" },
				{ role: "user", content: "Test" },
			],
		});

		const payload = JSON.parse(mockFetch.lastOptions.body);
		expect(payload.system).toBe("You are helpful");
		expect(payload.messages).toEqual([{ role: "user", content: "Test" }]);
	});

	test("parses response correctly", async () => {
		const response = await generateCompletion({
			messages: [{ role: "user", content: "Test" }],
		});

		expect(response.content).toBe("Test response from Anthropic");
		expect(response.usage?.promptTokens).toBe(100);
		expect(response.usage?.completionTokens).toBe(50);
	});
});

// ─── Google Provider Tests ───────────────────────────────────────────

describe("Google provider", () => {
	beforeEach(() => {
		process.env.LLM_PROVIDER = "google";
		process.env.LLM_API_KEY = "AIza-test";
	});

	test("makes request to correct endpoint", async () => {
		await generateCompletion({
			messages: [{ role: "user", content: "Hello" }],
		});

		expect(mockFetch.lastUrl).toContain("generativelanguage.googleapis.com");
		expect(mockFetch.lastUrl).toContain("key=AIza-test");
	});

	test("converts messages to Gemini format", async () => {
		await generateCompletion({
			messages: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
			],
		});

		const payload = JSON.parse(mockFetch.lastOptions.body);
		expect(payload.contents[0].role).toBe("user");
		expect(payload.contents[1].role).toBe("model");
		expect(payload.contents[0].parts[0].text).toBe("Hello");
	});

	test("parses response correctly", async () => {
		const response = await generateCompletion({
			messages: [{ role: "user", content: "Test" }],
		});

		expect(response.content).toBe("Test response from Google");
		expect(response.usage?.totalTokens).toBe(150);
	});
});

// ─── Error Handling Tests ────────────────────────────────────────────

describe("Error handling", () => {
	test("throws on unsupported provider", async () => {
		process.env.LLM_PROVIDER = "invalid";

		await expect(
			generateCompletion({
				messages: [{ role: "user", content: "Test" }],
			}),
		).rejects.toThrow("Unsupported LLM provider");
	});

	test("throws on API error", async () => {
		process.env.LLM_PROVIDER = "ollama";
		process.env.LLM_BASE_URL = "http://invalid.local";

		global.fetch = (() =>
			Promise.resolve({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				text: () => Promise.resolve("Error details"),
			})) as any;

		await expect(
			generateCompletion({
				messages: [{ role: "user", content: "Test" }],
			}),
		).rejects.toThrow("Ollama API error: 500");
	});
});
