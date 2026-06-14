import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      manual: true,
      error: "Ultravox mutation disabled. Apply approved prompt changes manually in Ultravox."
    },
    { status: 409 }
  );
}
