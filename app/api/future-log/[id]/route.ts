import { type NextRequest, NextResponse } from "next/server";
import {
	handleApiError,
	handleValidationError,
} from "@/lib/api-error-handler";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { sanitizeText, validateId } from "@/lib/validation";
import type { FutureLogEntry, Signifier } from "@/types/journal";

const SIGNIFIERS: Signifier[] = [
	"task",
	"appointment",
	"note",
	"memory",
	"important",
];

function serializeEntry(
	entry: Omit<FutureLogEntry, "migrated"> & { migrated: number },
): FutureLogEntry {
	return { ...entry, migrated: entry.migrated === 1 };
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const limited = rateLimitMiddleware(req, { windowMs: 60000, maxRequests: 30 });
	if (limited) return limited;

	try {
		const { id } = await params;
		const idValidation = validateId(id);
		if (!idValidation.valid) {
			return handleValidationError(idValidation.error || "Invalid ID");
		}

		const body = await req.json();
		const updates: string[] = [];
		const values: unknown[] = [];

		if (body.text !== undefined) {
			if (typeof body.text !== "string" || !body.text.trim()) {
				return handleValidationError("text must be a non-empty string");
			}
			updates.push("text = ?");
			values.push(sanitizeText(body.text.trim()));
		}
		if (body.signifier !== undefined) {
			if (!SIGNIFIERS.includes(body.signifier)) {
				return handleValidationError("Invalid signifier");
			}
			updates.push("signifier = ?");
			values.push(body.signifier);
		}
		if (body.target_month !== undefined) {
			if (typeof body.target_month !== "string" || !/^\d{4}-\d{2}$/.test(body.target_month)) {
				return handleValidationError("target_month must use YYYY-MM format");
			}
			updates.push("target_month = ?");
			values.push(body.target_month);
		}
		if (body.migrated !== undefined) {
			if (typeof body.migrated !== "boolean") {
				return handleValidationError("migrated must be a boolean");
			}
			updates.push("migrated = ?");
			values.push(body.migrated ? 1 : 0);
		}
		if (updates.length === 0) {
			return handleValidationError("No supported fields to update");
		}

		values.push(id);
		const db = getDb();
		const result = db.prepare(`UPDATE future_log SET ${updates.join(", ")} WHERE id = ?`).run(...values);
		if (result.changes === 0) {
			return NextResponse.json({ error: "Future entry not found" }, { status: 404 });
		}
		const entry = db.prepare("SELECT * FROM future_log WHERE id = ?").get(id) as
			| (Omit<FutureLogEntry, "migrated"> & { migrated: number })
			| undefined;
		return NextResponse.json(serializeEntry(entry!));
	} catch (error) {
		return handleApiError("update future log entry", error);
	}
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const limited = rateLimitMiddleware(req, { windowMs: 60000, maxRequests: 30 });
	if (limited) return limited;

	try {
		const { id } = await params;
		const idValidation = validateId(id);
		if (!idValidation.valid) {
			return handleValidationError(idValidation.error || "Invalid ID");
		}
		const result = getDb().prepare("DELETE FROM future_log WHERE id = ?").run(id);
		if (result.changes === 0) {
			return NextResponse.json({ error: "Future entry not found" }, { status: 404 });
		}
		return NextResponse.json({ success: true });
	} catch (error) {
		return handleApiError("delete future log entry", error);
	}
}
