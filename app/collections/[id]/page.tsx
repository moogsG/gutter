"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { SignifierIcon } from "@/components/journal/SignifierIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetCollectionQuery } from "@/store/api/journalApi";

export default function CollectionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const { data: collection, isLoading } = useGetCollectionQuery(id);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-screen">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (!collection) {
		return (
			<div className="flex items-center justify-center h-screen">
				<p className="text-muted-foreground">Collection not found</p>
			</div>
		);
	}

	return (
		<>
			<JournalHeader
				date={new Date().toISOString().split("T")[0]}
				onPrevDay={() => {}}
				onNextDay={() => {}}
				onToday={() => {}}
			/>
			<div className="flex-1 overflow-auto p-6">
				<div className="max-w-4xl mx-auto">
					<div className="flex items-center gap-4 mb-6">
						<Link href="/collections">
							<Button variant="ghost" size="sm">
								<ArrowLeft className="w-4 h-4 mr-2" />
								Back
							</Button>
						</Link>
						<h2 className="text-2xl font-bold text-foreground">
							{collection.title}
						</h2>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
								Entries ({collection.entries?.length || 0})
							</CardTitle>
						</CardHeader>
						<CardContent>
							{!collection.entries || collection.entries.length === 0 ? (
								<p className="text-sm text-muted-foreground text-center py-8">
									No entries in this collection yet.
								</p>
							) : (
								<div className="space-y-3">
									{collection.entries.map((entry) => (
										<div
											key={entry.id}
											className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
										>
											<SignifierIcon
												signifier={entry.signifier}
												status={entry.status}
												className="mt-0.5"
											/>
											<div className="flex-1 min-w-0">
												<p className="text-sm text-foreground">{entry.text}</p>
												<p className="text-xs text-muted-foreground mt-1">
													{new Date(entry.date).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
														year: "numeric",
													})}
												</p>
											</div>
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
