/**
 * Ollama-powered meeting prep with tool calling.
 * Uses Jira REST API, Slack API, memory search, and LanceDB vector context
 * to gather context, then generates prep notes via a local Ollama model.
 *
 * All config via ENV:
 *   OLLAMA_URL          - Ollama base URL (default: http://localhost:11434)
 *   OLLAMA_MODEL        - Model to use (default: llama3.1:8b)
 *   JIRA_URL            - Jira instance URL (default: https://gradient-msp.atlassian.net)
 *   JIRA_EMAIL          - Jira login email
 *   JIRA_API_TOKEN      - Jira API token
 *   SLACK_BOT_TOKEN     - Slack bot token for channel reads
 *   GUTTER_URL          - Gutter base URL for callback (default: http://localhost:3000)
 */

import { searchMeetingContext } from "@/lib/vector-store";

// ─── Vector context helper ────────────────────────────────────────────

/**
 * Fetch relevant past journal entries and meeting transcripts from LanceDB.
 * Returns a formatted string block for injection into the meeting prep prompt.
 * Silently returns empty string on error so it never blocks the main flow.
 */
async function fetchVectorContext(title: string): Promise<string> {
  try {
    const results = await searchMeetingContext(title, 5);
    if (!results.length) return "";

    const lines = results.map(
      (r) => `[${r.date}] ${r.title !== `Journal: ${r.date}` ? `(${r.title}) ` : ""}${r.text}`
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
  return raw.split(",").map((pair) => {
    const [id, name] = pair.split("|");
    return `- ${id} = #${name}`;
  }).join("\n");
}

// ─── Tool definitions ────────────────────────────────────────────────

const tools = [
  {
    type: "function" as const,
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
              'JQL query string. ONLY query project = GDEV or project = ISE. Never use other projects. e.g. \'project in (GDEV, ISE) AND text ~ "security" ORDER BY updated DESC\'',
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
    type: "function" as const,
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
    type: "function" as const,
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

async function searchJira(
  jql: string,
  maxResults = 5
): Promise<string> {
  const url = process.env.JIRA_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!url) return "Error: JIRA_URL not set in environment";
  if (!email) return "Error: JIRA_EMAIL not set in environment";
  if (!token) return "Error: JIRA_API_TOKEN not set in environment";

  try {
    // Enforce project scope — only GDEV and ISE allowed
    const scopedJql = jql.replace(/project\s*=\s*(?!GDEV|ISE)[A-Z]+/gi, 'project in (GDEV, ISE)');
    const finalJql = scopedJql.includes('project') ? scopedJql : `project in (GDEV, ISE) AND (${scopedJql})`;

    // Use REST API v3 search/jql (v2 has been deprecated and removed)
    const res = await fetch(`${url}/rest/api/3/search/jql`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jql: finalJql,
        maxResults,
        fields: ["summary", "status", "assignee", "updated", "priority", "labels", "description"],
      }),
    });

    if (!res.ok) return `Jira API error: ${res.status} ${await res.text()}`;

    const data = await res.json();
    const issues = (data.issues || []).map(
      (i: any) =>
        `${i.key}: ${i.fields?.summary} [${i.fields?.status?.name}]\n  Assignee: ${i.fields?.assignee?.displayName || "Unassigned"}\n  Priority: ${i.fields?.priority?.name || "None"}\n  Updated: ${i.fields?.updated}`
    );
    return issues.length ? issues.join("\n\n") : "No matching Jira issues found.";
  } catch (err: any) {
    return `Jira search failed: ${err.message}`;
  }
}

async function searchSlack(
  channel: string,
  limit = 15,
  query?: string
): Promise<string> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return "Error: SLACK_BOT_TOKEN not set in environment";

  try {
    const res = await fetch(
      `https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.ok) return `Slack API error: ${data.error}`;

    let messages = (data.messages || []).map(
      (m: any) => `[${new Date(parseFloat(m.ts) * 1000).toISOString()}] ${m.user}: ${m.text}`
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
  const { execSync } = await import("child_process");
  const fs = await import("fs");
  try {
    // ONLY search daily notes (memory/YYYY-MM-DD.md) for work context.
    // DO NOT search MEMORY.md, AGENTS.md, SOUL.md, USER.md, or any config files.
    // Those contain personal/private info that should never appear in meeting prep.
    const memDir = `${process.env.HOME}/.openclaw/workspace/memory`;
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);

    if (keywords.length === 0) return "No search keywords provided.";

    const results: string[] = [];

    // Search recent daily notes only (last 14 days)
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

        // Filter out personal sections
        let inPersonalSection = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          // Skip personal/private sections
          if (line.includes("## adhd") || line.includes("## personal") || line.includes("## family") || line.includes("## habits")) {
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
              `[${fname}:${i + 1}]\n${lines.slice(start, end).join("\n")}`
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
  args: Record<string, any>
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

// ─── Ollama chat with tool-calling loop ──────────────────────────────

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, any> };
  }>;
}

export async function generateMeetingPrep(
  title: string,
  time: string,
  calendar: string,
  context?: string
): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";

  // Fetch vector context in parallel with the rest of setup — never blocks
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

  const messages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Prepare me for the meeting: "${title}" at ${time} (Calendar: ${calendar}).${context ? `\n\nAdditional context: ${context}` : ""}${vectorContext}

Use the tools to search for relevant information, then write prep notes.`,
    },
  ];

  const maxIterations = 5;
  for (let i = 0; i < maxIterations; i++) {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        tools,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const assistantMsg = data.message;

    // Add assistant response to history
    messages.push(assistantMsg);

    // If no tool calls, we're done — return the content
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      return assistantMsg.content || "No prep notes generated.";
    }

    // Execute each tool call and add results
    for (const call of assistantMsg.tool_calls) {
      const toolName = call.function.name;
      const toolArgs = call.function.arguments || {};
      const result = await executeTool(toolName, toolArgs);
      messages.push({
        role: "tool",
        content: result,
      });
    }
  }

  // If we hit max iterations, generate a final response without tools
  const finalRes = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        ...messages,
        {
          role: "user",
          content:
            "Based on all the information gathered, write the final prep notes now.",
        },
      ],
      stream: false,
    }),
  });

  const finalData = await finalRes.json();
  return finalData.message?.content || "Failed to generate prep notes.";
}
