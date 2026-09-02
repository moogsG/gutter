"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { ProjectRunwayBoard } from "@/components/journal/ProjectRunwayBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function ProjectsPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <ProjectRunwayBoard date={date} onDateChange={setDate} />;
}
