"use client";

import { useCallback, useEffect, useState } from "react";
import { EntryInput } from "@/components/journal/EntryInput";
import { EntryList } from "@/components/journal/EntryList";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { TodayFocus } from "@/components/journal/TodayFocus";
import { MorningView } from "@/components/journal/MorningView";
import { CaptureDialog } from "@/components/journal/CaptureDialog";
import { EmptyTodayPrompt } from "@/components/journal/EmptyTodayPrompt";
import {
	journalApi,
	useAddEntryMutation,
	useDeleteEntryMutation,
	useGetEntriesQuery,
	useMigrateEntriesMutation,
	useUpdateEntryMutation,
} from "@/store/api/journalApi";
import { useAppDispatch } from "@/store/store";
import type { Signifier } from "@/types/journal";
import { toast } from "sonner";

function formatDate(date: Date): string {
	return date.toISOString().split("T")[0];
}

function getMigrateTargetDate(viewDate: string): string {
	const today = formatDate(new Date());
	if (viewDate === today) {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return formatDate(tomorrow);
	}
	return today;
}

function findEntryById(entries: any[], id: string): any | undefined {
	for (const entry of entries) {
		if (entry.id === id) return entry;
		if (entry.children?.length) {
			const found = findEntryById(entry.children, id);
			if (found) return found;
		}
	}
	return undefined;
}

export default function JournalPage() {
	const [currentDate, setCurrentDate] = useState<string>(
		formatDate(new Date()),
	);
	const { data: entries = [], isLoading } = useGetEntriesQuery(currentDate);
	const [addEntry] = useAddEntryMutation();
	const [updateEntry] = useUpdateEntryMutation();
	const [deleteEntry] = useDeleteEntryMutation();
	const [migrateEntries] = useMigrateEntriesMutation();
	const dispatch = useAppDispatch();

	// Prefetch adjacent days for instant navigation
	useEffect(() => {
		const current = new Date(`${currentDate}T12:00:00`);
		const prev = new Date(current);
		prev.setDate(prev.getDate() - 1);
		const next = new Date(current);
		next.setDate(next.getDate() + 1);

		dispatch(
			journalApi.endpoints.getEntries.initiate(formatDate(prev), {
				forceRefetch: false,
			}),
		);
		dispatch(
			journalApi.endpoints.getEntries.initiate(formatDate(next), {
				forceRefetch: false,
			}),
		);
	}, [currentDate, dispatch]);

	// Listen for OmniBar date navigation
	useEffect(() => {
		const handler = (e: Event) => {
			const date = (e as CustomEvent<string>).detail;
			if (date) setCurrentDate(date);
		};
		window.addEventListener("omnibar-navigate-date", handler);
		return () => window.removeEventListener("omnibar-navigate-date", handler);
	}, []);

	const handlePrevDay = useCallback(() => {
		setCurrentDate((prev) => {
			const date = new Date(`${prev}T12:00:00`);
			date.setDate(date.getDate() - 1);
			return formatDate(date);
		});
	}, []);

	const handleNextDay = useCallback(() => {
		setCurrentDate((prev) => {
			const date = new Date(`${prev}T12:00:00`);
			date.setDate(date.getDate() + 1);
			return formatDate(date);
		});
	}, []);

	const handleToday = useCallback(() => {
		setCurrentDate(formatDate(new Date()));
	}, []);

	const handleAddEntry = useCallback(
		(signifier: Signifier, text: string, metadata?: { lane?: string | null; priority?: string | null; waiting_on?: string | null; status?: string | null }) => {
			addEntry({
				date: currentDate,
				signifier,
				text,
				tags: text.includes("@jynx") ? ["@jynx"] : [],
				...(metadata?.lane && { lane: metadata.lane as any }),
				...(metadata?.priority && { priority: metadata.priority as any }),
				...(metadata?.waiting_on && { waiting_on: metadata.waiting_on }),
				...(metadata?.status && { status: metadata.status as any }),
			});
		},
		[addEntry, currentDate],
	);

	const handleToggle = useCallback(
		async (id: string) => {
			const entry = findEntryById(entries as any[], id);
			if (!entry) return;

			const newStatus = entry.status === "open" ? "done" : "open";
			try {
				await updateEntry({ id, status: newStatus, _date: currentDate }).unwrap();
			} catch {
				toast.error("Failed to update task");
			}
		},
		[entries, updateEntry, currentDate],
	);

	const handleMigrate = useCallback(
		async (id: string) => {
			try {
				const result = await migrateEntries({
					entryIds: [id],
					targetDate: getMigrateTargetDate(currentDate),
				}).unwrap();
				toast.success(`Migrated to ${result.targetDate}`);
			} catch {
				toast.error("Failed to migrate");
			}
		},
		[migrateEntries, currentDate],
	);

	const handleKill = useCallback(
		(id: string) => {
			updateEntry({ id, status: "killed", _date: currentDate });
		},
		[updateEntry, currentDate],
	);

	const handleDelete = useCallback(
		(id: string) => {
			if (confirm("Permanently delete this entry?")) {
				deleteEntry({ id, hard: true, _date: currentDate });
			}
		},
		[deleteEntry, currentDate],
	);

	const [captureOpen, setCaptureOpen] = useState(false);

	const handleEntriesCreated = useCallback(() => {
		dispatch(
			journalApi.util.invalidateTags([
				"JournalDay",
				"Collections",
				"FutureLog",
				"JournalMonth",
			]),
		);
		// Force refetch to ensure UI updates immediately
		dispatch(
			journalApi.endpoints.getEntries.initiate(currentDate, {
				forceRefetch: true,
			}),
		);
	}, [dispatch, currentDate]);

	const handleOpenCapture = useCallback(() => {
		setCaptureOpen(true);
	}, []);

	// Keyboard shortcuts for capture
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Cmd+Shift+C opens capture dialog
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "c") {
				e.preventDefault();
				setCaptureOpen(true);
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, []);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-screen">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	const prioritizedEntries = [...entries].sort((a, b) => {
		const order = (status: string) => {
			switch (status) {
				case "blocked":
					return 0;
				case "in-progress":
					return 1;
				case "open":
					return 2;
				case "done":
					return 3;
				default:
					return 4;
			}
		};
		const byStatus = order(a.status) - order(b.status);
		if (byStatus !== 0) return byStatus;
		return a.sort_order - b.sort_order;
	});

	return (
		<>
			<JournalHeader
				date={currentDate}
				onPrevDay={handlePrevDay}
				onNextDay={handleNextDay}
				onToday={handleToday}
				captureOpen={captureOpen}
				onCaptureChange={setCaptureOpen}
			/>
			<CaptureDialog
				date={currentDate}
				onEntriesCreated={handleEntriesCreated}
				open={captureOpen}
				onOpenChange={setCaptureOpen}
			/>
			<EntryInput date={currentDate} onSubmit={handleAddEntry} />
			{entries.length === 0 ? (
				<EmptyTodayPrompt date={currentDate} onOpenCapture={handleOpenCapture} />
			) : (
				<>
					<MorningView date={currentDate} onOpenCapture={handleOpenCapture} />
					<TodayFocus entries={entries} date={currentDate} />
					<EntryList
						entries={prioritizedEntries}
						onToggle={handleToggle}
						onMigrate={handleMigrate}
						onKill={handleKill}
						onDelete={handleDelete}
					/>
				</>
			)}
		</>
	);
}
