import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase";
import { errorLabel, severityText } from "@/lib/error-copy";
import { formatDuration } from "@/lib/transcript";
import type { Call } from "@/lib/types";

export const dynamic = "force-dynamic";

type StoredCallError = {
  type?: string;
};

function extractTopError(call: Call): string | null {
  const value = call.call_errors;
  if (!value || typeof value !== "object") return null;
  const errors = Array.isArray((value as { errors?: unknown }).errors)
    ? (value as { errors: StoredCallError[] }).errors
    : [];
  const counts = new Map<string, number>();
  for (const error of errors) {
    if (!error?.type) continue;
    counts.set(error.type, (counts.get(error.type) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function statusText(call: Call): string {
  if (call.analysis_status === "complete") {
    const count = call.error_count ?? 0;
    return `${count} error${count === 1 ? "" : "s"}`;
  }
  if (call.analysis_status === "skipped") return "short skip";
  return call.analysis_status ?? (call.analyzed ? "complete" : "pending");
}

export default async function CallsPage() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) throw error;

  const calls = (data ?? []) as Call[];

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Voxray-style evidence queue</p>
          <h1 className="mt-2 text-4xl font-black text-white">Calls</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Latest ended Ultravox calls. Transcript-backed analysis, short-call skips, top failure type, and end reason.
          </p>
        </div>
        <Link href="/errors" className="border border-white/10 bg-black px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-300 hover:border-emerald-300 hover:text-white">
          error queue
        </Link>
      </div>

      <section className="overflow-hidden border border-white/10 bg-black">
        <div className="grid grid-cols-[1.2fr_90px_110px_130px] border-b border-white/10 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500 md:grid-cols-[1.1fr_150px_90px_120px_170px_150px]">
          <div>Call</div>
          <div className="hidden md:block">Agent</div>
          <div>Duration</div>
          <div>Analysis</div>
          <div>Top issue</div>
          <div className="hidden md:block">End reason</div>
        </div>
        <div className="divide-y divide-white/10">
          {calls.map((call) => {
            const topError = extractTopError(call);
            const critical = (call.critical_error_count ?? 0) > 0;
            const status = statusText(call);
            return (
              <Link
                key={call.id}
                href={`/calls/${encodeURIComponent(call.id)}`}
                className="grid grid-cols-[1.2fr_90px_110px_130px] px-4 py-4 text-sm transition hover:bg-white/[0.03] md:grid-cols-[1.1fr_150px_90px_120px_170px_150px]"
              >
                <div className="min-w-0">
                  <div className="truncate font-black text-white">{call.summary || call.id}</div>
                  <div className="mt-1 truncate text-xs text-zinc-500">{call.id}</div>
                </div>
                <div className="hidden truncate text-xs text-zinc-400 md:block">{call.agent_name ?? call.agent_id}</div>
                <div className={call.duration_seconds && call.duration_seconds >= 30 ? "text-zinc-200" : "text-zinc-600"}>
                  {formatDuration(call.duration_seconds)}
                </div>
                <div className={critical ? severityText("critical") : (call.error_count ?? 0) > 0 ? severityText("high") : call.analysis_status === "complete" ? "text-emerald-300" : "text-yellow-300"}>
                  {status}
                </div>
                <div className={critical ? severityText("critical") : "truncate text-zinc-400"}>
                  {topError ? errorLabel(topError) : call.analysis_status === "skipped" ? "short skip" : "clean"}
                </div>
                <div className="hidden truncate text-xs text-zinc-500 md:block">{call.end_reason ?? "ended"}</div>
              </Link>
            );
          })}
          {calls.length === 0 ? <div className="p-8 text-sm text-zinc-500">No calls synced yet.</div> : null}
        </div>
      </section>
    </main>
  );
}
