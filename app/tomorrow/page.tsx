"use client";

import { useState } from "react";
import { TomorrowLaunchpad } from "@/components/journal/TomorrowLaunchpad";

function getTomorrowDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(lookup.year), Number(lookup.month) - 1, Number(lookup.day), 12));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split("T")[0];
}

export default function TomorrowPage() {
  const [date, setDate] = useState(getTomorrowDate);

  return <TomorrowLaunchpad date={date} onDateChange={setDate} />;
}
