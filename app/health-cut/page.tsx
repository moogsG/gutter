"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { HealthCutDashboard } from "@/components/journal/HealthCutDashboard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function HealthCutPage() {
  const [date, setDate] = useState(getCancunTodayDate);

  return <HealthCutDashboard date={date} onDateChange={setDate} />;
}
