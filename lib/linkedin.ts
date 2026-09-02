import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getOpenClawWorkspacePath } from "@/lib/paths";
import type { LinkedInBoardData, LinkedInAnalyticsPost, LinkedInIdeaGroup, LinkedInPostLogEntry, OptionalSourceState } from "@/types";

const WORKSPACE_PATH = getOpenClawWorkspacePath();
const LINKEDIN_IDEAS_PATH = join(WORKSPACE_PATH, "linkedin-post-ideas.md");
const LINKEDIN_LOG_PATH = join(WORKSPACE_PATH, "linkedin-post-log.md");
const LINKEDIN_ANALYTICS_PATH = join(WORKSPACE_PATH, "linkedin-analytics.json");

type LinkedInAnalyticsFile = {
  posts?: LinkedInAnalyticsPost[];
};

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}

function parseBulletLines(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function parseNumberedLines(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, "").trim());
}

function parseIdeaGroups(markdown: string, heading: string): LinkedInIdeaGroup[] {
  const section = extractSection(markdown, heading);
  if (!section) return [];

  const matches = [...section.matchAll(/### (.+)\n([\s\S]*?)(?=\n### |$)/g)];
  return matches.map((match) => ({
    label: match[1].trim(),
    items: heading === "Concrete Post Prompts" ? parseNumberedLines(match[2]) : parseBulletLines(match[2]),
  }));
}

function parseDrafts(markdown: string) {
  const section = extractSection(markdown, "Drafts Ready To Tighten");
  if (!section) return [];

  const matches = [...section.matchAll(/### (.+)\n([\s\S]*?)(?=\n### |$)/g)];
  return matches.map((match) => {
    const content = match[2].trim();
    const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
    return {
      title: match[1].trim(),
      excerpt: lines.slice(0, 5).join(" "),
      wordCount: content.split(/\s+/).filter(Boolean).length,
      content,
    };
  });
}

function parsePostLog(markdown: string): LinkedInPostLogEntry[] {
  const matches = [...markdown.matchAll(/## (\d{4}-\d{2}-\d{2}) - (.+)\n([\s\S]*?)(?=\n## \d{4}-\d{2}-\d{2} - |\s*$)/g)];
  return matches.map((match) => {
    const body = match[3];
    return {
      date: match[1],
      label: match[2].trim(),
      status: body.match(/- Status:\s*(.+)/)?.[1]?.trim() ?? "unknown",
      type: body.match(/- Type:\s*(.+)/)?.[1]?.trim() ?? "unknown",
      goal: body.match(/- Goal:\s*(.+)/)?.[1]?.trim() ?? "unknown",
      hook: body.match(/- Hook:\s*(.+)/)?.[1]?.trim() ?? "",
      reviewWorked: body.match(/- What worked:\s*(.+)/)?.[1]?.trim() ?? "",
      reviewFailed: body.match(/- What did not:\s*(.+)/)?.[1]?.trim() ?? "",
      patternToReuse: body.match(/- Pattern to reuse:\s*(.+)/)?.[1]?.trim() ?? "",
      ruleUpdate: body.match(/- Rule update:\s*(.+)/)?.[1]?.trim() ?? "",
    };
  });
}

function buildNextMove(postingGapDays: number | null, drafts: ReturnType<typeof parseDrafts>) {
  if (drafts.length > 0) {
    return `Tighten "${drafts[0].title}" and ship it instead of pretending more idea collection is the bottleneck.`;
  }
  if (postingGapDays !== null && postingGapDays > 45) {
    return `It has been ${postingGapDays} days since the last logged post. Pick one strong hook and break the drought.`;
  }
  return "Review the best-performing pattern, choose one angle, and draft a post before the week gets away again.";
}

export async function buildLinkedInBoard(requestedDate: string): Promise<LinkedInBoardData> {
  let ideasMarkdown = "";
  let postLogMarkdown = "";
  let analyticsJson = '{"posts":[]}';
  let source: OptionalSourceState;
  try {
    [ideasMarkdown, postLogMarkdown, analyticsJson] = await Promise.all([
      readFile(LINKEDIN_IDEAS_PATH, "utf8"),
      readFile(LINKEDIN_LOG_PATH, "utf8"),
      readFile(LINKEDIN_ANALYTICS_PATH, "utf8"),
    ]);
    const hasContent = Boolean(ideasMarkdown.trim() || postLogMarkdown.trim() || JSON.parse(analyticsJson).posts?.length);
    source = {
      state: hasContent ? "ready" : "empty",
      message: hasContent ? "LinkedIn planning data loaded." : "LinkedIn planning files contain no data.",
      recovery: null,
    };
  } catch {
    const notConfigured = !existsSync(WORKSPACE_PATH);
    ideasMarkdown = "";
    postLogMarkdown = "";
    analyticsJson = '{"posts":[]}';
    source = {
      state: notConfigured ? "not-configured" : "unavailable",
      message: notConfigured
        ? "Set OPENCLAW_WORKSPACE_PATH to load LinkedIn planning data."
        : "LinkedIn planning data is unavailable. Check the workspace and retry.",
      recovery: notConfigured ? "configure" : "retry",
    };
  }

  const analytics = JSON.parse(analyticsJson) as LinkedInAnalyticsFile;
  const posts = (analytics.posts ?? []).sort((a, b) => b.date.localeCompare(a.date));
  const drafts = parseDrafts(ideasMarkdown);
  const postLog = parsePostLog(postLogMarkdown);
  const latestLoggedPost = [...postLog].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const bestPost = [...posts].sort((a, b) => (b.metrics?.impressions ?? 0) - (a.metrics?.impressions ?? 0))[0] ?? null;
  const latestAnalyticsPost = posts[0] ?? null;
  const postingGapDays = latestLoggedPost ? daysBetween(latestLoggedPost.date, requestedDate) : null;

  return {
    source,
    requestedDate,
    generatedAt: new Date().toISOString(),
    headline: postingGapDays && postingGapDays > 60
      ? `LinkedIn has been quiet for ${postingGapDays} days. The ideas are not the problem.`
      : "One place to turn existing LinkedIn strategy into an actual next move.",
    nextMove: buildNextMove(postingGapDays, drafts),
    postingGapDays,
    overview: {
      totalLoggedPosts: postLog.length,
      reviewedPosts: postLog.filter((post) => post.status === "reviewed").length,
      draftCount: drafts.length,
      readyHooks: parseBulletLines(extractSection(ideasMarkdown, "Strong Hooks")).length,
    },
    themeBank: parseIdeaGroups(ideasMarkdown, "Core Themes"),
    prompts: parseIdeaGroups(ideasMarkdown, "Concrete Post Prompts"),
    hooks: parseBulletLines(extractSection(ideasMarkdown, "Strong Hooks")),
    angles: parseBulletLines(extractSection(ideasMarkdown, "High-Value Post Angles")),
    drafts,
    postLog,
    analyticsPosts: posts,
    bestPost,
    latestPost: latestLoggedPost,
    latestAnalyticsPost,
  };
}
