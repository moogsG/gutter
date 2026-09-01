"use client";

import { useState } from "react";
import { SchoolRunwayBoard } from "@/components/journal/SchoolRunwayBoard";

function getRuntimeTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default function SchoolPage() {
  const [date, setDate] = useState(getRuntimeTodayDate);
  return <SchoolRunwayBoard date={date} onDateChange={setDate} />;
}
