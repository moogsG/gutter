import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, PATCH } from "@/app/api/future-log/[id]/route";
import { getDb } from "@/lib/db";
import { clearRateLimitState } from "@/lib/rate-limit";

const params = { params: Promise.resolve({ id: "fl-lifecycle" }) };

describe("/api/future-log/[id] lifecycle", () => {
	beforeEach(() => {
		const db = getDb();
		db.exec("DELETE FROM future_log");
		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, 0, ?)",
		).run("fl-lifecycle", "2026-10", "task", "Original", "2026-09-02T12:00:00.000Z");
		clearRateLimitState();
	});

	it("edits text, type, and target month", async () => {
		const response = await PATCH(
			new NextRequest("http://localhost/api/future-log/fl-lifecycle", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: "Updated",
					signifier: "appointment",
					target_month: "2026-11",
				}),
			}),
			params,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: "fl-lifecycle",
			text: "Updated",
			signifier: "appointment",
			target_month: "2026-11",
			migrated: false,
		});
	});

	it("marks an entry migrated explicitly", async () => {
		const response = await PATCH(
			new NextRequest("http://localhost/api/future-log/fl-lifecycle", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ migrated: true }),
			}),
			params,
		);

		expect(response.status).toBe(200);
		expect((await response.json()).migrated).toBe(true);
		expect(
			(getDb().prepare("SELECT migrated FROM future_log WHERE id = ?").get("fl-lifecycle") as {
				migrated: number;
			}).migrated,
		).toBe(1);
	});

	it("deletes an entry", async () => {
		const response = await DELETE(
			new NextRequest("http://localhost/api/future-log/fl-lifecycle", { method: "DELETE" }),
			params,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(getDb().prepare("SELECT id FROM future_log WHERE id = ?").get("fl-lifecycle")).toBeUndefined();
	});
});
