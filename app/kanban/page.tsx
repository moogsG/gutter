"use client";

import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState } from "react";
import { KanbanCardOverlay } from "@/components/journal/KanbanCard";
import { KanbanColumn } from "@/components/journal/KanbanColumn";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type KanbanStatus,
	useGetKanbanBoardTasksQuery,
	useMoveTaskMutation,
} from "@/store/api/tasksApi";
import type { Task } from "@/types";

function formatDate(date: Date): string {
	return date.toISOString().split("T")[0];
}


const COLUMNS: {
	id: KanbanStatus;
	title: string;
	accentClass: string;
	countClass: string;
}[] = [
	{
		id: "todo",
		title: "To Do",
		accentClass: "bg-muted-foreground",
		countClass: "bg-muted text-muted-foreground",
	},
	{
		id: "in-progress",
		title: "In Progress",
		accentClass: "bg-primary",
		countClass: "bg-primary/15 text-primary",
	},
	{
		id: "blocked",
		title: "Blocked",
		accentClass: "bg-destructive",
		countClass: "bg-destructive/15 text-destructive",
	},
	{
		id: "done",
		title: "Done",
		accentClass: "bg-chart-3",
		countClass: "bg-chart-3/15 text-chart-3",
	},
];

// Map kanban column id to DB status string for the move mutation
const COLUMN_TO_DB_STATUS: Record<KanbanStatus, string> = {
	todo: "open",
	"in-progress": "in-progress",
	blocked: "blocked",
	done: "done",
};

function KanbanSkeleton() {
	return (
		<div className="flex gap-4 p-6 overflow-x-auto">
			{COLUMNS.map((col) => (
				<div key={col.id} className="flex flex-col w-[280px]">
					<Skeleton className="h-5 w-24 mb-3" />
					<div className="rounded-xl border border-border/50 bg-muted/30 p-2 space-y-2 min-h-[200px]">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-20 w-3/4" />
					</div>
				</div>
			))}
		</div>
	);
}

export default function KanbanPage() {
	const [currentDate, setCurrentDate] = useState<string>(
		formatDate(new Date()),
	);
	const [activeTask, setActiveTask] = useState<Task | null>(null);
	const [moveTask] = useMoveTaskMutation();

	const boardQuery = useGetKanbanBoardTasksQuery({
		date: currentDate,
	});

	const isLoading = boardQuery.isLoading;

	const columnTasks = useMemo<Record<KanbanStatus, Task[]>>(() => {
		const safeTasks = (boardQuery.data ?? []).filter(
			(task): task is Task =>
				Boolean(task) && typeof task === "object" && typeof task.id === "string" && task.id.length > 0,
		);

		return {
			todo: safeTasks.filter((task) => task.status === "open"),
			"in-progress": safeTasks.filter((task) => task.status === "in-progress"),
			blocked: safeTasks.filter((task) => task.status === "blocked"),
			done: safeTasks.filter((task) => task.status === "done"),
		};
	}, [boardQuery.data]);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
	);

	const goToPrevDay = useCallback(() => {
		const d = new Date(`${currentDate}T12:00:00`);
		d.setDate(d.getDate() - 1);
		setCurrentDate(formatDate(d));
	}, [currentDate]);

	const goToNextDay = useCallback(() => {
		const d = new Date(`${currentDate}T12:00:00`);
		d.setDate(d.getDate() + 1);
		setCurrentDate(formatDate(d));
	}, [currentDate]);

	const goToToday = useCallback(() => {
		setCurrentDate(formatDate(new Date()));
	}, []);

	const handleDragStart = useCallback(
		(event: DragStartEvent) => {
			const { active } = event;
			for (const col of COLUMNS) {
				const found = columnTasks[col.id].find((t) => t.id === active.id);
				if (found) {
					setActiveTask(found);
					return;
				}
			}
		},
		[columnTasks],
	);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event;
			setActiveTask(null);

			if (!over) return;

			const overId = over.id as string;

			// Determine which column the card was dropped into
			let targetColumn: KanbanStatus | null = null;
			if (COLUMNS.some((c) => c.id === overId)) {
				targetColumn = overId as KanbanStatus;
			} else {
				// over is a card — find which column it belongs to
				for (const col of COLUMNS) {
					if (columnTasks[col.id].some((t) => t.id === overId)) {
						targetColumn = col.id;
						break;
					}
				}
			}

			if (!targetColumn) return;

			// Find source column
			let sourceColumn: KanbanStatus | null = null;
			for (const col of COLUMNS) {
				if (columnTasks[col.id].some((t) => t.id === active.id)) {
					sourceColumn = col.id;
					break;
				}
			}

			if (!sourceColumn || sourceColumn === targetColumn) return;

			moveTask({
				taskId: active.id as string,
				status: COLUMN_TO_DB_STATUS[targetColumn],
			});
		},
		[columnTasks, moveTask],
	);

	if (isLoading) return <KanbanSkeleton />;

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<JournalHeader
				date={currentDate}
				onPrevDay={goToPrevDay}
				onNextDay={goToNextDay}
				onToday={goToToday}
			/>

			{/* Board */}
			<DndContext
				sensors={sensors}
				collisionDetection={pointerWithin}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
			>
				<div className="flex-1 overflow-x-auto overflow-y-hidden">
					<div className="flex gap-4 p-6 h-full min-w-max">
						{COLUMNS.map((col) => (
							<div key={col.id} className="w-[280px] xl:w-[300px] flex">
								<KanbanColumn
									id={col.id}
									title={col.title}
									tasks={columnTasks[col.id]}
									accentClass={col.accentClass}
									countClass={col.countClass}
								/>
							</div>
						))}
					</div>
				</div>

				<DragOverlay>
					{activeTask ? <KanbanCardOverlay task={activeTask} /> : null}
				</DragOverlay>
			</DndContext>
		</div>
	);
}
