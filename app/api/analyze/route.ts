import { NextResponse } from "next/server";
import { inspect } from "node:util";
import { analyzeAllEligibleCalls, analyzeEligibleCalls } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    // Supabase errors are plain objects with { message, code, details }
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    return inspect(error, { depth: 3 });
  }
  return String(error);
}

type AnalyzeBody = {
  limit?: number;
  all?: boolean;
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

    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      return NextResponse.json({
        ok: true,
        message: "Demo mode active. Background batch analysis is disabled to protect API credits."
      });
    }

    const result = body.all ? await analyzeAllEligibleCalls(limit) : await analyzeEligibleCalls(limit);

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("ANALYZE_ROUTE_ERROR", error);
    return NextResponse.json(
      { ok: false, error: serializeError(error) },
      { status: 500 }
    );
  }
}
