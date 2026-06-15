"use client";

import { useState } from "react";
import { VoiceWave } from "./VoiceWave";

type BlueprintResponse = {
  ok?: boolean;
  blueprint?: {
    system_prompt: string;
    based_on_calls: number | null;
    based_on_errors: number | null;
  };
  error?: string;
};

const AGENT_TYPES = [
  { value: "sales",           label: "Sales AI" },
  { value: "debt_collection", label: "Debt Collection" },
  { value: "receptionist",    label: "Inbound Receptionist" },
  { value: "cold_outreach",   label: "Cold Outreach" }
] as const;

export function BlueprintGenerator() {
  const [agentType, setAgentType] = useState("sales");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [prompt, setPrompt] = useState("");
  const [meta, setMeta] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function generate() {
    setStatus("loading");
    setPrompt("");
    setMeta("");
    setErrorMsg("");
    try {
      const response = await fetch("/api/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_type: agentType })
      });
      const data = (await response.json()) as BlueprintResponse;
      if (data.ok && data.blueprint) {
        setPrompt(data.blueprint.system_prompt);
        setMeta(`Based on ${data.blueprint.based_on_calls ?? 0} calls · ${data.blueprint.based_on_errors ?? 0} errors`);
        setStatus("done");
      } else {
        setErrorMsg(data.error ?? "Blueprint generation failed");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error — check console");
      setStatus("error");
    }
  }

  return (
    <section className="space-y-5">
      {/* Controls row */}
      <div className="bg-white border-2 border-ink p-5 shadow-brutal-sm flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink-3" htmlFor="agent-type-select">
            Agent type
          </label>
          <select
            id="agent-type-select"
            value={agentType}
            onChange={(e) => setAgentType(e.target.value)}
            className="input-brutal w-48"
          >
            {AGENT_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={status === "loading"}
          className="btn-brutal btn-brutal-cobalt flex items-center gap-2"
          style={{ padding: "12px 24px" }}
        >
          {status === "loading" ? (
            <>
              <VoiceWave size="sm" color="chalk" bars={5} />
              <span>Generating…</span>
            </>
          ) : (
            "Generate Blueprint →"
          )}
        </button>

        {status === "done" && meta && (
          <span className="font-mono text-[10px] text-[var(--ok)]">✓ {meta}</span>
        )}
        {status === "error" && (
          <span className="font-mono text-[10px] text-[var(--crit)]">{errorMsg}</span>
        )}
      </div>

      {/* Prompt output */}
      {status !== "idle" && (
        <div className="relative">
          {status === "loading" && (
            <div className="border-2 border-chalk-3 bg-chalk-2 p-12 flex flex-col items-center justify-center gap-4">
              <VoiceWave size="lg" color="cobalt" bars={10} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                Synthesizing blueprint from production data…
              </span>
            </div>
          )}
          {status === "done" && (
            <div className="border-2 border-ink shadow-brutal">
              <div className="border-b-2 border-ink bg-chalk-2 flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="badge badge-ok">Ready</span>
                  <span className="font-mono text-[10px] text-ink-3">{meta}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(prompt)}
                  className="btn-brutal"
                  style={{ padding: "4px 12px", fontSize: "10px" }}
                >
                  Copy
                </button>
              </div>
              <textarea
                value={prompt}
                readOnly
                className="w-full bg-white p-5 font-mono text-xs text-ink leading-relaxed outline-none resize-none"
                style={{ minHeight: "600px" }}
              />
            </div>
          )}
          {status === "error" && (
            <div className="border-2 border-[var(--crit)] bg-[var(--crit-bg)] p-6">
              <div className="font-sans font-semibold text-[var(--crit)] mb-1">Generation failed</div>
              <p className="font-mono text-xs text-ink-2">{errorMsg}</p>
            </div>
          )}
        </div>
      )}

      {status === "idle" && (
        <div className="border-2 border-chalk-3 bg-chalk-2 p-16 text-center">
          <div className="font-display text-3xl text-ink-3 mb-3">Blueprint Engine</div>
          <p className="font-sans text-sm text-ink-3 max-w-md mx-auto leading-relaxed">
            Select an agent type and generate a hardened system prompt synthesized from real production failures.
          </p>
        </div>
      )}
    </section>
  );
}
