"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { MeetingPrepQueueBoard } from "@/components/journal/MeetingPrepQueueBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function MeetingsPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <MeetingPrepQueueBoard date={date} onDateChange={setDate} />;
}
