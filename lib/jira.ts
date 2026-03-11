// Jira integration module
// Shared utilities for fetching and updating Jira issues

// Configuration
export const JIRA_ENABLED = process.env.JIRA_ENABLED !== "false";
export const JIRA_HOST = process.env.JIRA_HOST || "";
export const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
export const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
export const JIRA_PROJECT = process.env.JIRA_PROJECT || "GDEV";
export const RETRY_ATTEMPTS = parseInt(process.env.JIRA_RETRY_ATTEMPTS || "3", 10);
export const RETRY_DELAY_MS = parseInt(process.env.JIRA_RETRY_DELAY_MS || "1000", 10);
export const CACHE_DURATION_MS = parseInt(process.env.JIRA_CACHE_DURATION_MS || "300000", 10); // 5 min

// Issue status mapping
export const STATUS_MAP: Record<string, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
  blocked: "Blocked",
};

// Simple in-memory cache
interface JiraCache {
  issues: JiraIssue[] | null;
  lastSync: number | null;
  lastError: string | null;
  lastSuccess: boolean;
}

export const jiraCache: JiraCache = {
  issues: null,
  lastSync: null,
  lastError: null,
  lastSuccess: false,
};

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority: string;
  assignee: string | null;
  url: string;
  updated: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAuthHeader(): string {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error("JIRA_EMAIL and JIRA_API_TOKEN must be set");
  }
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  return `Basic ${auth}`;
}

async function fetchWithRetry(url: string, options: RequestInit, attempts = RETRY_ATTEMPTS): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jira API error: ${response.status} - ${error}`);
      }

      jiraCache.lastSync = Date.now();
      jiraCache.lastSuccess = true;
      jiraCache.lastError = null;

      return response;
    } catch (error: any) {
      const isLastAttempt = i === attempts - 1;
      
      if (isLastAttempt) {
        jiraCache.lastError = error.message;
        jiraCache.lastSuccess = false;
        throw error;
      }

      // Exponential backoff
      const delay = RETRY_DELAY_MS * (i + 1);
      await sleep(delay);
    }
  }

  throw new Error("Max retry attempts reached");
}

export async function fetchAssignedIssues(forceRefresh = false): Promise<JiraIssue[]> {
  if (!JIRA_ENABLED) {
    throw new Error("Jira integration is disabled");
  }

  if (!JIRA_HOST) {
    throw new Error("JIRA_HOST is not configured");
  }

  // Return cached issues if still valid
  if (!forceRefresh && jiraCache.issues && jiraCache.lastSync) {
    const cacheAge = Date.now() - jiraCache.lastSync;
    if (cacheAge < CACHE_DURATION_MS) {
      return jiraCache.issues;
    }
  }

  const jql = encodeURIComponent(
    `project = ${JIRA_PROJECT} AND assignee = currentUser() AND status != Done ORDER BY priority DESC, updated DESC`
  );

  const url = `https://${JIRA_HOST}/rest/api/3/search?jql=${jql}&fields=summary,status,priority,assignee,updated&maxResults=50`;

  const response = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  const issues: JiraIssue[] = (data.issues || []).map((issue: any) => ({
    id: issue.id,
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || "Unknown",
    priority: issue.fields.priority?.name || "Medium",
    assignee: issue.fields.assignee?.displayName || null,
    url: `https://${JIRA_HOST}/browse/${issue.key}`,
    updated: issue.fields.updated,
  }));

  // Update cache
  jiraCache.issues = issues;

  return issues;
}

export async function updateIssueStatus(issueKey: string, statusName: string): Promise<void> {
  if (!JIRA_ENABLED) {
    throw new Error("Jira integration is disabled");
  }

  if (!JIRA_HOST) {
    throw new Error("JIRA_HOST is not configured");
  }

  // Get transitions for this issue
  const transitionsUrl = `https://${JIRA_HOST}/rest/api/3/issue/${issueKey}/transitions`;
  
  const transitionsResponse = await fetchWithRetry(transitionsUrl, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });

  const transitionsData = await transitionsResponse.json();
  const transition = transitionsData.transitions?.find(
    (t: any) => t.to.name.toLowerCase() === statusName.toLowerCase()
  );

  if (!transition) {
    throw new Error(`No valid transition to status "${statusName}" for issue ${issueKey}`);
  }

  // Execute transition
  await fetchWithRetry(transitionsUrl, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transition: {
        id: transition.id,
      },
    }),
  });

  // Invalidate cache
  jiraCache.issues = null;
}

export async function createIssue(summary: string, description?: string): Promise<string> {
  if (!JIRA_ENABLED) {
    throw new Error("Jira integration is disabled");
  }

  if (!JIRA_HOST) {
    throw new Error("JIRA_HOST is not configured");
  }

  const url = `https://${JIRA_HOST}/rest/api/3/issue`;

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: {
          key: JIRA_PROJECT,
        },
        summary,
        description: description
          ? {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: description,
                    },
                  ],
                },
              ],
            }
          : undefined,
        issuetype: {
          name: "Task",
        },
      },
    }),
  });

  const data = await response.json();

  // Invalidate cache
  jiraCache.issues = null;

  return data.key;
}

export function getJiraStatus() {
  return {
    enabled: JIRA_ENABLED,
    configured: !!(JIRA_HOST && JIRA_EMAIL && JIRA_API_TOKEN),
    lastSync: jiraCache.lastSync,
    lastSuccess: jiraCache.lastSuccess,
    lastError: jiraCache.lastError,
    cacheValid: jiraCache.lastSync ? Date.now() - jiraCache.lastSync < CACHE_DURATION_MS : false,
    issueCount: jiraCache.issues?.length || 0,
  };
}
