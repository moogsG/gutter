"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConversationalTranscript } from "./ConversationalTranscript";

interface CaptureDialogProps {
  date: string;
  captureMode?: "default" | "task";
  onEntriesCreated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CaptureDialog({
  date,
  captureMode = "default",
  onEntriesCreated,
  open: controlledOpen,
  onOpenChange,
}: CaptureDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg h-[90dvh] sm:h-[80vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-primary/5">
        <DialogTitle className="sr-only">{captureMode === "task" ? "Capture a task" : "Capture your thoughts"}</DialogTitle>
        <ConversationalTranscript date={date} captureMode={captureMode} onEntriesCreated={onEntriesCreated} />
      </DialogContent>
    </Dialog>
  );
}
