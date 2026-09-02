import { AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OptionalSourceState } from "@/types";

export function OptionalSourceNotice({
  source,
  onRetry,
}: {
  source: OptionalSourceState;
  onRetry?: () => void;
}) {
  if (source.state === "ready" || source.state === "empty") return null;

  const isConfigurationIssue = source.state === "not-configured";

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        {isConfigurationIssue ? (
          <Settings className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        )}
        <div>
          <p className="font-medium text-foreground">
            {isConfigurationIssue ? "Not configured" : "Source unavailable"}
          </p>
          <p className="mt-1 text-muted-foreground">{source.message}</p>
        </div>
      </div>
      {source.recovery === "retry" && onRetry ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
