"use client";

import { useState } from "react";
import { MealPlanBoard } from "@/components/journal/MealPlanBoard";

function getCancunTodayDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export default function MealPlanPage() {
  const [date, setDate] = useState(getCancunTodayDate);
  return <MealPlanBoard date={date} onDateChange={setDate} />;
}
