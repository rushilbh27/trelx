import { NextResponse } from "next/server";
import { runInitialPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") ?? "100", 10);
    const result = await runInitialPipeline(Number.isFinite(limit) ? limit : 100);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
