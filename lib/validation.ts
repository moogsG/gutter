/**
 * Input validation and sanitization utilities
 */

/**
 * Sanitize user text input to prevent XSS
 * Basic implementation - for production consider using DOMPurify or similar
 */
export function sanitizeText(input: string | undefined | null): string {
  if (!input) return "";
  
  // Remove potentially dangerous HTML/script content
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

/**
 * Sanitize markdown content
 * Allows basic markdown but prevents script injection
 */
export function sanitizeMarkdown(input: string | undefined | null): string {
  if (!input) return "";
  
  // Basic sanitization - remove script tags and event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

/**
 * Validate and sanitize journal entry content
 */
export function validateJournalEntry(entry: {
  content?: unknown;
  tags?: unknown;
  project?: unknown;
}): { valid: boolean; errors: string[]; sanitized?: any } {
  const errors: string[] = [];

  // Validate content
  if (entry.content !== undefined && typeof entry.content !== "string") {
    errors.push("Content must be a string");
  }
  if (typeof entry.content === "string" && entry.content.length > 50000) {
    errors.push("Content exceeds maximum length (50000 characters)");
  }

  // Validate tags
  if (entry.tags !== undefined) {
    if (!Array.isArray(entry.tags)) {
      errors.push("Tags must be an array");
    } else if (entry.tags.some((tag) => typeof tag !== "string")) {
      errors.push("All tags must be strings");
    } else if (entry.tags.length > 20) {
      errors.push("Maximum 20 tags allowed");
    }
  }

  // Validate project
  if (entry.project !== undefined && typeof entry.project !== "string") {
    errors.push("Project must be a string");
  }
  if (typeof entry.project === "string" && entry.project.length > 100) {
    errors.push("Project name too long (max 100 characters)");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Sanitize valid input
  const sanitized: any = {};
  if (entry.content) {
    sanitized.content = sanitizeMarkdown(entry.content as string);
  }
  if (entry.tags) {
    sanitized.tags = (entry.tags as string[]).map((tag) =>
      sanitizeText(tag).substring(0, 50)
    );
  }
  if (entry.project) {
    sanitized.project = sanitizeText(entry.project as string);
  }

  return { valid: true, errors: [], sanitized };
}

/**
 * Validate and sanitize task data
 */
export function validateTask(task: {
  title?: unknown;
  description?: unknown;
  project?: unknown;
  priority?: unknown;
  status?: unknown;
}): { valid: boolean; errors: string[]; sanitized?: any } {
  const errors: string[] = [];

  // Validate title
  if (task.title !== undefined) {
    if (typeof task.title !== "string") {
      errors.push("Title must be a string");
    } else if (task.title.length === 0) {
      errors.push("Title cannot be empty");
    } else if (task.title.length > 500) {
      errors.push("Title too long (max 500 characters)");
    }
  }

  // Validate description
  if (task.description !== undefined && typeof task.description !== "string") {
    errors.push("Description must be a string");
  }
  if (
    typeof task.description === "string" &&
    task.description.length > 10000
  ) {
    errors.push("Description too long (max 10000 characters)");
  }

  // Validate project
  if (task.project !== undefined && typeof task.project !== "string") {
    errors.push("Project must be a string");
  }

  // Validate priority
  if (task.priority !== undefined) {
    if (typeof task.priority !== "string") {
      errors.push("Priority must be a string");
    } else if (!["low", "medium", "high", "urgent"].includes(task.priority)) {
      errors.push("Invalid priority value");
    }
  }

  // Validate status
  if (task.status !== undefined) {
    if (typeof task.status !== "string") {
      errors.push("Status must be a string");
    } else if (
      !["open", "in-progress", "blocked", "done", "cancelled"].includes(
        task.status
      )
    ) {
      errors.push("Invalid status value");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Sanitize valid input
  const sanitized: any = {};
  if (task.title) {
    sanitized.title = sanitizeText(task.title as string);
  }
  if (task.description) {
    sanitized.description = sanitizeMarkdown(task.description as string);
  }
  if (task.project) {
    sanitized.project = sanitizeText(task.project as string);
  }
  if (task.priority) {
    sanitized.priority = task.priority;
  }
  if (task.status) {
    sanitized.status = task.status;
  }

  return { valid: true, errors: [], sanitized };
}

/**
 * Validate ID parameter (prevent SQL injection)
 */
export function validateId(id: unknown): { valid: boolean; error?: string } {
  if (typeof id !== "string" && typeof id !== "number") {
    return { valid: false, error: "ID must be a string or number" };
  }

  const idStr = String(id);

  // Check for SQL injection patterns
  if (/[;'"\\]|--|\*|union|select|drop|insert|update|delete/i.test(idStr)) {
    return { valid: false, error: "Invalid ID format" };
  }

  // For numeric IDs
  if (/^\d+$/.test(idStr)) {
    const num = parseInt(idStr, 10);
    if (num < 1 || num > Number.MAX_SAFE_INTEGER) {
      return { valid: false, error: "ID out of valid range" };
    }
  }

  return { valid: true };
}

/**
 * Parse and validate JSON request body
 */
export async function parseJsonBody<T = any>(
  req: Request
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: "Content-Type must be application/json" };
    }

    const data = await req.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Invalid JSON in request body" };
  }
}
