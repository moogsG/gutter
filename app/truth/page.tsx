"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { ProjectTruthBoard } from "@/components/journal/ProjectTruthBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function TruthPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <ProjectTruthBoard date={date} onDateChange={setDate} />;
}
