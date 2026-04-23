/**
 * LLM Router — Unified interface for multiple LLM providers
 * 
 * Supports:
 * - Ollama (local, default)
 * - OpenAI API
 * - Anthropic API
 * - Google Gemini API
 * 
 * Configurable via ENV:
 *   LLM_PROVIDER - Provider name (ollama|openai|anthropic|google) default: ollama
 *   LLM_MODEL    - Model identifier (provider-specific)
 *   LLM_API_KEY  - API key for cloud providers (not needed for Ollama)
 *   LLM_BASE_URL - Base URL (for Ollama or custom endpoints)
 */

// ─── Types ───────────────────────────────────────────────────────────

export type LLMProvider = "ollama" | "openai" | "anthropic" | "google";

export interface LLMMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface LLMToolCall {
	id: string;
	name: string;
	arguments: Record<string, any>;
}

export interface LLMToolResult {
	tool_call_id: string;
	content: string;
}

export interface LLMTool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<string, any>;
			required?: string[];
		};
	};
}

export interface LLMRequest {
	messages: LLMMessage[];
	tools?: LLMTool[];
	temperature?: number;
	maxTokens?: number;
}

export interface LLMResponse {
	content: string;
	toolCalls?: LLMToolCall[];
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

// ─── Configuration ───────────────────────────────────────────────────

const getConfig = () => {
	const provider = (process.env.LLM_PROVIDER || "ollama") as LLMProvider;
	
	// Provider-specific defaults
	const defaults = {
		ollama: {
			// Prefer project-wide OLLAMA_URL/OLLAMA_MODEL env vars (used across gutter),
			// with LLM_* as explicit override layer on top.
			baseUrl: process.env.LLM_BASE_URL || process.env.OLLAMA_URL || "http://localhost:11434",
			model: process.env.LLM_MODEL || process.env.OLLAMA_MODEL || process.env.JOURNAL_COMMAND_MODEL || "qwen3:latest",
		},
		openai: {
			baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
			model: process.env.LLM_MODEL || "gpt-4o",
		},
		anthropic: {
			baseUrl: process.env.LLM_BASE_URL || "https://api.anthropic.com/v1",
			model: process.env.LLM_MODEL || "claude-sonnet-4",
		},
		google: {
			baseUrl: process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
			model: process.env.LLM_MODEL || "gemini-2.0-flash-exp",
		},
	};

	return {
		provider,
		apiKey: process.env.LLM_API_KEY,
		...defaults[provider],
	};
};

// ─── Provider Implementations ────────────────────────────────────────

/**
 * Ollama provider (local inference, tool calling via native API)
 */
async function callOllama(req: LLMRequest): Promise<LLMResponse> {
	const config = getConfig();
	const url = `${config.baseUrl}/api/chat`;

	const payload: any = {
		model: config.model,
		messages: req.messages,
		stream: false,
		options: {
			temperature: req.temperature ?? 0.7,
		},
	};

	if (req.tools) {
		payload.tools = req.tools;
	}

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();
	
	// Ollama response format
	const content = data.message?.content || "";
	const toolCalls = data.message?.tool_calls?.map((tc: any) => ({
		id: tc.id || crypto.randomUUID(),
		name: tc.function.name,
		arguments: tc.function.arguments,
	}));

	return {
		content,
		toolCalls,
		usage: {
			promptTokens: data.prompt_eval_count || 0,
			completionTokens: data.eval_count || 0,
			totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
		},
	};
}

/**
 * OpenAI provider (GPT-4o, etc)
 */
async function callOpenAI(req: LLMRequest): Promise<LLMResponse> {
	const config = getConfig();
	const url = `${config.baseUrl}/chat/completions`;

	const payload: any = {
		model: config.model,
		messages: req.messages,
		temperature: req.temperature ?? 0.7,
		max_tokens: req.maxTokens,
	};

	if (req.tools) {
		payload.tools = req.tools;
		payload.tool_choice = "auto";
	}

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();
	const choice = data.choices[0];
	const content = choice.message.content || "";
	const toolCalls = choice.message.tool_calls?.map((tc: any) => ({
		id: tc.id,
		name: tc.function.name,
		arguments: JSON.parse(tc.function.arguments),
	}));

	return {
		content,
		toolCalls,
		usage: {
			promptTokens: data.usage.prompt_tokens,
			completionTokens: data.usage.completion_tokens,
			totalTokens: data.usage.total_tokens,
		},
	};
}

/**
 * Anthropic provider (Claude Sonnet, Opus, Haiku)
 */
async function callAnthropic(req: LLMRequest): Promise<LLMResponse> {
	const config = getConfig();
	const url = `${config.baseUrl}/messages`;

	// Anthropic separates system messages
	const systemMessage = req.messages.find((m) => m.role === "system");
	const messages = req.messages.filter((m) => m.role !== "system");

	const payload: any = {
		model: config.model,
		max_tokens: req.maxTokens || 4096,
		temperature: req.temperature ?? 0.7,
		messages,
	};

	if (systemMessage) {
		payload.system = systemMessage.content;
	}

	if (req.tools) {
		payload.tools = req.tools.map((t) => ({
			name: t.function.name,
			description: t.function.description,
			input_schema: t.function.parameters,
		}));
	}

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.apiKey || "",
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();
	
	// Extract text content and tool calls
	let content = "";
	const toolCalls: LLMToolCall[] = [];

	for (const block of data.content) {
		if (block.type === "text") {
			content += block.text;
		} else if (block.type === "tool_use") {
			toolCalls.push({
				id: block.id,
				name: block.name,
				arguments: block.input,
			});
		}
	}

	return {
		content,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		usage: {
			promptTokens: data.usage.input_tokens,
			completionTokens: data.usage.output_tokens,
			totalTokens: data.usage.input_tokens + data.usage.output_tokens,
		},
	};
}

/**
 * Google Gemini provider (Gemini 2.0 Flash, Pro)
 */
async function callGoogle(req: LLMRequest): Promise<LLMResponse> {
	const config = getConfig();
	const url = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;

	// Convert messages to Gemini format
	const contents = req.messages
		.filter((m) => m.role !== "system") // Gemini doesn't support system messages directly
		.map((m) => ({
			role: m.role === "assistant" ? "model" : "user",
			parts: [{ text: m.content }],
		}));

	const payload: any = {
		contents,
		generationConfig: {
			temperature: req.temperature ?? 0.7,
			maxOutputTokens: req.maxTokens,
		},
	};

	// Note: Gemini tool support is different and more limited
	// For now, we don't support tools with Gemini (silently ignored)

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Google API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();
	const candidate = data.candidates[0];
	const content = candidate.content.parts[0].text;

	return {
		content,
		usage: {
			promptTokens: data.usageMetadata?.promptTokenCount || 0,
			completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
			totalTokens: data.usageMetadata?.totalTokenCount || 0,
		},
	};
}

// ─── Main Router ─────────────────────────────────────────────────────

/**
 * Generate a completion using the configured LLM provider
 */
export async function generateCompletion(req: LLMRequest): Promise<LLMResponse> {
	const config = getConfig();

	switch (config.provider) {
		case "ollama":
			return callOllama(req);
		case "openai":
			return callOpenAI(req);
		case "anthropic":
			return callAnthropic(req);
		case "google":
			return callGoogle(req);
		default:
			throw new Error(`Unsupported LLM provider: ${config.provider}`);
	}
}

/**
 * Helper: Get current provider info (for debugging/logging)
 */
export function getLLMInfo(): { provider: LLMProvider; model: string } {
	const config = getConfig();
	return {
		provider: config.provider,
		model: config.model,
	};
}
