import { NextRequest, NextResponse } from "next/server";
import { getJournalDb } from "@/lib/journal-db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getJournalDb();

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.status !== undefined) {
      updates.push("status = ?");
      values.push(body.status);
    }
    if (body.text !== undefined) {
      updates.push("text = ?");
      values.push(body.text);
    }
    if (body.signifier !== undefined) {
      updates.push("signifier = ?");
      values.push(body.signifier);
    }
    if (body.sort_order !== undefined) {
      updates.push("sort_order = ?");
      values.push(body.sort_order);
    }
    if (body.collection_id !== undefined) {
      updates.push("collection_id = ?");
      values.push(body.collection_id);
    }
    if (body.migrated_to !== undefined) {
      updates.push("migrated_to = ?");
      values.push(body.migrated_to);
    }
    if (body.migrated_from !== undefined) {
      updates.push("migrated_from = ?");
      values.push(body.migrated_from);
    }
    if (body.parent_id !== undefined) {
      updates.push("parent_id = ?");
      values.push(body.parent_id);
    }

    updates.push("updated_at = ?");
    values.push(new Date().toISOString());

    values.push(id);

    db.prepare(
      `UPDATE journal_entries SET ${updates.join(", ")} WHERE id = ?`
    ).run(...values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating journal entry:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getJournalDb();
    const hardDelete = req.nextUrl.searchParams.get("hard") === "true";

    if (hardDelete) {
      db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
    } else {
      db.prepare("UPDATE journal_entries SET status = 'killed', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting journal entry:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
