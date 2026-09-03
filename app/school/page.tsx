"use client";

import { useState } from "react";
import { SchoolRunwayBoard } from "@/components/journal/SchoolRunwayBoard";
import { getJournalDate } from "@/lib/journal-date";

function getRuntimeTodayDate(): string {
  return getJournalDate();
}

export default function SchoolPage() {
  const [date, setDate] = useState(getRuntimeTodayDate);
  return <SchoolRunwayBoard date={date} onDateChange={setDate} />;
}
