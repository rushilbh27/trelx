import { NextResponse } from "next/server";
import { ingestAndAnalyzeCall } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

type UltravoxWebhookPayload = {
  event?: string;
  callId?: string;
  call_id?: string;
  call?: {
    callId?: string;
    call_id?: string;
  };
};

function getCallId(payload: UltravoxWebhookPayload): string | null {
  return payload.call?.callId ?? payload.call?.call_id ?? payload.callId ?? payload.call_id ?? null;
}

function isEndedEvent(event: string | undefined): boolean {
  return event === "call.ended" || event === "call.ended.v1" || event === "ended";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as UltravoxWebhookPayload;
    if (!isEndedEvent(payload.event)) {
      return NextResponse.json({ ok: true, ignored: payload.event ?? "unknown" });
    }

    const callId = getCallId(payload);
    if (!callId) {
      return NextResponse.json({ ok: false, error: "Missing callId" }, { status: 400 });
    }

    const result = await ingestAndAnalyzeCall(callId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
