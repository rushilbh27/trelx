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
      setStatus("syncing + analyzing latest 100");
      const response = await fetch("/api/pipeline?limit=100", { method: "POST" });
      const data = (await response.json()) as {
        ok?: boolean;
        synced?: number;
        analyzed?: number;
        errors?: number;
        skippedShort?: number;
        error?: string;
      };
      if (!data.ok) {
        setStatus(data.error ?? "pipeline failed");
        return;
      }
      setStatus(
        `live: synced ${data.synced ?? 0}, analyzed ${data.analyzed ?? 0}, errors ${data.errors ?? 0}, skipped short ${data.skippedShort ?? 0}`
      );
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
