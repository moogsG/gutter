"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { FollowThroughRadar } from "@/components/journal/FollowThroughRadar";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function RadarPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <FollowThroughRadar date={date} onDateChange={setDate} />;
}
