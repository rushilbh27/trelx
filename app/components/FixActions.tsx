"use client";

import { useState } from "react";

type PatchRow = {
  id: string;
  find_text: string;
  replace_text: string;
  reason: string | null;
  before_rate: number | null;
  after_rate: number | null;
  status: string;
};

export function GenerateFixButton({ errorId }: { errorId: string }) {
  const [status, setStatus] = useState("");
  const [patch, setPatch] = useState<PatchRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setStatus("generating");
    const response = await fetch("/api/fix/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error_id: errorId })
    });
    const data = (await response.json()) as { ok?: boolean; patch?: PatchRow; error?: string };
    setPatch(data.patch ?? null);
    setStatus(data.ok ? "patch generated" : data.error ?? "generation failed");
    setBusy(false);
  }

  async function simulate() {
    if (!patch) return;
    setBusy(true);
    setStatus("simulating");
    const response = await fetch("/api/fix/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch_id: patch.id })
    });
    const data = (await response.json()) as { ok?: boolean; patch?: PatchRow; error?: string };
    if (data.patch) setPatch(data.patch);
    setStatus(data.ok ? "simulation complete" : data.error ?? "simulation failed");
    setBusy(false);
  }

  return (
    <div className="mt-4 rounded-[24px] border border-white/8 bg-[#161110] p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded-full border border-orange-300 bg-orange-300 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black disabled:opacity-50"
        >
          Generate Fix
        </button>
        <button
          type="button"
          onClick={simulate}
          disabled={busy || !patch}
          className="rounded-full border border-orange-300/20 bg-[#1a1512] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          Simulate
        </button>
        {patch ? (
          <button
            type="button"
            disabled
            className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500"
            title="Ultravox mutation disabled. Apply manually."
          >
            Manual Apply
          </button>
        ) : null}
      </div>
      {status ? <div className="mt-3 text-xs text-zinc-400">{status}</div> : null}
      {patch ? (
        <div className="mt-4 grid gap-3 text-xs">
          <div>
            <div className="mb-1 text-zinc-500">Find</div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap border border-white/10 bg-black p-3 text-zinc-300">{patch.find_text}</pre>
          </div>
          <div>
            <div className="mb-1 text-zinc-500">Replace</div>
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-orange-300/15 bg-[#110d0c] p-3 text-orange-100">{patch.replace_text}</pre>
          </div>
          <div className="grid gap-2 rounded-2xl border border-white/10 p-3 md:grid-cols-3">
            <div>Before: {patch.before_rate ?? "-"}%</div>
            <div>After: {patch.after_rate ?? "-"}%</div>
            <div>Status: {patch.status}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
