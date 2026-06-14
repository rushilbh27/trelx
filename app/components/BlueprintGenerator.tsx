"use client";

import { useState } from "react";

type BlueprintResponse = {
  ok?: boolean;
  blueprint?: {
    system_prompt: string;
    based_on_calls: number | null;
    based_on_errors: number | null;
  };
  error?: string;
};

export function BlueprintGenerator() {
  const [agentType, setAgentType] = useState("sales");
  const [status, setStatus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [meta, setMeta] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setStatus("generating blueprint");
    const response = await fetch("/api/blueprint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_type: agentType })
    });
    const data = (await response.json()) as BlueprintResponse;
    if (data.ok && data.blueprint) {
      setPrompt(data.blueprint.system_prompt);
      setMeta(`${data.blueprint.based_on_calls ?? 0} calls, ${data.blueprint.based_on_errors ?? 0} errors`);
      setStatus("blueprint generated");
    } else {
      setStatus(data.error ?? "blueprint failed");
    }
    setBusy(false);
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-zinc-400">
          Agent type
          <select
            value={agentType}
            onChange={(event) => setAgentType(event.target.value)}
            className="border border-white/15 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="sales">sales</option>
            <option value="debt_collection">debt_collection</option>
            <option value="receptionist">receptionist</option>
            <option value="cold_outreach">cold_outreach</option>
          </select>
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="border border-emerald-300 bg-emerald-300 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-black disabled:opacity-50"
        >
          Generate Blueprint
        </button>
        {status ? <span className="text-xs text-zinc-400">{status}</span> : null}
        {meta ? <span className="text-xs text-emerald-300">{meta}</span> : null}
      </div>
      <textarea
        value={prompt}
        readOnly
        placeholder="Generated prompt appears here."
        className="min-h-[620px] w-full border border-white/10 bg-black p-5 text-sm leading-6 text-zinc-100 outline-none"
      />
    </section>
  );
}
