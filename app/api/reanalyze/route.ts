import { NextResponse } from "next/server";
import { reanalyzeRecentCalls } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

type Body = {
  limit?: number;
};

async function readBody(request: Request): Promise<Body> {
  try {
    const value = (await request.json()) as unknown;
    if (typeof value === "object" && value !== null) return value as Body;
  } catch {
    return {};
  }
  return {};
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const limit = Math.min(Math.max(body.limit ?? 100, 1), 500);
    const result = await reanalyzeRecentCalls(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
