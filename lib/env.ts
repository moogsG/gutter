/**
 * Centralized environment validation.
 * Import `env` anywhere to get typed, validated config.
 * Throws at startup if required vars are missing.
 */

function required(key: string): string {
	const val = process.env[key];
	if (!val) throw new Error(`Missing required env var: ${key}`);
	return val;
}

function optional(key: string, fallback: string): string {
	return process.env[key] || fallback;
}

function optionalInt(key: string, fallback: number): number {
	const val = process.env[key];
	return val ? parseInt(val, 10) : fallback;
}

function optionalBool(key: string, fallback: boolean): boolean {
	const val = process.env[key];
	if (!val) return fallback;
	return val === "true" || val === "1";
}

function parseList(key: string, fallback: string): string[] {
	const raw = process.env[key] || fallback;
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function parsePipeList(key: string): Array<{ id: string; name: string }> {
	const raw = process.env[key] || "";
	if (!raw) return [];
	return raw
		.split(",")
		.map((pair) => {
			const [id, name] = pair.split("|");
			return { id: id?.trim(), name: name?.trim() };
		})
		.filter((p) => p.id && p.name);
}

// ─── Validated config ────────────────────────────────────────────────

export const env = {
	// Server
	port: optionalInt("PORT", 3000),
	host: optional("HOST", "localhost"),

	// Auth
	authPasswordHash: optional("AUTH_PASSWORD_HASH", ""),
	authSecret: optional("AUTH_SECRET", "gutter-default-secret-change-me"),
	sessionMaxAge: optionalInt("SESSION_MAX_AGE_DAYS", 30),

	// Database
	databasePath: optional("DATABASE_PATH", "./gutter-journal.db"),

	// Theme
	defaultTheme: optional("DEFAULT_THEME", "cyberpink"),

	// Calendars
	calendars: parseList("CALENDARS", "Calendar,Family Calendar,Home,JW,School"),

	// Ollama
	ollamaUrl: optional("OLLAMA_URL", "http://localhost:11434"),
	ollamaModel: optional("OLLAMA_MODEL", "qwen3:latest"),
	journalCommandModel: optional("JOURNAL_COMMAND_MODEL", "qwen3:latest"),

	// Jira
	jiraUrl: optional("JIRA_URL", ""),
	jiraEmail: optional("JIRA_EMAIL", ""),
	jiraApiToken: optional("JIRA_API_TOKEN", ""),
	get jiraEnabled() {
		return !!(this.jiraUrl && this.jiraEmail && this.jiraApiToken);
	},

	// Slack
	slackBotToken: optional("SLACK_BOT_TOKEN", ""),
	slackChannels: parsePipeList("SLACK_CHANNELS"),
	get slackEnabled() {
		return !!(this.slackBotToken && this.slackChannels.length);
	},

	// Whisper
	whisperModelPath: optional("WHISPER_MODEL_PATH", ""),

	// Calendar CLI
	calendarEnabled: optionalBool("CALENDAR_ENABLED", true),
	calendarCli: optional("CALENDAR_CLI", "npx @joargp/accli"),
	calendarDefaultName: optional("CALENDAR_DEFAULT_NAME", "Home"),
	calendarCacheDurationMs: optionalInt("CALENDAR_CACHE_DURATION_MS", 300000),
} as const;
