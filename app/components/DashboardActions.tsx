"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DashboardActions() {
  const [status, setStatus] = useState<string>("arming pipeline");
  const [isPending, startTransition] = useTransition();
  const didRun = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    async function runPipeline() {
      setStatus("syncing latest calls");
      const syncResponse = await fetch("/api/sync?limit=100", { method: "GET" });
      const syncData = (await syncResponse.json()) as { ok?: boolean; synced?: number; error?: string };
      if (!syncData.ok) {
        setStatus(syncData.error ?? "sync failed");
        return;
      }

      let analyzed = 0;
      let errors = 0;
      let skippedShort = 0;
      for (let batch = 0; batch < 8; batch += 1) {
        setStatus(`analyzing batch ${batch + 1}/8`);
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ limit: 10 })
        });
        const data = (await response.json()) as {
          ok?: boolean;
          analyzed?: number;
          errors?: number;
          skippedShort?: number;
          error?: string;
        };
        if (!data.ok) {
          setStatus(data.error ?? "analysis failed");
          return;
        }
        analyzed += data.analyzed ?? 0;
        errors += data.errors ?? 0;
        skippedShort += data.skippedShort ?? 0;
        if ((data.analyzed ?? 0) === 0 && (data.skippedShort ?? 0) === 0) break;
      }

      setStatus(`live: synced ${syncData.synced ?? 0}, analyzed ${analyzed}, errors ${errors}, skipped short ${skippedShort}`);
      startTransition(() => router.refresh());
    }

    runPipeline().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : String(error));
    });
  }, [router]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
        {isPending ? "refreshing" : "auto pipeline"}
      </span>
      <span className="text-xs text-zinc-400">{status}</span>
    </div>
  );
}
