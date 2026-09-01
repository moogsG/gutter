import { NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import {
  applyRecommendedMorningViewStack,
  getRecommendedMorningViewStackAudit,
} from "@/lib/morning-view-presets";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60_000,
    maxRequests: 20,
  });
  if (limited) return limited;

  try {
    return NextResponse.json({
      preset: getRecommendedMorningViewStackAudit(),
    });
  } catch (error) {
    console.error("Error loading morning-view presets:", error);
    return NextResponse.json(
      { error: "Failed to load Today Focus preset audit" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60_000,
    maxRequests: 10,
  });
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.presetId && body.presetId !== "jynx-recommended") {
      return NextResponse.json({ error: "Unknown preset" }, { status: 400 });
    }

    return NextResponse.json({
      preset: applyRecommendedMorningViewStack(),
    });
  } catch (error) {
    console.error("Error applying morning-view preset:", error);
    return NextResponse.json(
      { error: "Failed to apply Today Focus preset" },
      { status: 500 },
    );
  }
}
