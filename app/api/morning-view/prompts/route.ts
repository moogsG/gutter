import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 30,
  });
  if (limited) return limited;

  try {
    const db = getDb();
    
    const prompts = db.prepare(`
      SELECT * FROM morning_view_prompts
      ORDER BY sort_order ASC
    `).all();

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("Error fetching morning view prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 20,
  });
  if (limited) return limited;

  try {
    const body = await req.json();
    const { title, promptText, sourceType, sourceConfig, frequency, uiConfig } = body;

    if (!title || !promptText || !sourceType || !frequency) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Get max sort_order
    const maxOrder = db.prepare(
      "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM morning_view_prompts"
    ).get() as any;

    const id = `mvp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sortOrder = (maxOrder?.max_order ?? -1) + 1;
    const uiConfigJson = uiConfig && typeof uiConfig === "object" ? JSON.stringify(uiConfig) : null;

    db.prepare(`
      INSERT INTO morning_view_prompts 
      (id, title, prompt_text, source_type, source_config, frequency, ui_config, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      promptText,
      sourceType,
      sourceConfig || null,
      frequency,
      uiConfigJson,
      sortOrder
    );

    const prompt = db.prepare("SELECT * FROM morning_view_prompts WHERE id = ?").get(id);

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Error creating morning view prompt:", error);
    return NextResponse.json(
      { error: "Failed to create prompt" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 20,
  });
  if (limited) return limited;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Prompt ID is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Normalize uiConfig (camelCase from client) → ui_config (snake_case for DB)
    if (updates.uiConfig !== undefined) {
      updates.ui_config = updates.uiConfig && typeof updates.uiConfig === "object"
        ? JSON.stringify(updates.uiConfig)
        : null;
      delete updates.uiConfig;
    }
    
    // Build UPDATE query dynamically based on provided fields
    const allowedFields = ['title', 'prompt_text', 'source_type', 'source_config', 'frequency', 'active', 'sort_order', 'ui_config'];
    const updateFields = Object.keys(updates).filter(k => allowedFields.includes(k));
    
    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const setClause = updateFields.map(f => `${f} = ?`).join(', ');
    const values = updateFields.map(f => updates[f]);

    db.prepare(`
      UPDATE morning_view_prompts 
      SET ${setClause}, updated_at = datetime('now')
      WHERE id = ?
    `).run(...values, id);

    const prompt = db.prepare("SELECT * FROM morning_view_prompts WHERE id = ?").get(id);

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Error updating morning view prompt:", error);
    return NextResponse.json(
      { error: "Failed to update prompt" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 20,
  });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Prompt ID is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    db.prepare("DELETE FROM morning_view_prompts WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting morning view prompt:", error);
    return NextResponse.json(
      { error: "Failed to delete prompt" },
      { status: 500 }
    );
  }
}
