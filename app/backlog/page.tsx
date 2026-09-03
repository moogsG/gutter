"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { BacklogTriageBoard } from "@/components/journal/BacklogTriageBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function BacklogPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <BacklogTriageBoard date={date} onDateChange={setDate} />;
}
