"use client";
import { getJournalDate } from "@/lib/journal-date";

import { useState } from "react";
import { MealPlanBoard } from "@/components/journal/MealPlanBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function MealPlanPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <MealPlanBoard date={date} onDateChange={setDate} />;
}
