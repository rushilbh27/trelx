import { NextResponse } from "next/server";
import { analyzeEligibleCalls } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

type AnalyzeBody = {
  limit?: number;
};

async function readBody(request: Request): Promise<AnalyzeBody> {
  try {
    const value = (await request.json()) as unknown;
    if (typeof value === "object" && value !== null) return value as AnalyzeBody;
  } catch {
    return {};
  }
  return {};
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const limit = Math.min(Math.max(body.limit ?? 15, 1), 100);
    const result = await analyzeEligibleCalls(limit);

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
