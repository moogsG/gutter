"use client";

import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { SignifierIcon } from "@/components/journal/SignifierIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	useGetUnresolvedQuery,
	useMigrateEntriesMutation,
	useUpdateEntryMutation,
} from "@/store/api/journalApi";
import { toast } from "sonner";
import { getJournalDate } from "@/lib/journal-date";

function formatMonth(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getTodayDateString(): string {
	return getJournalDate();
}

export default function MigratePage() {
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [mutationError, setMutationError] = useState<string | null>(null);
	const [migrationFailed, setMigrationFailed] = useState(false);
	const [failedKillId, setFailedKillId] = useState<string | null>(null);
	const [killingId, setKillingId] = useState<string | null>(null);

	const todayDate = getTodayDateString();
	const { data: entries = [] } = useGetUnresolvedQuery({
		before: todayDate,
	});
	const [migrateEntries, { isLoading: isMigrating }] = useMigrateEntriesMutation();
	const [updateEntry] = useUpdateEntryMutation();

	const handleToggleEntry = (id: string) => {
		setSelectedIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	const handleMigrateSelected = async () => {
		if (selectedIds.length === 0) return;
		setMutationError(null);
		setMigrationFailed(false);
		try {
			const result = await migrateEntries({
				entryIds: selectedIds,
				targetDate: getTodayDateString(),
			}).unwrap();
			toast.success(
				`Migrated ${result.migratedCount} entr${result.migratedCount === 1 ? "y" : "ies"} to ${result.targetDate}`,
			);
			if (result.skippedCount > 0) {
				toast.message(`Skipped ${result.skippedCount} entr${result.skippedCount === 1 ? "y" : "ies"}`);
			}
			setSelectedIds([]);
		} catch {
			toast.error("Failed to migrate selected entries");
			setMigrationFailed(true);
			setMutationError("Could not migrate the selected entries. Your selection is still here.");
		}
	};

	const handleKillEntry = async (id: string) => {
		setMutationError(null);
		setMigrationFailed(false);
		setKillingId(id);
		try {
			await updateEntry({ id, status: "killed" }).unwrap();
			setFailedKillId(null);
		} catch {
			setFailedKillId(id);
			setMutationError("Could not kill that entry. It remains in the migration list.");
		} finally {
			setKillingId(null);
		}
	};

	useEffect(() => {
		setSelectedIds((prev) => prev.filter((id) => entries.some((entry) => entry.id === id)));
	}, [entries]);

	return (
		<>
			<JournalHeader
				date={todayDate}
				onPrevDay={() => {}}
				onNextDay={() => {}}
				onToday={() => {}}
			/>
			<div className="flex-1 overflow-auto p-3 sm:p-6">
				<div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
					<div>
						<h2 className="text-lg sm:text-2xl font-bold text-foreground">
							Migration Review
						</h2>
						<p className="text-sm text-muted-foreground">
							All unfinished entries from before today
						</p>
					</div>

					{mutationError && (
						<p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
							{mutationError}
						</p>
					)}

					{selectedIds.length > 0 && (
						<Card>
							<CardContent className="py-3 px-3 sm:px-6">
								<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
									<span className="text-sm text-foreground font-medium">
										{selectedIds.length} selected
									</span>
									<span className="text-xs text-muted-foreground sm:ml-auto">
										Target: Today ({todayDate})
									</span>
									<Button
										onClick={handleMigrateSelected}
										disabled={isMigrating}
										size="sm"
										className="shrink-0"
									>
										<ArrowRight className="w-4 h-4 mr-2" />
										{migrationFailed ? "Try migration again" : isMigrating ? "Migrating…" : "Migrate"}
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2">
							<CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-muted-foreground">
								Previous Unfinished Entries ({entries.length})
							</CardTitle>
						</CardHeader>
						<CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
							{entries.length === 0 ? (
								<p className="text-sm text-muted-foreground text-center py-8">
									No unfinished entries from previous days.
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
												disabled={killingId === entry.id}
												aria-label={failedKillId === entry.id
													? `Try killing ${entry.text} again`
													: `Kill ${entry.text}`}
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
