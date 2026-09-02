import { fetchCalendarEvents, type CalendarEvent } from "@/lib/calendar";
import type {
  SchoolBoardData,
  SchoolDailyBlock,
  SchoolKidProfile,
  SchoolRunwayDay,
  SchoolRunwayEvent,
} from "@/types";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

const FAMILY_CALENDARS = new Set(["Family Calendar", "Home"]);
const SCHOOL_CALENDAR = "School";

const KID_PROFILES: SchoolKidProfile[] = [
  {
    id: "atticus",
    name: "Atticus",
    gradeLabel: "Homeschool reading + math",
    interests: ["Dinosaurs", "Jurassic Park", "Halo", "Pokemon"],
    supportNeeds: ["Dyslexia-friendly font", "Sight-word support", "Read-aloud instructions"],
    focusBlocks: [
      "Sight-word hunt with dinosaur or Halo nouns",
      "Short spelling round with read-aloud prompts",
      "Addition/subtraction warm-up, then one multiplication stretch",
    ],
    nextMove: "Start with a 15-minute sight-word sprint using a dinosaur or Pokemon hook before the math block.",
  },
  {
    id: "mishka",
    name: "Mishka",
    gradeLabel: "Grade 1 runway",
    interests: ["Adventure Time", "Unicorns", "Kittens", "My Little Pony"],
    supportNeeds: ["Fun-first pacing", "Sticker-board rewards", "Read-aloud instructions"],
    focusBlocks: [
      "Shared reading/spelling at Atticus level with a kitten or unicorn wrapper",
      "One above-grade challenge round after the warm-up",
      "Colorful reward-driven practice that feels like play, not punishment",
    ],
    nextMove: "Open with a playful reading block, then add one small challenge round while energy is still high.",
  },
];

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function formatLongDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(from: string, to: string): string {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const startText = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endText = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startText} - ${endText}`;
}

function toRunwayEvent(event: CalendarEvent): SchoolRunwayEvent {
  return {
    id: event.id,
    title: event.summary,
    calendar: event.calendar,
    startDate: event.startDate,
    endDate: event.endDate,
    allDay: event.allDay,
  };
}

function summarizeDay(date: string, schoolEvents: SchoolRunwayEvent[], familyEvents: SchoolRunwayEvent[]): SchoolRunwayDay {
  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const headline = schoolEvents.length
    ? `${schoolEvents.length} school item${schoolEvents.length === 1 ? "" : "s"} on deck`
    : familyEvents.length
      ? `${familyEvents.length} family/home item${familyEvents.length === 1 ? "" : "s"} around the homeschool lane`
      : "Open homeschool day with no calendar guardrails";

  return { date, label: dayLabel, schoolEvents, familyEvents, headline };
}

function getRuntimeTodayDate(): string {
  return getJournalDate();
}

function eventTouchesDate(event: SchoolRunwayEvent, date: string): boolean {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate || event.startDate);
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59.999`);
  return start <= dayEnd && end >= dayStart;
}

function buildHeadline(days: SchoolRunwayDay[], rangeEndDate: string): { headline: string; nextMove: string; mode: "quiet" | "scheduled" | "mixed" } {
  const schoolCount = days.reduce((sum, day) => sum + day.schoolEvents.length, 0);
  const familyCount = days.reduce((sum, day) => sum + day.familyEvents.length, 0);

  if (schoolCount === 0 && familyCount === 0) {
    return {
      mode: "quiet",
      headline: `The School and family lanes are blank through ${formatLongDate(rangeEndDate)}.`,
      nextMove: "Treat this as a self-owned homeschool runway: one reading block for each kid, one shared math block, and one outside reset before the house turns feral.",
    };
  }

  if (schoolCount === 0) {
    return {
      mode: "mixed",
      headline: `No School calendar events are booked through ${formatLongDate(rangeEndDate)}, but family context still exists.`,
      nextMove: "Protect the family events first, then anchor the day with two kid-specific learning blocks instead of pretending the blank School calendar means nothing matters.",
    };
  }

  return {
    mode: familyCount > 0 ? "mixed" : "scheduled",
    headline: `${schoolCount} School calendar item${schoolCount === 1 ? "" : "s"} are visible in the next seven days.`,
    nextMove: "Use the calendar as the outer frame, then start with the first kid-specific focus block before everything dissolves into reactive parenting sludge.",
  };
}

function buildDailyPlan(requestedDate: string, day: SchoolRunwayDay): SchoolDailyBlock[] {
  const quietDay = day.schoolEvents.length === 0 && day.familyEvents.length === 0;
  const familyConstraint = day.familyEvents[0]?.title;
  const sharedMathLabel = quietDay ? "Shared math + sticker-board win lap" : "Shared math block around family timing";

  return [
    {
      id: "atticus-reading",
      windowLabel: quietDay ? `${requestedDate} morning` : `${requestedDate} first open block`,
      title: "Atticus reading sprint",
      detail: `Use a dinosaur, Halo, or Pokemon hook for sight words, then a short spelling round in dyslexia-friendly format.`,
    },
    {
      id: "mishka-reading",
      windowLabel: quietDay ? `${requestedDate} mid-morning` : `${requestedDate} second open block`,
      title: "Mishka playful reading",
      detail: `Run the same reading lane with a unicorn or kitten wrapper, then add one tiny stretch challenge while energy is still cute and cooperative.`,
    },
    {
      id: "shared-math",
      windowLabel: quietDay ? `${requestedDate} late morning` : familyConstraint ? `After ${familyConstraint}` : `${requestedDate} late morning`,
      title: sharedMathLabel,
      detail: quietDay
        ? "Do addition/subtraction first, then let Atticus stretch into multiplication while Mishka gets a colorful reward-based finish."
        : "Keep the block compact so the calendar does not eat the whole school day.",
    },
    {
      id: "outside-reset",
      windowLabel: quietDay ? `${requestedDate} afternoon` : `${requestedDate} after the last fixed event`,
      title: "Outside reset",
      detail: "Get them out of the house or into movement before the day curdles into screen-static and cranky chaos.",
    },
  ];
}

export async function getSchoolBoardData(requestedDate = getRuntimeTodayDate()): Promise<SchoolBoardData> {
  if (!isValidIsoDate(requestedDate)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  const rangeEndDate = shiftDate(requestedDate, 6);
  const warnings: string[] = [];
  const result = await fetchCalendarEvents(requestedDate, rangeEndDate);
  if (!result.ok) warnings.push(result.error || "Calendar runway unavailable.");

  const events = (result.data || []).map(toRunwayEvent);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(requestedDate, index);
    const dayEvents = events.filter((event) => eventTouchesDate(event, date));
    return summarizeDay(
      date,
      dayEvents.filter((event) => event.calendar === SCHOOL_CALENDAR),
      dayEvents.filter((event) => FAMILY_CALENDARS.has(event.calendar)),
    );
  });

  const overview = buildHeadline(days, rangeEndDate);
  const requestedDay = days[0];

  return {
    requestedDate,
    displayRange: formatRange(requestedDate, rangeEndDate),
    generatedAt: new Date().toISOString(),
    mode: overview.mode,
    headline: overview.headline,
    nextMove: overview.nextMove,
    warnings,
    counts: {
      schoolEvents: days.reduce((sum, day) => sum + day.schoolEvents.length, 0),
      familyEvents: days.reduce((sum, day) => sum + day.familyEvents.length, 0),
      quietDays: days.filter((day) => day.schoolEvents.length === 0 && day.familyEvents.length === 0).length,
    },
    days,
    dailyPlan: buildDailyPlan(requestedDate, requestedDay),
    kids: KID_PROFILES,
  };
}
