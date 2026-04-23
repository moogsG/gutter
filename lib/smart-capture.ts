/**
 * Smart capture utilities - lane, priority, status, and signifier inference from text
 * Shared between quick mode and command mode
 */

import type { TaskLane, TaskPriority, Signifier, EntryStatus } from "@/types/journal";

/**
 * Clean and normalize raw text before submission
 * Handles voice transcription artifacts, whitespace, and common issues
 */
export function cleanCaptureText(text: string): string {
  let cleaned = text;
  
  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // Normalize multiple spaces to single space
  cleaned = cleaned.replace(/\s+/g, " ");
  
  // Fix common voice transcription issues
  // Remove filler words that add no value
  const fillers = /\b(um+|uh+|er+|ah+|like|you know|basically|actually|literally)\b/gi;
  cleaned = cleaned.replace(fillers, "").replace(/\s+/g, " ").trim();
  
  // Capitalize first letter if not already capitalized
  if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }
  
  // Fix spacing around punctuation
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, "$1"); // Remove space before punctuation
  cleaned = cleaned.replace(/([.,!?;:])([^\s])/g, "$1 $2"); // Add space after punctuation
  
  // Normalize ellipsis
  cleaned = cleaned.replace(/\.{2,}/g, "...");
  
  // Remove duplicate punctuation (except ellipsis and !!)
  cleaned = cleaned.replace(/([!?])\1+/g, "$1$1"); // Keep max 2
  cleaned = cleaned.replace(/([.,;:])\1+/g, "$1"); // Keep only 1
  
  return cleaned;
}

interface InferenceResult {
  lane: TaskLane | null;
  priority: TaskPriority | null;
  waiting_on: string | null;
  status: EntryStatus | null;
  signifier: Signifier | null;
}

/**
 * Detect task lane from text keywords
 * Uses word boundaries to avoid false positives
 */
export function inferLane(text: string): TaskLane | null {
  const lower = text.toLowerCase();
  
  // Work keywords - only trigger if clearly work-related context
  const workPattern = /\b(deploy(ment)?|meeting|sprint|pr|pull request|code review|bug fix|release|build|ship|launch|demo|standup|sync|review|merge|production|staging|ci|cd|api|server|database|client)\b/;
  if (workPattern.test(lower)) {
    // Avoid false positives: check it's not clearly personal/family context
    const personalContext = /\b(birthday|party|celebration|family|kids?|home)\b/;
    if (!personalContext.test(lower)) {
      return "work";
    }
  }
  
  // Family keywords
  if (
    /\b(kids?|child(ren)?|dinner|groceries|family|home|house|school|pickup|drop-?off|bedtime|childcare|parent)\b/.test(
      lower
    )
  ) {
    return "family";
  }
  
  // JW keywords
  if (
    /\b(ministry|theocratic|bible study|talk|congregation|field service|witness|jw|publisher|pioneer|elder|circuit|assembly)\b/.test(
      lower
    )
  ) {
    return "jw";
  }
  
  // Petalz keywords
  if (/\b(petalz|storefront|inventory|fulfillment|orders?|shopify)\b/.test(lower)) {
    return "petalz";
  }
  
  // Default to personal
  return "personal";
}

/**
 * Detect task priority from text keywords
 */
export function inferPriority(text: string): TaskPriority | null {
  const lower = text.toLowerCase();
  
  // High priority markers
  if (
    /\b(urgent|asap|critical|emergency|high priority|now|immediately|today)\b/.test(
      lower
    ) ||
    text.includes("!!") ||
    text.includes("URGENT")
  ) {
    return "high";
  }
  
  // Low priority markers
  if (
    /\b(when i can|eventually|someday|maybe|low priority|later|whenever)\b/.test(
      lower
    )
  ) {
    return "low";
  }
  
  // Default to normal
  return "normal";
}

/**
 * Detect waiting_on context from text patterns
 * Extracts what/who is blocking progress
 */
export function inferWaitingOn(text: string): string | null {
  const lower = text.toLowerCase();
  
  // Common blocking patterns
  const patterns = [
    /waiting (?:for|on) ([^,.;]+)/,
    /blocked (?:by|on) ([^,.;]+)/,
    /pending ([^,.;]+)/,
    /need(?:s|ing)? ([^,.;]+?) (?:to|before)/,
    /after ([^,.;]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      // Clean up and capitalize first letter
      const waiting = match[1].trim();
      return waiting.charAt(0).toUpperCase() + waiting.slice(1);
    }
  }
  
  return null;
}

/**
 * Detect if task is already in-progress or blocked from text patterns
 */
export function inferStatus(text: string): EntryStatus | null {
  const lower = text.toLowerCase();
  
  // Blocked markers - stronger signal than waiting
  if (
    /^(blocked|cant|can't|cannot proceed)\b/.test(lower) ||
    /\b(blocked on|blocked by)\b/.test(lower)
  ) {
    return "blocked";
  }
  
  // In-progress markers
  if (
    /\b(working on|currently|in progress|started|begun|doing)\b/.test(lower) ||
    /^(wip:|doing:|active:)/.test(lower)
  ) {
    return "in-progress";
  }
  
  // If only "waiting" is detected, don't auto-set blocked status
  // Let the waiting_on field indicate that, user can manually block if needed
  return null;
}

/**
 * Auto-detect signifier from text patterns
 * Returns null if no clear pattern (let user choose)
 */
export function inferSignifier(text: string): Signifier | null {
  const lower = text.toLowerCase();
  
  // Appointment patterns - dates, times, meetings
  if (
    /\b(meeting|appointment|call|at \d{1,2}(:\d{2})?(am|pm)?|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.test(lower) ||
    /\b\d{1,2}(:\d{2})?(am|pm)\b/.test(lower)
  ) {
    return "appointment";
  }
  
  // Memory patterns - remember, don't forget
  if (
    /^(remember|don't forget|recall|keep in mind|note to self):?\b/.test(lower)
  ) {
    return "memory";
  }
  
  // Important patterns - urgent, critical markers
  if (
    /^(important|critical|urgent):?\b/.test(lower) ||
    text.startsWith("!!") ||
    text.startsWith("❗")
  ) {
    return "important";
  }
  
  // Note patterns - questions, ideas, thoughts
  if (
    /^(why|how|what|when|where|idea:|thought:|question:)\b/.test(lower) ||
    text.endsWith("?")
  ) {
    return "note";
  }
  
  // Task patterns - action verbs, imperatives
  if (
    /^(fix|build|create|update|refactor|review|test|deploy|implement|write|add|remove|delete|check|verify|investigate|debug|setup|install|configure)\b/.test(lower)
  ) {
    return "task";
  }
  
  // Default: let user choose (return null for no override)
  return null;
}

/**
 * Infer lane, priority, waiting_on, status, and signifier from text
 */
export function inferMetadata(text: string): InferenceResult {
  return {
    lane: inferLane(text),
    priority: inferPriority(text),
    waiting_on: inferWaitingOn(text),
    status: inferStatus(text),
    signifier: inferSignifier(text),
  };
}
