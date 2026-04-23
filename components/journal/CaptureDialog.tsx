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
  onEntriesCreated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CaptureDialog({
  date,
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
        <DialogTitle className="sr-only">Capture your thoughts</DialogTitle>
        <ConversationalTranscript date={date} onEntriesCreated={onEntriesCreated} />
      </DialogContent>
    </Dialog>
  );
}
