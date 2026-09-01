import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import type { TaskComment } from "@/types";

function actorLabel(comment: TaskComment): string {
  if (comment.actor_type === "human") return "Morgan";
  if (comment.actor_id.toLowerCase() === "jynx") return "Jynx";
  if (comment.actor_type === "agent") return `Agent · ${comment.actor_id}`;
  return "System";
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TaskCommentTimeline({
  comments,
  isLoading = false,
  error,
}: {
  comments: TaskComment[];
  isLoading?: boolean;
  error?: string | null;
}) {
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading conversation…</p>;
  }
  if (error) {
    return <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>;
  }
  if (comments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center">
        <p className="text-sm font-medium text-foreground">No comments yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Add context, a decision, or the next useful step.</p>
      </div>
    );
  }
  return (
    <ol aria-label="Task comments" className="space-y-5">
      {comments.map((comment) => (
        <li key={comment.id} className="relative border-l border-border pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={comment.actor_type === "human" ? "default" : "secondary"}>
              {actorLabel(comment)}
            </Badge>
            <time className="text-xs text-muted-foreground" dateTime={comment.created_at}>
              {formatTimestamp(comment.created_at)}
            </time>
          </div>
          <div className="prose prose-sm mt-2 max-w-none text-foreground dark:prose-invert prose-p:my-1 prose-pre:bg-muted">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
          </div>
          {comment.source_ref ? (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Provenance</summary>
              <p className="mt-1 break-all font-mono">{comment.source_ref}</p>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
