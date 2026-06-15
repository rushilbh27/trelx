"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VoiceWave } from "./VoiceWave";

async function runAnalysisBatches(batchSize: number, setStatus: (value: string) => void) {
  let analyzed = 0;
  let errors = 0;
  let skippedShort = 0;

  for (let batch = 0; batch < 250; batch += 1) {
    setStatus(`Analyzing batch ${batch + 1}…`);
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: batchSize })
    });
    const data = (await response.json()) as {
      ok?: boolean;
      analyzed?: number;
      errors?: number;
      skippedShort?: number;
      error?: string;
    };
    if (!data.ok) throw new Error(data.error ?? "analysis failed");
    analyzed += data.analyzed ?? 0;
    errors += data.errors ?? 0;
    skippedShort += data.skippedShort ?? 0;
    if ((data.analyzed ?? 0) === 0 && (data.skippedShort ?? 0) === 0) break;
  }

  return { analyzed, errors, skippedShort };
}

type Phase = "idle" | "syncing" | "analyzing" | "done" | "error";

export function DashboardActions() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("Warming up…");
  const [stats, setStats] = useState<{ synced: number; analyzed: number; errors: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const didRun = useRef(false);
  const running = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    let cancelled = false;

    async function runPipeline(opts: { syncLimit?: number; batchSize: number }) {
      if (running.current || cancelled) return;
      running.current = true;
      try {
        setPhase("syncing");
        setStatus(`Syncing latest ${opts.syncLimit ?? 100} calls…`);
        const syncResp = await fetch(`/api/sync?limit=${opts.syncLimit ?? 100}`, { method: "GET" });
        const syncData = (await syncResp.json()) as { ok?: boolean; synced?: number; error?: string };
        if (!syncData.ok) throw new Error(syncData.error ?? "sync failed");

        setPhase("analyzing");
        const analysis = await runAnalysisBatches(opts.batchSize, setStatus);
        if (cancelled) return;

        setStats({ synced: syncData.synced ?? 0, analyzed: analysis.analyzed, errors: analysis.errors });
        setPhase("done");
        setStatus("Pipeline complete");
        startTransition(() => router.refresh());
      } catch (err) {
        if (!cancelled) {
          setPhase("error");
          setStatus(err instanceof Error ? err.message : "Pipeline error");
        }
      } finally {
        running.current = false;
      }
    }

    runPipeline({ syncLimit: 80, batchSize: 25 });
    const interval = window.setInterval(() => {
      runPipeline({ syncLimit: 60, batchSize: 20 });
    }, 90_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router]);

  const isActive = phase === "syncing" || phase === "analyzing" || isPending;

  return (
    <div
      className="flex items-center gap-4 border-2 border-ink bg-white px-4 py-3 shadow-brutal-sm"
      role="status"
      aria-live="polite"
    >
      {/* Wave or done indicator */}
      {isActive ? (
        <VoiceWave size="sm" color="cobalt" bars={6} />
      ) : phase === "done" ? (
        <div className="dot-ok" />
      ) : phase === "error" ? (
        <div className="dot-crit" />
      ) : (
        <div className="dot-live" />
      )}

      {/* Status text */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: phase === "error" ? "var(--crit)" : phase === "done" ? "var(--ok)" : "var(--cobalt)" }}
        >
          {phase === "syncing" ? "Syncing" : phase === "analyzing" ? "Analyzing" : phase === "done" ? "Live" : phase === "error" ? "Error" : "Standby"}
        </span>
        <span className="font-sans text-xs text-ink-3">{status}</span>
        {stats && phase === "done" && (
          <span className="font-mono text-[10px] text-ink-3">
            ↑ {stats.synced} synced · {stats.analyzed} analyzed · {stats.errors} errors
          </span>
        )}
      </div>
    </div>
  );
}
