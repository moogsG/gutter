import { NextRequest, NextResponse } from "next/server";
import { getJournalDb } from "@/lib/journal-db";
import { randomBytes } from "crypto";

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

// GET /api/projects - List all active projects
export async function GET() {
  try {
    const db = getJournalDb();
    const projects = db
      .prepare("SELECT * FROM projects WHERE active = 1 ORDER BY created_at DESC")
      .all() as Project[];

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create or update a project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, color, icon, active } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const db = getJournalDb();
    const projectId = id || randomBytes(16).toString("hex");

    if (id) {
      // Update existing project
      db.prepare(
        `UPDATE projects 
         SET name = ?, description = ?, color = ?, icon = ?, active = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        name.trim(),
        description || null,
        color || null,
        icon || null,
        active !== undefined ? (active ? 1 : 0) : 1,
        id
      );
    } else {
      // Create new project
      db.prepare(
        `INSERT INTO projects (id, name, description, color, icon, active)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        projectId,
        name.trim(),
        description || null,
        color || null,
        icon || null,
        active !== undefined ? (active ? 1 : 0) : 1
      );
    }

    const project = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(projectId) as Project;

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error creating/updating project:", error);
    return NextResponse.json(
      { error: "Failed to save project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects?id=<projectId> - Soft delete (set active = 0)
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const db = getJournalDb();
    db.prepare("UPDATE projects SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
