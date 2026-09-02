"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { DateNightBoard } from "@/components/journal/DateNightBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function DateNightPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <DateNightBoard date={date} onDateChange={setDate} />;
}
