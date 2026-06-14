"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

async function runAnalysisBatches(batchSize: number, setStatus: (value: string) => void) {
  let analyzed = 0;
  let errors = 0;
  let skippedShort = 0;

  for (let batch = 0; batch < 250; batch += 1) {
    setStatus(`analyzing batch ${batch + 1}`);
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

export function DashboardActions() {
  const [status, setStatus] = useState<string>("arming pipeline");
  const [isPending, startTransition] = useTransition();
  const didRun = useRef(false);
  const running = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    let cancelled = false;

    async function runPipeline(options: { syncLimit?: number; fullSync?: boolean; batchSize: number }) {
      if (running.current || cancelled) return;
      running.current = true;

      try {
        const syncLabel = options.fullSync ? "syncing full history" : `syncing latest ${options.syncLimit ?? 100} calls`;
        setStatus(syncLabel);
        const syncResponse = await fetch(
          options.fullSync ? "/api/sync?all=1" : `/api/sync?limit=${options.syncLimit ?? 100}`,
          { method: "GET" }
        );
        const syncData = (await syncResponse.json()) as { ok?: boolean; synced?: number; error?: string };
        if (!syncData.ok) throw new Error(syncData.error ?? "sync failed");

        const analysis = await runAnalysisBatches(options.batchSize, setStatus);
        if (cancelled) return;

        setStatus(
          `live: synced ${syncData.synced ?? 0}, analyzed ${analysis.analyzed}, errors ${analysis.errors}, skipped short ${analysis.skippedShort}`
        );
        startTransition(() => router.refresh());
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : String(error));
      } finally {
        running.current = false;
      }
    }

    runPipeline({ syncLimit: 400, batchSize: 25 });
    const interval = window.setInterval(() => {
      runPipeline({ syncLimit: 80, batchSize: 20 });
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router]);

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/35 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-orange-300/40 bg-orange-400/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-orange-100">
        {isPending ? "refreshing" : "auto pipeline"}
        </span>
        <span className="text-xs text-zinc-400">{status}</span>
      </div>
    </div>
  );
}
