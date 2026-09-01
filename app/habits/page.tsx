import { HabitsMomentumPageClient } from "@/components/journal/HabitsMomentumPageClient";

function isValidIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

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
