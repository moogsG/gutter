"use client";

import { useState } from "react";
import { TomorrowLaunchpad } from "@/components/journal/TomorrowLaunchpad";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

function getTomorrowDate() {
  return shiftJournalDate(getJournalDate(), 1);
}

export default function TomorrowPage() {
  const [date, setDate] = useState(getTomorrowDate);

  return <TomorrowLaunchpad date={date} onDateChange={setDate} />;
}
