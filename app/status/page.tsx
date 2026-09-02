"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { StatusBoard } from "@/components/journal/StatusBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function StatusPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <StatusBoard date={date} onDateChange={setDate} />;
}
