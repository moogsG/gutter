"use client";

import { useState } from "react";
import { HabitsMomentumBoard } from "@/components/journal/HabitsMomentumBoard";

export function HabitsMomentumPageClient({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  return <HabitsMomentumBoard date={date} onDateChange={setDate} />;
}
