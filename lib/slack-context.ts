import { env } from "@/lib/env";

interface SlackConversationMessage {
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
}

interface SlackHistoryResponse {
  ok: boolean;
  messages?: SlackConversationMessage[];
  error?: string;
}

interface SlackRepliesResponse {
  ok: boolean;
  messages?: SlackConversationMessage[];
  error?: string;
}

interface SlackUsersInfoResponse {
  ok: boolean;
  user?: {
    id: string;
    real_name?: string;
    profile?: {
      display_name?: string;
      real_name?: string;
    };
  };
  error?: string;
}

export interface SlackContextThreadItem {
  channelId: string;
  channelName: string;
  threadTs: string;
  latestTs: string;
  title: string;
  summary: string;
  reason: "mention" | "thread" | "name" | "channel";
  priorityScore: number;
  participants: string[];
  messageCount: number;
  unreadishCount: number;
  url: string;
}

export interface SlackContextData {
  generatedAt: string;
  workspaceHint: string | null;
  channelsScanned: number;
  items: SlackContextThreadItem[];
  fallbackItems: SlackContextThreadItem[];
}

const TARGET_USER_ID = "U028WN16C2C";
const TARGET_NAMES = ["moogs", "morgan", "morgan greff"];
const BASE_URL = "https://slack.com/api";
const WORKSPACE_ID = "T02877QAJSF";

async function slackFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${env.slackBotToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Slack request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function getChannelUrl(channelId: string, threadTs: string): string {
  return `https://app.slack.com/client/${WORKSPACE_ID}/${channelId}/thread/${channelId}-${threadTs.replace(".", "")}`;
}

function toText(message: SlackConversationMessage): string {
  return (message.text || "").trim();
}

function scoreMessage(
  text: string,
  inThread: boolean,
): { reason: SlackContextThreadItem["reason"]; score: number } | null {
  const lower = text.toLowerCase();

  if (text.includes(`<@${TARGET_USER_ID}>`)) {
    return { reason: "mention", score: 100 };
  }

  if (TARGET_NAMES.some((name) => lower.includes(name))) {
    return { reason: "name", score: 70 };
  }

  if (inThread) {
    return { reason: "thread", score: 85 };
  }

  return null;
}

function summarizeThread(
  channelName: string,
  messages: SlackConversationMessage[],
  reason: SlackContextThreadItem["reason"],
): string {
  const cleaned = messages
    .map((message) => toText(message).replace(/<@U[0-9A-Z]+>/g, "@user"))
    .filter(Boolean)
    .slice(-4);

  const latest = cleaned[cleaned.length - 1] || "New Slack activity";
  const prefix =
    reason === "mention"
      ? "Direct mention"
      : reason === "thread"
        ? "Thread update"
        : reason === "name"
          ? "Named context"
          : "Channel update";

  return `${prefix} in #${channelName}: ${latest}`;
}

async function getUserLabel(userId: string): Promise<string> {
  if (!userId) return "unknown";

  try {
    const data = await slackFetch<SlackUsersInfoResponse>(
      `/users.info?user=${encodeURIComponent(userId)}`,
    );

    if (!data.ok || !data.user) return userId;

    return (
      data.user.profile?.display_name ||
      data.user.real_name ||
      data.user.profile?.real_name ||
      data.user.id
    );
  } catch {
    return userId;
  }
}

export async function fetchSlackContext(): Promise<SlackContextData> {
  if (!env.slackBotToken || env.slackChannels.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      workspaceHint: null,
      channelsScanned: 0,
      items: [],
      fallbackItems: [],
    };
  }

  const threads: SlackContextThreadItem[] = [];
  const fallbackThreads: SlackContextThreadItem[] = [];

  for (const channel of env.slackChannels) {
    const history = await slackFetch<SlackHistoryResponse>(
      `/conversations.history?channel=${encodeURIComponent(channel.id)}&limit=40`,
    );

    if (!history.ok || !history.messages) continue;

    const messages = [...history.messages].reverse();

    for (const message of messages) {
      const text = toText(message);
      const rootTs = message.thread_ts || message.ts;
      const isThreadRoot = (message.reply_count || 0) > 0;
      const inThread = !!message.thread_ts && message.thread_ts !== message.ts;
      const baseScore = scoreMessage(text, inThread);

      let threadMessages = [message];
      if (isThreadRoot || inThread) {
        try {
          const replies = await slackFetch<SlackRepliesResponse>(
            `/conversations.replies?channel=${encodeURIComponent(channel.id)}&ts=${encodeURIComponent(rootTs)}`,
          );
          if (replies.ok && replies.messages && replies.messages.length > 0) {
            threadMessages = replies.messages;
          }
        } catch {
          // Ignore thread fetch failures in V1.
        }
      }

      const youParticipated = threadMessages.some((entry) => entry.user === TARGET_USER_ID);
      const scored =
        baseScore ||
        (youParticipated && threadMessages.length > 1
          ? { reason: "thread" as const, score: 85 }
          : null);

      const participantIds = Array.from(
        new Set(threadMessages.map((entry) => entry.user).filter(Boolean)),
      ) as string[];
      const participants = await Promise.all(
        participantIds.slice(0, 5).map((userId) => getUserLabel(userId)),
      );
      const latestTs = threadMessages[threadMessages.length - 1]?.ts || rootTs;

      if (scored) {
        threads.push({
          channelId: channel.id,
          channelName: channel.name,
          threadTs: rootTs,
          latestTs,
          title: text || "Slack thread",
          summary: summarizeThread(channel.name, threadMessages, scored.reason),
          reason: scored.reason,
          priorityScore: scored.score + Math.min(threadMessages.length, 10),
          participants,
          messageCount: threadMessages.length,
          unreadishCount: Math.max(0, threadMessages.length - (youParticipated ? 1 : 0)),
          url: getChannelUrl(channel.id, rootTs),
        });
        continue;
      }

      const cleanedText = toText(threadMessages[threadMessages.length - 1] || message).replace(/<@U[0-9A-Z]+>/g, "@user");
      if (!cleanedText) continue;

      fallbackThreads.push({
        channelId: channel.id,
        channelName: channel.name,
        threadTs: rootTs,
        latestTs,
        title: text || "Slack update",
        summary: `General update in #${channel.name}: ${cleanedText}`,
        reason: "channel",
        priorityScore: Math.min(threadMessages.length, 10),
        participants,
        messageCount: threadMessages.length,
        unreadishCount: Math.max(0, threadMessages.length - (youParticipated ? 1 : 0)),
        url: getChannelUrl(channel.id, rootTs),
      });
    }
  }

  const deduped = Array.from(
    new Map(threads.map((item) => [`${item.channelId}:${item.threadTs}`, item])).values(),
  ).sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return b.latestTs.localeCompare(a.latestTs);
  });

  const dedupedFallback = Array.from(
    new Map(fallbackThreads.map((item) => [`${item.channelId}:${item.threadTs}`, item])).values(),
  ).sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return b.latestTs.localeCompare(a.latestTs);
  });

  return {
    generatedAt: new Date().toISOString(),
    workspaceHint: WORKSPACE_ID,
    channelsScanned: env.slackChannels.length,
    items: deduped.slice(0, 20),
    fallbackItems: dedupedFallback.slice(0, 20),
  };
}
