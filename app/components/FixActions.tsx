"use client";

import { useState } from "react";
import { VoiceWave } from "./VoiceWave";

type PatchRow = {
  find_text: string;
  replace_text: string;
  reason: string | null;
};

export function GenerateFixButton({ errorId }: { errorId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [patch, setPatch] = useState<PatchRow | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function generate() {
    setStatus("loading");
    setPatch(null);
    setErrorMsg("");
    try {
      const response = await fetch("/api/fix/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error_id: errorId })
      });
      const data = (await response.json()) as { ok?: boolean; patch?: PatchRow; error?: string };
      if (data.ok && data.patch) {
        setPatch(data.patch);
        setStatus("done");
      } else {
        setErrorMsg(data.error ?? "Generation failed");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error");
      setStatus("error");
    }
  }

  return (
    <div className="border-t-2 border-chalk-3 pt-4 mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={status === "loading"}
          className="btn-brutal btn-brutal-ink flex items-center gap-2"
          style={{ padding: "8px 16px" }}
        >
          {status === "loading" ? (
            <>
              <VoiceWave size="sm" color="chalk" bars={5} />
              <span>Generating…</span>
            </>
          ) : status === "done" ? (
            "✓ Patch Ready"
          ) : (
            "Generate Fix →"
          )}
        </button>

        {status === "error" && (
          <span className="font-mono text-[10px] text-[var(--crit)]">{errorMsg}</span>
        )}
      </div>

      {patch && status === "done" && (
        <div className="mt-5 space-y-4">
          {patch.reason && (
            <div className="bg-[var(--cobalt-bg)] border border-[var(--cobalt-border)] p-3">
              <div className="font-mono text-[9px] uppercase tracking-widest text-cobalt mb-1">Why this fix</div>
              <p className="font-sans text-sm text-ink-2 leading-relaxed m-0">{patch.reason}</p>
            </div>
          )}
          <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-2">Remove (find)</div>
            <pre
              className="bg-[var(--crit-bg)] border-2 border-[var(--crit-border)] p-3 text-xs text-ink-2 overflow-auto max-h-28 whitespace-pre-wrap leading-relaxed"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {patch.find_text}
            </pre>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-2">Replace with</div>
            <pre
              className="bg-[var(--ok-bg)] border-2 border-[var(--ok-border)] p-3 text-xs text-ink overflow-auto max-h-56 whitespace-pre-wrap leading-relaxed"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {patch.replace_text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
