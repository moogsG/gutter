"use client";

import { useState } from "react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SignifierIcon } from "@/components/journal/SignifierIcon";
import { useGetFutureLogQuery, useCreateFutureLogEntryMutation } from "@/store/api/journalApi";
import type { Signifier } from "@/types/journal";

const signifiers: Signifier[] = ["task", "appointment", "note"];

export default function FutureLogPage() {
  const [selectedSignifier, setSelectedSignifier] = useState<Signifier>("task");
  const [targetMonth, setTargetMonth] = useState("");
  const [text, setText] = useState("");

  const { data: entries = [] } = useGetFutureLogQuery();
  const [createEntry] = useCreateFutureLogEntryMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !targetMonth) return;

    createEntry({
      target_month: targetMonth,
      signifier: selectedSignifier,
      text: text.trim(),
    });

    setText("");
  };

  // Group entries by month
  const grouped = entries.reduce((acc, entry) => {
    const month = entry.target_month;
    if (!acc[month]) acc[month] = [];
    acc[month].push(entry);
    return acc;
  }, {} as Record<string, typeof entries>);

  const sortedMonths = Object.keys(grouped).sort();

  return (
    <>
      <JournalHeader
        date={new Date().toISOString().split("T")[0]}
        onPrevDay={() => {}}
        onNextDay={() => {}}
        onToday={() => {}}
      />
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
              <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Add Future Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex gap-1.5 flex-wrap">
                  {signifiers.map((sig) => (
                    <Button
                      key={sig}
                      type="button"
                      variant={selectedSignifier === sig ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setSelectedSignifier(sig)}
                      className="h-8"
                    >
                      <SignifierIcon signifier={sig} status="open" className="mr-1.5" />
                      <span className="text-xs sm:text-sm">{sig}</span>
                    </Button>
                  ))}
                </div>
                <Input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  placeholder="Target month"
                  className="h-9"
                />
                <Input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What do you want to remember?"
                  className="h-9"
                />
                <Button type="submit" disabled={!text.trim() || !targetMonth} size="sm" className="w-full sm:w-auto">
                  Add Entry
                </Button>
              </form>
            </CardContent>
          </Card>

          {sortedMonths.length === 0 ? (
            <Card>
              <CardContent className="py-10 sm:py-12 text-center">
                <p className="text-sm text-muted-foreground">No future entries yet. Add one above.</p>
              </CardContent>
            </Card>
          ) : (
            sortedMonths.map((month) => (
              <Card key={month}>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2">
                  <CardTitle className="text-base sm:text-lg">
                    {new Date(month + "-01").toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-1.5">
                    {grouped[month].map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2.5 py-1.5">
                        <SignifierIcon signifier={entry.signifier} status="open" />
                        <p className="text-sm text-foreground break-words">{entry.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
