import { NextResponse } from "next/server";
import { inspect } from "node:util";
import { syncLatestCalls } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") ?? "100", 10);
    const all = searchParams.get("all") === "1";
    const result = await syncLatestCalls(Number.isFinite(limit) ? limit : 100, all);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("SYNC_ROUTE_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : inspect(error, { depth: 4 }) },
      { status: 500 }
    );
  }
}
