"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { EveningResetBoard } from "@/components/journal/EveningResetBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function ResetPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <EveningResetBoard date={date} onDateChange={setDate} />;
}
