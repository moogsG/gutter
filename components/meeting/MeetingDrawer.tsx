"use client";

import { useState } from "react";
import {
  useGetMeetingPrepQuery,
  useRequestPrepMutation,
  useUploadTranscriptMutation,
} from "@/store/api/meetingPrepApi";
import type { MeetingPrep } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PROSE_CLASSES =
  "prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-chart-2 prose-blockquote:border-primary/40 prose-hr:border-border/30 prose-li:marker:text-primary/60 prose-pre:bg-muted prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5";

function formatMeetingTime(time: string) {
  const d = new Date(time);
  return {
    date: d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function MeetingStatusBadge({ meeting }: { meeting: MeetingPrep }) {
  if (meeting.prepStatus === "ready") {
    return (
      <Badge variant="outline" className="border-chart-2/40 text-chart-2 text-[10px]">
        prepped
      </Badge>
    );
  }
  if (meeting.prepStatus === "preparing") {
    return (
      <Badge variant="outline" className="border-primary/40 text-primary text-[10px] animate-pulse">
        preparing...
      </Badge>
    );
  }
  return null;
}

export function MeetingDrawer({
  meeting,
  open,
  onClose,
}: {
  meeting: MeetingPrep;
  open: boolean;
  onClose: () => void;
}) {
  const [transcript, setTranscript] = useState("");
  const [showTranscriptInput, setShowTranscriptInput] = useState(false);
  const [prepContext, setPrepContext] = useState("");
  const [showPrepContext, setShowPrepContext] = useState(false);
  const [requestPrep, { isLoading: isPrepping }] = useRequestPrepMutation();
  const [uploadTranscript, { isLoading: isUploading }] =
    useUploadTranscriptMutation();

  // Subscribe to live data so mutations (transcript upload, prep) reflect immediately
  // Match on BOTH eventId + occurrenceDate — recurring meetings share the same eventId
  const { data: meetingPrepData } = useGetMeetingPrepQuery();
  const liveMeeting: MeetingPrep = meetingPrepData?.meetings.find(
    (m) => m.eventId === meeting.eventId && m.occurrenceDate === meeting.occurrenceDate
  ) || meeting;

  const { date, time } = formatMeetingTime(liveMeeting.time);

  const handlePrepMe = async () => {
    await requestPrep({
      eventId: meeting.eventId,
      title: liveMeeting.title,
      time: meeting.time,
      calendar: liveMeeting.calendar,
      ...(prepContext.trim() ? { context: prepContext.trim() } : {}),
    });
    setPrepContext("");
    setShowPrepContext(false);
  };

  const handleTranscriptSubmit = async () => {
    if (!transcript.trim()) return;
    await uploadTranscript({
      eventId: meeting.eventId,
      title: liveMeeting.title,
      time: meeting.time,
      calendar: liveMeeting.calendar,
      transcript: transcript.trim(),
    });
    setTranscript("");
    setShowTranscriptInput(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[540px] md:w-[640px] lg:w-[720px] sm:max-w-none bg-card border-l border-border p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <SheetTitle className="text-lg font-bold text-foreground">
            {liveMeeting.title}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{liveMeeting.calendar}</span>
              <span className="text-border">|</span>
              <span>{date}</span>
              <span className="text-border">|</span>
              <span>{time}</span>
              <MeetingStatusBadge meeting={liveMeeting} />
            </div>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-10rem)]">
          <div className="px-6 py-6 space-y-6">
            {/* Action buttons */}
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {liveMeeting.prepStatus !== "ready" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={showPrepContext ? handlePrepMe : () => setShowPrepContext(true)}
                      disabled={isPrepping || liveMeeting.prepStatus === "preparing"}
                      className="border-primary/40 text-primary hover:bg-primary/10"
                    >
                      {isPrepping ? "Requesting..." : "Prep me"}
                    </Button>
                    {showPrepContext && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowPrepContext(false); setPrepContext(""); }}
                        className="text-muted-foreground text-xs"
                      >
                        Cancel
                      </Button>
                    )}
                  </>
                )}
                {!liveMeeting.transcript && !showTranscriptInput && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTranscriptInput(true)}
                    className="border-chart-2/40 text-chart-2 hover:bg-chart-2/10"
                  >
                    Add transcript
                  </Button>
                )}
              </div>

              {showPrepContext && (
                <div className="space-y-2">
                  <textarea
                    value={prepContext}
                    onChange={(e) => setPrepContext(e.target.value)}
                    placeholder="Add context for prep... (e.g. 'I want to bring up the QA backlog' or 'Colin mentioned timeline concerns yesterday')"
                    className="w-full h-24 bg-muted/50 border border-border rounded-lg p-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none resize-none"
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Optional — hit Prep me again to send, or leave blank for auto-prep
                  </p>
                </div>
              )}
            </div>

            {/* Prep Notes */}
            {liveMeeting.prepStatus === "preparing" && (
              <div className="rounded-lg bg-muted/50 p-4 border-l-2 border-primary/50 animate-pulse">
                <p className="text-sm text-muted-foreground">
                  Jynx is preparing notes...
                </p>
              </div>
            )}

            {liveMeeting.prepNotes && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
                  Prep Notes
                </h3>
                <div className={PROSE_CLASSES}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {liveMeeting.prepNotes}
                  </ReactMarkdown>
                </div>
              </section>
            )}

            {/* Summary */}
            {liveMeeting.summary && (
              <>
                <Separator className="bg-border/30" />
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-chart-3 mb-3">
                    Summary
                  </h3>
                  <div className={PROSE_CLASSES}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {liveMeeting.summary}
                    </ReactMarkdown>
                  </div>
                </section>
              </>
            )}

            {/* Action Items */}
            {liveMeeting.actionItems && liveMeeting.actionItems.length > 0 && (
              <>
                <Separator className="bg-border/30" />
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-destructive mb-3">
                    Action Items
                  </h3>
                  <ul className="space-y-2">
                    {liveMeeting.actionItems.map((item, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-sm text-foreground/85"
                      >
                        <span className="text-primary/60 flex-shrink-0 mt-0.5">
                          --
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {/* Transcript Input */}
            {showTranscriptInput && (
              <>
                <Separator className="bg-border/30" />
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-chart-2 mb-3">
                    Add Transcript
                  </h3>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Paste meeting transcript here..."
                    className="w-full h-48 bg-muted/50 border border-border rounded-lg p-4 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none resize-none"
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowTranscriptInput(false);
                        setTranscript("");
                      }}
                      disabled={isUploading}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleTranscriptSubmit}
                      disabled={isUploading || !transcript.trim()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isUploading ? "Sending..." : "Submit"}
                    </Button>
                  </div>
                </section>
              </>
            )}

            {/* Existing transcript */}
            {liveMeeting.transcript && (
              <>
                <Separator className="bg-border/30" />
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-chart-2 mb-3">
                    Transcript
                  </h3>
                  <div className={PROSE_CLASSES}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {liveMeeting.transcript}
                    </ReactMarkdown>
                  </div>
                </section>
              </>
            )}

            {/* Empty state */}
            {!liveMeeting.prepNotes &&
              !liveMeeting.summary &&
              !liveMeeting.actionItems?.length &&
              !liveMeeting.transcript &&
              liveMeeting.prepStatus === "none" && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No prep yet. Hit "Prep me" and I will pull context from
                  Confluence, Jira, and past notes.
                </div>
              )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
