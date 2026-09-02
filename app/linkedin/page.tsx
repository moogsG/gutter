"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { LinkedInBoard } from "@/components/journal/LinkedInBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function LinkedInPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <LinkedInBoard date={date} onDateChange={setDate} />;
}
