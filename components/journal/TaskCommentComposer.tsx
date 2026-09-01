"use client";

import { type FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TaskCommentComposer({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (body: string) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextBody = body.trim();
    if (!nextBody) {
      setError("Write a comment before sending.");
      return;
    }
    setError(null);
    try {
      await onSubmit(nextBody);
      setBody("");
    } catch {
      setError("Comment could not be added. Your draft is still here.");
    }
  }

  return (
    <form className="space-y-2 border-t border-border bg-background pt-4" onSubmit={handleSubmit}>
      <Label htmlFor="task-comment">Add a Markdown comment</Label>
      <Textarea
        id="task-comment"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Share context or the next step…"
        disabled={isSubmitting}
        aria-describedby="task-comment-help task-comment-error"
      />
      <div className="flex items-center justify-between gap-3">
        <p id="task-comment-help" className="text-xs text-muted-foreground">Markdown supported</p>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          <Send /> {isSubmitting ? "Adding…" : "Add comment"}
        </Button>
      </div>
      {error ? <p id="task-comment-error" role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
