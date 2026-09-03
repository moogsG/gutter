import { HabitsMomentumPageClient } from "@/components/journal/HabitsMomentumPageClient";
import { getJournalDate, isValidJournalDate } from "@/lib/journal-date";

function getCancunTodayDate(): string {
  return getJournalDate();
}

export default async function HabitsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawDate = resolvedSearchParams.date;
  const requestedDate = Array.isArray(rawDate) ? rawDate[0] : rawDate;

  return (
    <HabitsMomentumPageClient
      initialDate={isValidJournalDate(requestedDate) ? requestedDate : getCancunTodayDate()}
    />
  );
}
