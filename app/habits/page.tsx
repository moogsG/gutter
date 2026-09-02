import { HabitsMomentumPageClient } from "@/components/journal/HabitsMomentumPageClient";
import { getJournalDate } from "@/lib/journal-date";

function isValidIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

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
      initialDate={isValidIsoDate(requestedDate) ? requestedDate : getCancunTodayDate()}
    />
  );
}
