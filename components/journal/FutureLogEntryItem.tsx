"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { SignifierIcon } from "@/components/journal/SignifierIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FutureLogEntry, Signifier } from "@/types/journal";

const SIGNIFIERS: Signifier[] = ["task", "appointment", "note"];

interface FutureLogEntryItemProps {
	entry: FutureLogEntry;
	onUpdate: (entry: Pick<FutureLogEntry, "id" | "target_month" | "signifier" | "text">) => Promise<void>;
	onMarkMigrated: (id: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

export function FutureLogEntryItem({
	entry,
	onUpdate,
	onMarkMigrated,
	onDelete,
}: FutureLogEntryItemProps) {
	const [editing, setEditing] = useState(false);
	const [text, setText] = useState(entry.text);
	const [targetMonth, setTargetMonth] = useState(entry.target_month);
	const [signifier, setSignifier] = useState(entry.signifier);
	const [error, setError] = useState<string | null>(null);

	const save = async () => {
		if (!text.trim() || !targetMonth) return;
		setError(null);
		try {
			await onUpdate({
				id: entry.id,
				text: text.trim(),
				target_month: targetMonth,
				signifier,
			});
			setEditing(false);
		} catch {
			setError("Could not update this future entry.");
		}
	};

	if (editing) {
		return (
			<div className="space-y-2 rounded-md border border-border p-3">
				<div className="flex flex-wrap gap-1.5">
					{SIGNIFIERS.map((value) => (
						<Button
							key={value}
							type="button"
							size="sm"
							variant={signifier === value ? "default" : "ghost"}
							onClick={() => setSignifier(value)}
						>
							{value}
						</Button>
					))}
				</div>
				<Input aria-label="Edit target month" type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} />
				<Input aria-label="Edit future entry text" value={text} onChange={(event) => setText(event.target.value)} />
				{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
				<div className="flex gap-2">
					<Button type="button" size="sm" onClick={save} disabled={!text.trim() || !targetMonth}>
						Save future entry
					</Button>
					<Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
				</div>
			</div>
		);
	}

	return (
		<div className={`flex items-start gap-2.5 py-1.5 ${entry.migrated ? "opacity-60" : ""}`}>
			<SignifierIcon signifier={entry.signifier} status={entry.migrated ? "migrated" : "open"} />
			<p className="min-w-0 flex-1 break-words text-sm text-foreground">
				{entry.text}{entry.migrated ? " (migrated)" : ""}
			</p>
			<Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${entry.text}`} onClick={() => setEditing(true)}>
				<Pencil />
			</Button>
			{!entry.migrated && (
				<Button type="button" variant="ghost" size="icon-sm" aria-label={`Mark ${entry.text} migrated`} onClick={() => onMarkMigrated(entry.id)}>
					<Check />
				</Button>
			)}
			<Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${entry.text}`} onClick={() => onDelete(entry.id)}>
				<Trash2 />
			</Button>
		</div>
	);
}
