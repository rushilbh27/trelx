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

  const [copiedFind, setCopiedFind] = useState(false);
  const [copiedReplace, setCopiedReplace] = useState(false);

  async function handleCopy(text: string, type: "find" | "replace") {
    await navigator.clipboard.writeText(text);
    if (type === "find") {
      setCopiedFind(true);
      setTimeout(() => setCopiedFind(false), 2000);
    } else {
      setCopiedReplace(true);
      setTimeout(() => setCopiedReplace(false), 2000);
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

        {status === "done" && (
          <button
            type="button"
            className="btn-brutal flex items-center gap-2 bg-[var(--warn)] border-[var(--warn-border)] text-ink"
            style={{ padding: "8px 16px", cursor: "pointer" }}
            onClick={() => alert("Apply Patch functionality is not connected in this demo.")}
          >
            <span>⚠️ Apply Patch to Agent</span>
          </button>
        )}

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
          <div className="relative">
            <div className="flex justify-between items-center mb-2">
              <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3">Remove (find)</div>
              <button 
                onClick={() => handleCopy(patch.find_text, "find")}
                className={`font-mono text-[9px] px-2 py-1 border-2 transition-colors ${copiedFind ? "bg-[var(--ok)] text-white border-[var(--ok-border)]" : "bg-white border-ink text-ink hover:bg-chalk-2"}`}
              >
                {copiedFind ? "✓ COPIED" : "COPY"}
              </button>
            </div>
            <pre
              className="bg-[var(--crit-bg)] border-2 border-[var(--crit-border)] p-3 text-xs text-ink-2 overflow-auto max-h-28 whitespace-pre-wrap leading-relaxed"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {patch.find_text}
            </pre>
          </div>
          <div className="relative">
            <div className="flex justify-between items-center mb-2">
              <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3">Replace with</div>
              <button 
                onClick={() => handleCopy(patch.replace_text, "replace")}
                className={`font-mono text-[9px] px-2 py-1 border-2 transition-colors ${copiedReplace ? "bg-[var(--ok)] text-white border-[var(--ok-border)]" : "bg-white border-ink text-ink hover:bg-chalk-2"}`}
              >
                {copiedReplace ? "✓ COPIED" : "COPY"}
              </button>
            </div>
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
