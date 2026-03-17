"use client";

import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { SignifierIcon } from "@/components/journal/SignifierIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	useGetUnresolvedQuery,
	useMigrateEntriesMutation,
	useUpdateEntryMutation,
} from "@/store/api/journalApi";

function formatMonth(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function MigratePage() {
	const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
	const [targetDate, setTargetDate] = useState("");
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	const month = formatMonth(currentMonth);
	const { data: entries = [] } = useGetUnresolvedQuery(month);
	const [migrateEntries] = useMigrateEntriesMutation();
	const [updateEntry] = useUpdateEntryMutation();

	const handlePrevMonth = () => {
		const newMonth = new Date(currentMonth);
		newMonth.setMonth(newMonth.getMonth() - 1);
		setCurrentMonth(newMonth);
	};

	const handleNextMonth = () => {
		const newMonth = new Date(currentMonth);
		newMonth.setMonth(newMonth.getMonth() + 1);
		setCurrentMonth(newMonth);
	};

	const handleToggleEntry = (id: string) => {
		setSelectedIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	const handleMigrateSelected = () => {
		if (!targetDate || selectedIds.length === 0) return;
		migrateEntries({ entryIds: selectedIds, targetDate });
		setSelectedIds([]);
	};

	const handleKillEntry = (id: string) => {
		updateEntry({ id, status: "killed" });
	};

	const monthName = currentMonth.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});

	return (
		<>
			<JournalHeader
				date={`${month}-01`}
				onPrevDay={handlePrevMonth}
				onNextDay={handleNextMonth}
				onToday={() => setCurrentMonth(new Date())}
			/>
			<div className="flex-1 overflow-auto p-3 sm:p-6">
				<div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg sm:text-2xl font-bold text-foreground">
								Migration Review
							</h2>
							<p className="text-sm text-muted-foreground">{monthName}</p>
						</div>
						<div className="flex gap-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={handlePrevMonth}
								className="w-8 h-8 p-0"
							>
								<ChevronLeft className="w-4 h-4" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleNextMonth}
								className="w-8 h-8 p-0"
							>
								<ChevronRight className="w-4 h-4" />
							</Button>
						</div>
					</div>

					{selectedIds.length > 0 && (
						<Card>
							<CardContent className="py-3 px-3 sm:px-6">
								<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
									<span className="text-sm text-foreground font-medium">
										{selectedIds.length} selected
									</span>
									<Input
										type="date"
										value={targetDate}
										onChange={(e) => setTargetDate(e.target.value)}
										placeholder="Target date"
										className="h-9 flex-1 sm:max-w-[200px]"
									/>
									<Button
										onClick={handleMigrateSelected}
										disabled={!targetDate}
										size="sm"
										className="shrink-0"
									>
										<ArrowRight className="w-4 h-4 mr-2" />
										Migrate
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2">
							<CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-muted-foreground">
								Unresolved Entries ({entries.length})
							</CardTitle>
						</CardHeader>
						<CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
							{entries.length === 0 ? (
								<p className="text-sm text-muted-foreground text-center py-8">
									No unresolved entries for this month.
								</p>
							) : (
								<div className="space-y-1">
									{entries.map((entry) => (
										<div
											key={entry.id}
											className="flex items-start gap-2 sm:gap-3 py-2 px-2 sm:px-3 hover:bg-muted/30 rounded-md transition-colors"
										>
											<input
												type="checkbox"
												checked={selectedIds.includes(entry.id)}
												onChange={() => handleToggleEntry(entry.id)}
												className="mt-1 shrink-0 w-4 h-4 touch-manipulation"
											/>
											<SignifierIcon
												signifier={entry.signifier}
												status={entry.status}
												className="mt-0.5 shrink-0"
											/>
											<div className="flex-1 min-w-0">
												<p className="text-sm text-foreground break-words">
													{entry.text}
												</p>
												<p className="text-xs text-muted-foreground mt-0.5">
													{new Date(
														`${entry.date}T12:00:00`,
													).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
													})}
												</p>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleKillEntry(entry.id)}
												className="w-7 h-7 p-0 shrink-0 touch-manipulation"
											>
												<X className="w-4 h-4" />
											</Button>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}
