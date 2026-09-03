"use client";
import { getJournalDate } from "@/lib/journal-date";

import { WipLimitBoard } from "@/components/journal/WipLimitBoard";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default function WipPage() {
  return <WipLimitBoard date={getCancunTodayDate()} />;
}
