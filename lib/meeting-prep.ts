/**
 * Meeting Prep — Provider-agnostic LLM-powered meeting preparation
 * 
 * Uses the LLM router to support Ollama, OpenAI, Anthropic, or Google.
 * Gathers context from Jira, Slack, daily notes, and vector store.
 * 
 * NOTE: Tool calling support varies by provider:
 * - Ollama: Full support (native tool calling API)
 * - OpenAI: Full support (function calling)
 * - Anthropic: Full support (tool use)
 * - Google: Limited (tools not yet implemented in llm-router)
 */

import { getDateNightData } from "@/lib/date-night";
import { generateCompletion, getLLMInfo, type LLMMessage, type LLMTool } from "@/lib/llm-router";
import { getOpenClawWorkspacePath } from "@/lib/paths";
import { searchMeetingContext } from "@/lib/vector-store";
import { getJournalDate } from "@/lib/journal-date";

type MeetingPrepMode = "work" | "relationship" | "spiritual" | "personal";

// ─── Vector context helper ────────────────────────────────────────────

async function fetchVectorContext(title: string): Promise<string> {
	try {
		const results = await searchMeetingContext(title, 5);
		if (!results.length) return "";

		const lines = results.map(
			(r) =>
				`[${r.date}] ${r.title !== `Journal: ${r.date}` ? `(${r.title}) ` : ""}${r.text}`,
		);

		return `\n\n## Past Journal Context (semantic search)\n${lines.join("\n")}`;
	} catch {
		return "";
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────

function parseSlackChannels(): string {
	const raw = process.env.SLACK_CHANNELS || "";
	if (!raw) return "No Slack channels configured (set SLACK_CHANNELS in .env)";
	return raw
		.split(",")
		.map((pair) => {
			const [id, name] = pair.split("|");
			return `- ${id} = #${name}`;
		})
		.join("\n");
}

function formatMeetingDate(time: string): string {
	const parsed = new Date(time);
	if (Number.isNaN(parsed.getTime())) return time;
	return parsed.toLocaleString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function getOccurrenceDate(time: string): string {
	const parsed = new Date(time);
	if (Number.isNaN(parsed.getTime())) {
		return getJournalDate();
	}
	return getJournalDate(parsed);
}

function classifyMeetingPrep(calendar: string, title: string): MeetingPrepMode {
	const lowerCalendar = calendar.toLowerCase();
	const lowerTitle = title.toLowerCase();

	if (lowerCalendar === "gradient" || lowerCalendar === "calendar") {
		return "work";
	}

	if (
		lowerTitle.includes("jess") ||
		lowerTitle.includes("date") ||
		lowerTitle.includes("check-in")
	) {
		return "relationship";
	}

	if (
		lowerCalendar === "jw" ||
		lowerTitle.includes("watchtower") ||
		lowerTitle.includes("public talk") ||
		lowerTitle.includes("theocratic school")
	) {
		return "spiritual";
	}

	return "personal";
}

async function generateRelationshipPrep(
	title: string,
	time: string,
	context?: string,
): Promise<string> {
	const requestedDate = getOccurrenceDate(time);
	const relationship = await getDateNightData(requestedDate);
	const nextMoves = relationship.partner.nextMoves.length
		? relationship.partner.nextMoves.map((move) => `- ${move}`).join("\n")
		: "- Show up calm, present, and willing to listen before you defend yourself.";
	const favorites = relationship.partner.favorites
		.map((item) => `- ${item}`)
		.join("\n");
	const questions = relationship.prep?.questions.length
		? relationship.prep.questions
				.slice(0, 4)
				.map((question) => `- ${question}`)
				.join("\n")
		: "- What has felt heavy lately that we keep skating past?\n- What would help you feel more connected this week?\n- What do you want more of from us besides default-TV gravity?";
	const tips = relationship.prep?.tips.length
		? relationship.prep.tips.map((tip) => `- ${tip}`).join("\n")
		: "- Listen longer than feels comfortable.\n- Do not turn everything into logistics.\n- Leave with one concrete next move on the calendar.";
	const latestGesture = relationship.lastGesture
		? `${relationship.lastGesture.date} — ${relationship.lastGesture.gesture} (${relationship.lastGesture.cost})`
		: "No recent gesture logged.";
	const extraContext = context?.trim()
		? `\n## Added Context\n${context.trim()}\n`
		: "";

	return `# ${title}
**When:** ${formatMeetingDate(time)}
**Why this matters:** Relationship support gets fake fast when this stays as a calendar label instead of a real conversation.

## Current Signal
- Status: ${relationship.status}
- Headline: ${relationship.headline}
- Next event on deck: ${relationship.nextEvent?.title || "None found"}
- Last logged gesture: ${latestGesture}

## Best Moves Before You Walk In
${nextMoves}

## Questions Worth Asking
${questions}

## Jess Context To Remember
${favorites}

## How Not To Fumble It
${tips}
${extraContext}
## Done Means
- You leave with one concrete plan or date on the calendar.
- Any promise or follow-up gets captured in Gutter instead of trusted to your sloppy memory.
`;
}

function generateSpiritualPrep(
	title: string,
	time: string,
	context?: string,
): string {
	const lowerTitle = title.toLowerCase();
	const focusSection = lowerTitle.includes("public talk")
		? `## Public Talk Focus
- Confirm the theme, timing, and main through-line before rehearsal.
- Tighten the opening and closing so they land clean instead of wandering.
- Rehearse out loud with a timer, not just in your head.
`
		: lowerTitle.includes("theocratic school")
			? `## School Focus
- Confirm assignment type, timing, and source material.
- Practice transitions and any demonstration parts out loud.
- Trim notes enough that you can speak naturally.
`
			: `## Meeting Focus
- Confirm what material or assignment is tied to this meeting.
- Review the one point you want fresh in your head.
- Set out notes and anything needed before the last-minute scramble.
`;
	const extraContext = context?.trim()
		? `\n## Added Context\n${context.trim()}\n`
		: "";

	return `# ${title}
**When:** ${formatMeetingDate(time)}
**Why this matters:** Spiritual prep gets uglier when it stays vague until the same day.

## Tonight's Prep Checklist
- Confirm exact assignment, material, and duration.
- Pick the single main point you want to deliver clearly.
- Rehearse once out loud before the day gets noisy.
- Set out notes, Bible, clothes, and anything else now.

${focusSection}${extraContext}## Done Means
- You know your opening line.
- You know your closing line.
- You are not relying on adrenaline to rescue weak prep.
`;
}

function generatePersonalPrep(
	title: string,
	time: string,
	context?: string,
): string {
	const extraContext = context?.trim()
		? `\n## Added Context\n${context.trim()}\n`
		: "";

	return `# ${title}
**When:** ${formatMeetingDate(time)}

## Prep Checklist
- Clarify the purpose of this event in one sentence.
- Decide what outcome would make it worth the time.
- Gather anything you need before the day starts.
- Leave one note for your future self in Gutter if there is follow-up.
${extraContext}
## Keep It Simple
- Show up prepared.
- Capture the next action.
- Do not make future-you clean up preventable confusion.
`;
}

// ─── Tool definitions ────────────────────────────────────────────────

const tools: LLMTool[] = [
	{
		type: "function",
		function: {
			name: "search_jira",
			description:
				"Search Jira issues using JQL. Returns issue keys, summaries, statuses, and descriptions.",
			parameters: {
				type: "object",
				properties: {
					jql: {
						type: "string",
						description:
							"JQL query string. ONLY query project = GDEV or project = ISE. Never use other projects.",
					},
					maxResults: {
						type: "number",
						description: "Max results to return (default 5)",
					},
				},
				required: ["jql"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "search_slack",
			description:
				"Read recent messages from a Slack channel. Returns last N messages with author and text.",
			parameters: {
				type: "object",
				properties: {
					channel: {
						type: "string",
						description:
							"Slack channel ID (e.g. C029BN2FBPD for #team-hardcore-developer-chat)",
					},
					limit: {
						type: "number",
						description: "Number of messages to fetch (default 15)",
					},
					query: {
						type: "string",
						description: "Optional keyword to filter messages by",
					},
				},
				required: ["channel"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "search_memory",
			description:
				"Search the local memory/notes files for past context about a topic. Uses keyword matching on markdown files.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Search query for memory files",
					},
				},
				required: ["query"],
			},
		},
	},
];

// ─── Tool implementations ────────────────────────────────────────────

async function searchJira(jql: string, maxResults = 5): Promise<string> {
	const url = process.env.JIRA_URL;
	const email = process.env.JIRA_EMAIL;
	const token = process.env.JIRA_API_TOKEN;

	if (!url) return "Error: JIRA_URL not set in environment";
	if (!email) return "Error: JIRA_EMAIL not set in environment";
	if (!token) return "Error: JIRA_API_TOKEN not set in environment";

	try {
		const scopedJql = jql.replace(
			/project\s*=\s*(?!GDEV|ISE)[A-Z]+/gi,
			"project in (GDEV, ISE)",
		);
		const finalJql = scopedJql.includes("project")
			? scopedJql
			: `project in (GDEV, ISE) AND (${scopedJql})`;

		const res = await fetch(`${url}/rest/api/3/search/jql`, {
			method: "POST",
			headers: {
				Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				jql: finalJql,
				maxResults,
				fields: [
					"summary",
					"status",
					"assignee",
					"updated",
					"priority",
					"labels",
					"description",
				],
			}),
		});

		if (!res.ok) return `Jira API error: ${res.status} ${await res.text()}`;

		const data = await res.json();
		const issues = (data.issues || []).map(
			(i: any) =>
				`${i.key}: ${i.fields?.summary} [${i.fields?.status?.name}]\n  Assignee: ${i.fields?.assignee?.displayName || "Unassigned"}\n  Priority: ${i.fields?.priority?.name || "None"}\n  Updated: ${i.fields?.updated}`,
		);
		return issues.length
			? issues.join("\n\n")
			: "No matching Jira issues found.";
	} catch (err: any) {
		return `Jira search failed: ${err.message}`;
	}
}

async function searchSlack(
	channel: string,
	limit = 15,
	query?: string,
): Promise<string> {
	const token = process.env.SLACK_BOT_TOKEN;
	if (!token) return "Error: SLACK_BOT_TOKEN not set in environment";

	try {
		const res = await fetch(
			`https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`,
			{ headers: { Authorization: `Bearer ${token}` } },
		);
		const data = await res.json();
		if (!data.ok) return `Slack API error: ${data.error}`;

		let messages = (data.messages || []).map(
			(m: any) =>
				`[${new Date(parseFloat(m.ts) * 1000).toISOString()}] ${m.user}: ${m.text}`,
		);

		if (query) {
			const q = query.toLowerCase();
			messages = messages.filter((m: string) => m.toLowerCase().includes(q));
		}

		return messages.length
			? messages.reverse().join("\n")
			: "No matching Slack messages found.";
	} catch (err: any) {
		return `Slack search failed: ${err.message}`;
	}
}

async function searchMemory(query: string): Promise<string> {
	const { execSync } = await import("node:child_process");
	const fs = await import("node:fs");
	try {
		const memDir = `${getOpenClawWorkspacePath()}/memory`;
		const keywords = query
			.toLowerCase()
			.split(/\s+/)
			.filter((k) => k.length > 2);

		if (keywords.length === 0) return "No search keywords provided.";

		const results: string[] = [];

		try {
			const files = execSync(`ls -t ${memDir}/2*.md 2>/dev/null | head -14`, {
				encoding: "utf-8",
			})
				.trim()
				.split("\n")
				.filter(Boolean);

			for (const file of files) {
				const content = fs.readFileSync(file, "utf-8");
				const lines = content.split("\n");
				const fname = file.split("/").pop();

				let inPersonalSection = false;
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i].toLowerCase();
					if (
						line.includes("## adhd") ||
						line.includes("## personal") ||
						line.includes("## family") ||
						line.includes("## habits")
					) {
						inPersonalSection = true;
						continue;
					}
					if (line.startsWith("## ") && inPersonalSection) {
						inPersonalSection = false;
					}
					if (inPersonalSection) continue;

					if (keywords.some((k) => line.includes(k))) {
						const start = Math.max(0, i - 2);
						const end = Math.min(lines.length, i + 3);
						results.push(
							`[${fname}:${i + 1}]\n${lines.slice(start, end).join("\n")}`,
						);
					}
				}
			}
		} catch {}

		return results.length
			? results.slice(0, 10).join("\n---\n")
			: "No matching entries found in recent daily notes.";
	} catch (err: any) {
		return `Memory search failed: ${err.message}`;
	}
}

async function executeTool(
	name: string,
	args: Record<string, any>,
): Promise<string> {
	switch (name) {
		case "search_jira":
			return searchJira(args.jql, args.maxResults);
		case "search_slack":
			return searchSlack(args.channel, args.limit, args.query);
		case "search_memory":
			return searchMemory(args.query);
		default:
			return `Unknown tool: ${name}`;
	}
}

// ─── Main generation function ────────────────────────────────────────

async function generateWorkMeetingPrep(
	title: string,
	time: string,
	calendar: string,
	context?: string,
): Promise<string> {
	const vectorContext = await fetchVectorContext(title).catch(() => "");

	const systemPrompt = `You are a professional meeting prep assistant for a Staff Engineer at Gradient MSP. Your job is to gather relevant WORK context and write concise, actionable prep notes.

IMPORTANT RULES:
- ONLY include information relevant to the meeting topic at WORK
- NEVER include personal information, health details, family details, habits, or personal productivity systems
- Stick strictly to Jira tickets, Slack discussions, PRs, and work-related notes
- If a tool returns no results, say "No data found" — do NOT fill in with unrelated content

You have tools to search Jira, Slack, and daily work notes. Use them to find:
- Related Jira tickets, PRs, and their statuses
- Recent team discussions in Slack about the topic
- Past work decisions from daily notes

Slack channels you can read (pick based on meeting topic):
${parseSlackChannels()}

NOTE: Only use channels listed above. Other channels will return errors.

Jira projects to query: GDEV and ISE ONLY. Never query MSPC or any other project.

Write your final prep notes in markdown with these sections:
- **Context** — what this meeting is about (based on the title and calendar)
- **Key Discussion Points** — what to talk about
- **Recent Activity** — relevant tickets, PRs, Slack discussions found via tools
- **Action Items / Questions** — things to raise or follow up on

Be concise. No fluff. Only work-relevant content.`;

	const messages: LLMMessage[] = [
		{ role: "system", content: systemPrompt },
		{
			role: "user",
			content: `Prepare me for the meeting: "${title}" at ${time} (Calendar: ${calendar}).${context ? `\n\nAdditional context: ${context}` : ""}${vectorContext}

Use the tools to search for relevant information, then write prep notes.`,
		},
	];

	// Tool calling loop (max 5 iterations to prevent infinite loops)
	const maxIterations = 5;
	for (let i = 0; i < maxIterations; i++) {
		const response = await generateCompletion({
			messages,
			tools,
			temperature: 0.7,
		});

		// Add assistant response to history
		messages.push({
			role: "assistant",
			content: response.content,
		});

		// If no tool calls, we're done
		if (!response.toolCalls || response.toolCalls.length === 0) {
			return response.content || "No prep notes generated.";
		}

		// Execute each tool call and add results as user messages
		for (const call of response.toolCalls) {
			const result = await executeTool(call.name, call.arguments);
			messages.push({
				role: "user",
				content: `Tool result for ${call.name}:\n${result}`,
			});
		}
	}

	// If we hit max iterations, ask for final response without more tools
	messages.push({
		role: "user",
		content:
			"Based on all the information gathered, write the final prep notes now (no more tool calls).",
	});

	const finalResponse = await generateCompletion({
		messages,
		temperature: 0.7,
	});

	return finalResponse.content || "Failed to generate prep notes.";
}

export async function generateMeetingPrep(
	title: string,
	time: string,
	calendar: string,
	context?: string,
): Promise<string> {
	switch (classifyMeetingPrep(calendar, title)) {
		case "relationship":
			return generateRelationshipPrep(title, time, context);
		case "spiritual":
			return generateSpiritualPrep(title, time, context);
		case "personal":
			return generatePersonalPrep(title, time, context);
		default:
			return generateWorkMeetingPrep(title, time, calendar, context);
	}
}
