import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Collection } from "@/types/journal";

export async function GET() {
  try {
    const db = getDb();
    const collections = db
      .prepare(
        `SELECT c.*, 
                (SELECT COUNT(*) FROM journal_entries WHERE collection_id = c.id) as entry_count
         FROM collections c
         ORDER BY c.created_at DESC`
      )
      .all() as Collection[];

    return NextResponse.json(collections);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, icon } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    const db = getDb();
    const id = `col-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO collections (id, title, icon, created_at) VALUES (?, ?, ?, ?)"
    ).run(id, title, icon || null, now);

    const collection = db
      .prepare("SELECT * FROM collections WHERE id = ?")
      .get(id) as Collection;

    return NextResponse.json(collection);
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
