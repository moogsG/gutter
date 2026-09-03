"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { SessionActivityBoard } from "@/components/journal/SessionActivityBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function SessionsPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <SessionActivityBoard date={date} onDateChange={setDate} />;
}
