import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";

const ACCLI_CMD = process.env.ACCLI_CMD || "accli";
const TMP_DIR = "/tmp/gutter-calendar";

import { getCalendarNames } from "@/lib/calendars";

// Build calendar list from ENV — IDs resolved dynamically by accli
const CALENDARS = getCalendarNames().map((name) => ({ name, id: name }));

// Ensure tmp dir exists
if (!existsSync(TMP_DIR)) {
	mkdirSync(TMP_DIR, { recursive: true });
}

function fetchCalendarEvents(
	_calendarId: string,
	calendarName: string,
	from: string,
	to: string,
	max: number,
): any[] {
	const tmpFile = join(TMP_DIR, `${randomUUID()}.json`);
	try {
		// Write to temp file to avoid pipe buffer truncation
		execSync(
			`"${ACCLI_CMD}" events "${calendarName}" --from "${from}" --to "${to}" --max ${max} --json > "${tmpFile}"`,
			{ timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] },
		);

		const raw = readFileSync(tmpFile, "utf-8");
		const data = JSON.parse(raw);
		return (data.events || []).map((e: any) => ({
			...e,
			calendarSource: calendarName,
		}));
	} catch (err: any) {
		console.error(
			`Failed to fetch ${calendarName}:`,
			err.message?.substring(0, 200),
		);
		return [];
	} finally {
		try {
			unlinkSync(tmpFile);
		} catch {}
	}
}

export async function GET(request: NextRequest) {
	// Rate limit calendar fetches (50 per minute)
	const limited = rateLimitMiddleware(request, {
		windowMs: 60000,
		maxRequests: 50,
	});
	if (limited) return limited;

	try {
		const { searchParams } = new URL(request.url);
		const month = searchParams.get("month");

		let fromStr: string;
		let toStr: string;

		if (month) {
			const [year, monthNum] = month.split("-");
			const startDate = new Date(
				parseInt(year, 10),
				parseInt(monthNum, 10) - 1,
				1,
			);
			const endDate = new Date(parseInt(year, 10), parseInt(monthNum, 10), 0);
			fromStr = startDate.toISOString().split("T")[0];
			toStr = endDate.toISOString().split("T")[0];
		} else {
			const now = new Date();
			const endDate = new Date();
			endDate.setDate(endDate.getDate() + 7);
			fromStr = now.toISOString().split("T")[0];
			toStr = endDate.toISOString().split("T")[0];
		}

		const maxEvents = month ? 100 : 10;

		// Fetch all calendars (sync per calendar, but fast since it's local CLI)
		const allEvents = CALENDARS.flatMap((cal) =>
			fetchCalendarEvents(cal.id, cal.name, fromStr, toStr, maxEvents),
		);

		let upcoming = allEvents
			.sort(
				(a: any, b: any) =>
					new Date(a.startISO).getTime() - new Date(b.startISO).getTime(),
			)
			.map((e: any) => ({
				id: e.id,
				title: e.summary,
				startDate: e.startISO,
				endDate: e.endISO,
				calendar: e.calendarSource || e.calendar,
				allDay: e.allDay,
			}));

		if (!month) {
			upcoming = upcoming.filter((e: any) => !e.allDay).slice(0, 5);
		}

		return Response.json({ events: upcoming });
	} catch (error) {
		console.error("Calendar fetch error:", error);
		return Response.json(
			{ error: "Failed to fetch calendar" },
			{ status: 500 },
		);
	}
}
