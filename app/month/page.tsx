"use client";

import { ChevronLeft, ChevronRight, FileText, Mic } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { MeetingDrawer } from "@/components/meeting/MeetingDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCalendarColorToken } from "@/lib/calendar-colors";
import { cn } from "@/lib/utils";
import { useGetMeetingPrepQuery } from "@/store/api/meetingPrepApi";
import { useGetCalendarMonthQuery } from "@/store/api/tasksApi";
import type { CalendarEvent, MeetingPrep } from "@/types";

function formatMonth(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

interface CalendarDay {
	date: Date;
	dateStr: string; // YYYY-MM-DD
	isCurrentMonth: boolean;
	isToday: boolean;
	events: CalendarEvent[];
}

function toLocalDateStr(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildCalendarGrid(
	year: number,
	month: number,
	events: CalendarEvent[],
): CalendarDay[][] {
	const today = new Date();
	const todayStr = toLocalDateStr(today);

	// Group events by LOCAL date (not UTC — avoids evening events shifting to next day)
	const eventsByDate: Record<string, CalendarEvent[]> = {};
	for (const event of events) {
		const dateStr = toLocalDateStr(new Date(event.startDate));
		if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
		eventsByDate[dateStr].push(event);
	}

	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);
	const startOffset = firstDay.getDay(); // 0=Sun

	const weeks: CalendarDay[][] = [];
	let currentWeek: CalendarDay[] = [];

	// Pad start with previous month days
	for (let i = 0; i < startOffset; i++) {
		const d = new Date(year, month, -(startOffset - 1 - i));
		const dateStr = toLocalDateStr(d);
		currentWeek.push({
			date: d,
			dateStr,
			isCurrentMonth: false,
			isToday: dateStr === todayStr,
			events: eventsByDate[dateStr] || [],
		});
	}

	// Current month days
	for (let day = 1; day <= lastDay.getDate(); day++) {
		const d = new Date(year, month, day);
		const dateStr = toLocalDateStr(d);
		currentWeek.push({
			date: d,
			dateStr,
			isCurrentMonth: true,
			isToday: dateStr === todayStr,
			events: eventsByDate[dateStr] || [],
		});
		if (currentWeek.length === 7) {
			weeks.push(currentWeek);
			currentWeek = [];
		}
	}

	// Pad end with next month days
	if (currentWeek.length > 0) {
		let nextDay = 1;
		while (currentWeek.length < 7) {
			const d = new Date(year, month + 1, nextDay++);
			const dateStr = toLocalDateStr(d);
			currentWeek.push({
				date: d,
				dateStr,
				isCurrentMonth: false,
				isToday: dateStr === todayStr,
				events: eventsByDate[dateStr] || [],
			});
		}
		weeks.push(currentWeek);
	}

	return weeks;
}

// Map calendar color tokens to Tailwind classes
// (Tailwind needs full class names for JIT — can't interpolate)
const calColorClasses: Record<
	string,
	{ bg: string; border: string; text: string; dot: string }
> = {
	"cal-gradient": {
		bg: "bg-cal-gradient/15",
		border: "border-cal-gradient/50",
		text: "text-cal-gradient",
		dot: "bg-cal-gradient",
	},
	"cal-family": {
		bg: "bg-cal-family/15",
		border: "border-cal-family/50",
		text: "text-cal-family",
		dot: "bg-cal-family",
	},
	"cal-home": {
		bg: "bg-cal-home/15",
		border: "border-cal-home/50",
		text: "text-cal-home",
		dot: "bg-cal-home",
	},
	"cal-jw": {
		bg: "bg-cal-jw/15",
		border: "border-cal-jw/50",
		text: "text-cal-jw",
		dot: "bg-cal-jw",
	},
	"cal-school": {
		bg: "bg-cal-school/15",
		border: "border-cal-school/50",
		text: "text-cal-school",
		dot: "bg-cal-school",
	},
	"cal-birthdays": {
		bg: "bg-cal-birthdays/15",
		border: "border-cal-birthdays/50",
		text: "text-cal-birthdays",
		dot: "bg-cal-birthdays",
	},
	"cal-holidays": {
		bg: "bg-cal-holidays/15",
		border: "border-cal-holidays/50",
		text: "text-cal-holidays",
		dot: "bg-cal-holidays",
	},
};

function getCalClasses(calendarName: string) {
	const token = getCalendarColorToken(calendarName);
	return calColorClasses[token] || calColorClasses["cal-home"];
}

function EventPill({
	event,
	prep,
	onClick,
}: {
	event: CalendarEvent;
	prep: MeetingPrep | null;
	onClick: () => void;
}) {
	const startTime = event.allDay
		? null
		: new Date(event.startDate).toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
			});

	const hasPrep = prep && (prep.prepStatus === "ready" || prep.prepNotes);
	const hasTranscript = prep?.transcript;
	const colors = getCalClasses(event.calendar);

	return (
		<button
			onClick={onClick}
			className={cn(
				"w-full text-left px-1.5 py-0.5 rounded text-[11px] sm:text-xs leading-tight truncate transition-colors",
				"hover:ring-1 hover:ring-primary/40 active:opacity-80",
				colors.bg,
				"border-l-2",
				colors.border,
				"text-foreground/80",
			)}
		>
			<span className="flex items-center gap-1">
				{startTime && (
					<span className="text-muted-foreground shrink-0">{startTime}</span>
				)}
				<span className="truncate">{event.title}</span>
				{hasPrep && <FileText className="w-2.5 h-2.5 text-primary shrink-0" />}
				{hasTranscript && <Mic className="w-2.5 h-2.5 text-chart-2 shrink-0" />}
			</span>
		</button>
	);
}

const PILL_HEIGHT = 20; // ~py-0.5 + text + gap
const MORE_HEIGHT = 16; // "+N more" row

function DayEventList({
	events,
	dateStr,
	getMeetingPrep,
	onEventClick,
}: {
	events: CalendarEvent[];
	dateStr: string;
	getMeetingPrep: (eventId: string, eventDate?: string) => MeetingPrep | null;
	onEventClick: (event: CalendarEvent) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [maxVisible, setMaxVisible] = useState(3);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const h = entry.contentRect.height;
				if (events.length === 0) return;

				// How many pills fit? Reserve space for "+N more" if we can't show all
				const fitsAll = Math.floor(h / PILL_HEIGHT) >= events.length;
				if (fitsAll) {
					setMaxVisible(events.length);
				} else {
					// Reserve space for the "+N more" label
					const available = h - MORE_HEIGHT;
					setMaxVisible(Math.max(1, Math.floor(available / PILL_HEIGHT)));
				}
			}
		});

		observer.observe(el);
		return () => observer.disconnect();
	}, [events.length]);

	const shown = events.slice(0, maxVisible);
	const remaining = events.length - shown.length;

	return (
		<div
			ref={containerRef}
			className="hidden sm:flex flex-col gap-0.5 overflow-hidden flex-1 min-h-0"
		>
			{shown.map((event) => (
				<EventPill
					key={event.id}
					event={event}
					prep={getMeetingPrep(event.id, dateStr)}
					onClick={() => onEventClick(event)}
				/>
			))}
			{remaining > 0 && (
				<span className="text-[10px] text-muted-foreground pl-1.5 leading-none">
					+{remaining} more
				</span>
			)}
		</div>
	);
}

export default function MonthlyLogPage() {
	const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
	const [selectedMeeting, setSelectedMeeting] = useState<MeetingPrep | null>(
		null,
	);
	const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

	const monthStr = formatMonth(currentMonth);
	const { data: calendarData, isLoading } = useGetCalendarMonthQuery(monthStr, {
		pollingInterval: 30_000,
	});
	const calendarEvents = calendarData?.events || [];

	const { data: meetingPrepData } = useGetMeetingPrepQuery();

	const weeks = useMemo(
		() =>
			buildCalendarGrid(
				currentMonth.getFullYear(),
				currentMonth.getMonth(),
				calendarEvents,
			),
		[currentMonth, calendarEvents],
	);

	const handlePrevMonth = () => {
		const newMonth = new Date(currentMonth);
		newMonth.setMonth(newMonth.getMonth() - 1);
		setCurrentMonth(newMonth);
		setSelectedDay(null);
	};

	const handleNextMonth = () => {
		const newMonth = new Date(currentMonth);
		newMonth.setMonth(newMonth.getMonth() + 1);
		setCurrentMonth(newMonth);
		setSelectedDay(null);
	};

	const handleToday = () => {
		setCurrentMonth(new Date());
		setSelectedDay(null);
	};

	const monthName = currentMonth.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});

	const getMeetingPrep = (
		eventId: string,
		eventDate?: string,
	): MeetingPrep | null => {
		if (eventDate) {
			// For recurring meetings, match on eventId + date
			const exact = meetingPrepData?.meetings.find(
				(m) => m.eventId === eventId && m.occurrenceDate === eventDate,
			);
			if (exact) return exact;
		}
		// Fallback to eventId-only match (non-recurring or legacy data)
		return (
			meetingPrepData?.meetings.find(
				(m) => m.eventId === eventId && !eventDate,
			) || null
		);
	};

	const handleEventClick = (event: CalendarEvent) => {
		// Find or create a meeting prep object for the drawer
		const eventDate = event.startDate ? event.startDate.split("T")[0] : "";
		const existing = getMeetingPrep(event.id, eventDate);
		if (existing) {
			setSelectedMeeting(existing);
		} else {
			// Create a stub so the drawer can request prep
			setSelectedMeeting({
				id: "",
				eventId: event.id,
				title: event.title,
				time: event.startDate,
				calendar: event.calendar,
				occurrenceDate: eventDate,
				prepNotes: null,
				prepStatus: "none",
				transcript: null,
				summary: null,
				actionItems: null,
			});
		}
	};

	return (
		<>
			<JournalHeader
				date={`${formatMonth(currentMonth)}-01`}
				onPrevDay={handlePrevMonth}
				onNextDay={handleNextMonth}
				onToday={handleToday}
			/>

			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Month title bar */}
				<div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-border/50">
					<Button
						variant="ghost"
						size="sm"
						onClick={handlePrevMonth}
						className="w-8 h-8 p-0"
					>
						<ChevronLeft className="w-4 h-4" />
					</Button>
					<h2 className="text-base sm:text-xl font-bold text-foreground">
						{monthName}
					</h2>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleNextMonth}
						className="w-8 h-8 p-0"
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
				</div>

				{isLoading ? (
					<div className="flex-1 flex items-center justify-center">
						<p className="text-sm text-muted-foreground">Loading calendar...</p>
					</div>
				) : (
					<div className="flex-1 flex flex-col min-h-0">
						{/* Day labels */}
						<div className="grid grid-cols-7 border-b border-border/50">
							{DAY_LABELS.map((label, i) => (
								<div
									key={label}
									className={cn(
										"text-center py-1.5 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider",
										(i === 0 || i === 6) && "text-muted-foreground/60",
									)}
								>
									<span className="hidden sm:inline">{label}</span>
									<span className="sm:hidden">{DAY_LABELS_SHORT[i]}</span>
								</div>
							))}
						</div>

						{/* Calendar grid */}
						<div
							className="flex-1 min-h-0 overflow-y-auto"
							style={{
								display: "grid",
								gridTemplateRows: `repeat(${weeks.length}, minmax(60px, 1fr))`,
							}}
						>
							{weeks.map((week, wi) => (
								<div
									key={wi}
									className="grid grid-cols-7 border-b border-border/30"
								>
									{week.map((day) => (
										<div
											key={day.dateStr}
											onClick={() =>
												setSelectedDay(
													selectedDay?.dateStr === day.dateStr ? null : day,
												)
											}
											className={cn(
												"flex flex-col border-r border-border/20 last:border-r-0 p-1 sm:p-1.5 cursor-pointer transition-colors overflow-hidden",
												!day.isCurrentMonth && "opacity-40",
												day.isToday && "bg-primary/5",
												selectedDay?.dateStr === day.dateStr &&
													"bg-primary/10 ring-1 ring-inset ring-primary/30",
												day.events.length > 0 && "hover:bg-muted/20",
											)}
										>
											{/* Day number */}
											<div className="flex items-center justify-between mb-0.5 shrink-0">
												<span
													className={cn(
														"text-xs sm:text-sm leading-none",
														day.isToday
															? "text-primary font-bold"
															: day.isCurrentMonth
																? "text-foreground/80"
																: "text-muted-foreground/50",
													)}
												>
													{day.date.getDate()}
												</span>
												{/* Calendar color dots on mobile */}
												{day.events.length > 0 && (
													<span className="sm:hidden flex items-center gap-0.5">
														{/* Show unique calendar dots (max 3) */}
														{[...new Set(day.events.map((e) => e.calendar))]
															.slice(0, 3)
															.map((cal) => (
																<span
																	key={cal}
																	className={cn(
																		"w-1.5 h-1.5 rounded-full",
																		getCalClasses(cal).dot,
																	)}
																/>
															))}
													</span>
												)}
											</div>

											{/* Event pills - hidden on very small screens, shown on sm+ */}
											<DayEventList
												events={day.events}
												dateStr={day.dateStr}
												getMeetingPrep={getMeetingPrep}
												onEventClick={handleEventClick}
											/>
										</div>
									))}
								</div>
							))}
						</div>

						{/* Selected day detail panel (mobile-friendly) */}
						{selectedDay && selectedDay.events.length > 0 && (
							<div className="border-t border-border bg-card/80 backdrop-blur-sm max-h-[35vh] overflow-y-auto">
								<div className="p-3 sm:p-4 space-y-1.5">
									<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
										{selectedDay.date.toLocaleDateString("en-US", {
											weekday: "long",
											month: "long",
											day: "numeric",
										})}
									</h3>
									{selectedDay.events.map((event) => {
										const startTime = event.allDay
											? "All day"
											: new Date(event.startDate).toLocaleTimeString("en-US", {
													hour: "numeric",
													minute: "2-digit",
												});
										const prep = getMeetingPrep(event.id, selectedDay.dateStr);
										const hasPrep =
											prep && (prep.prepStatus === "ready" || prep.prepNotes);
										const hasTranscript = prep?.transcript;
										const colors = getCalClasses(event.calendar);

										return (
											<button
												key={event.id}
												onClick={() => handleEventClick(event)}
												className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/30 active:bg-muted/40 transition-colors text-left"
											>
												{/* Calendar color dot */}
												<div
													className={cn(
														"w-2.5 h-2.5 rounded-full mt-1.5 shrink-0",
														colors.dot,
													)}
												/>
												<div className="flex-1 min-w-0">
													<div className="text-sm text-foreground break-words">
														{event.title}
													</div>
													<div className="flex items-center gap-1.5 mt-1 flex-wrap">
														<Badge
															variant="outline"
															className="text-[10px] border-muted-foreground/30 text-muted-foreground"
														>
															{startTime}
														</Badge>
														<Badge
															variant="outline"
															className={cn(
																"text-[10px]",
																`border-${getCalendarColorToken(event.calendar)}/30`,
																colors.text,
															)}
														>
															{event.calendar}
														</Badge>
														{hasPrep && (
															<Badge
																variant="outline"
																className="text-[10px] border-primary/40 text-primary gap-1"
															>
																<FileText className="w-2.5 h-2.5" />
																Prep
															</Badge>
														)}
														{hasTranscript && (
															<Badge
																variant="outline"
																className="text-[10px] border-chart-2/40 text-chart-2 gap-1"
															>
																<Mic className="w-2.5 h-2.5" />
																Transcript
															</Badge>
														)}
													</div>
												</div>
											</button>
										);
									})}
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Meeting prep/transcript drawer */}
			{selectedMeeting && (
				<MeetingDrawer
					meeting={selectedMeeting}
					open={!!selectedMeeting}
					onClose={() => setSelectedMeeting(null)}
				/>
			)}
		</>
	);
}
