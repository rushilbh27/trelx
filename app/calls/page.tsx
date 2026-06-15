import Link from "next/link";
import { MAX_ANALYSIS_SECONDS, MIN_ANALYSIS_SECONDS } from "@/lib/analysis-window";
import { createServerSupabase } from "@/lib/supabase";
import { errorLabel } from "@/lib/error-copy";
import { formatDuration } from "@/lib/transcript";
import type { Call } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "All Calls" };

type StoredCallError = { type?: string };

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

function CallStatusBadge({ call }: { call: Call }) {
  const count = call.error_count ?? 0;
  const critical = call.critical_error_count ?? 0;

  if (call.analysis_status === "skipped") {
    return <span className="badge text-ink-3 border-chalk-3">Skip</span>;
  }
  if (call.analysis_status !== "complete") {
    return <span className="badge badge-cobalt">{call.analysis_status ?? "Pending"}</span>;
  }
  if (count === 0) {
    return <span className="badge badge-ok">✓ Clean</span>;
  }
  if (critical > 0) {
    return <span className="badge badge-crit">🔴 {count} error{count !== 1 ? "s" : ""}</span>;
  }
  return <span className="badge badge-warn">⚠ {count} error{count !== 1 ? "s" : ""}</span>;
}

export default async function CallsPage() {
  let calls: Call[] = [];
  let setupError: string | null = null;

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("calls")
      .select("*")
      .gte("duration_seconds", MIN_ANALYSIS_SECONDS)
      .lte("duration_seconds", MAX_ANALYSIS_SECONDS)
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) throw error;
    calls = (data ?? []) as Call[];
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error);
  }

  if (setupError) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-12 md:px-8">
        <div className="border-2 border-[var(--warn)] bg-[var(--warn-bg)] p-8 shadow-brutal">
          <div className="font-display text-2xl font-bold text-ink mb-3">Connection Error</div>
          <p className="font-sans text-sm text-ink-2 leading-relaxed mb-5">
            Unable to connect to Supabase. The database may be paused or unreachable.
          </p>
          <pre className="font-mono text-xs text-ink-2 bg-white border-2 border-chalk-3 p-4 overflow-auto whitespace-pre-wrap max-h-[400px]">{setupError}</pre>
        </div>
      </main>
    );
  }

  const totalErrors = calls.reduce((s, c) => s + (c.error_count ?? 0), 0);
  const totalAnalyzed = calls.filter((c) => c.analysis_status === "complete").length;
  const withErrors = calls.filter((c) => (c.error_count ?? 0) > 0).length;

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-cobalt mb-2">Trelx · Evidence Queue</div>
          <h1 className="font-display text-5xl font-bold text-ink leading-none mb-3">All Calls</h1>
          <p className="font-sans text-sm text-ink-3 max-w-xl leading-relaxed">
            {calls.length} calls · {totalAnalyzed} analyzed · {withErrors} with failures · {totalErrors} total flags
          </p>
        </div>
        <Link href="/dashboard" className="btn-brutal btn-brutal-cobalt">
          ← Dashboard
        </Link>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="border-2 border-ink bg-white shadow-brutal animate-fade-up" style={{ animationDelay: "100ms" }}>
        {/* Table header */}
        <div className="grid grid-cols-[minmax(0,1fr)_140px_80px_120px_150px_110px] border-b-2 border-ink bg-chalk">
          {[
            { label: "Call summary", class: "border-r-2" },
            { label: "Agent", class: "border-r" },
            { label: "Duration", class: "border-r" },
            { label: "Status", class: "border-r" },
            { label: "Top issue", class: "border-r" },
            { label: "Ended", class: "" }
          ].map(({ label, class: cls }) => (
            <div
              key={label}
              className={`px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-ink-3 ${cls} border-ink-3/20`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-chalk-2">
          {calls.map((call, i) => {
            const topError = extractTopError(call);
            const critical = (call.critical_error_count ?? 0) > 0;
            const hasFail = (call.error_count ?? 0) > 0;

            return (
              <Link
                key={call.id}
                href={`/calls/${encodeURIComponent(call.id)}`}
                className={`grid grid-cols-[minmax(0,1fr)_140px_80px_120px_150px_110px] group transition-colors duration-100
                  ${critical ? "hover:bg-[var(--crit-bg)]" : hasFail ? "hover:bg-[var(--warn-bg)]" : "hover:bg-chalk"}
                `}
                style={{ animation: `fade-in 0.3s ease-out ${i * 15}ms both` }}
              >
                {/* Summary */}
                <div className="px-4 py-4 min-w-0 border-r border-chalk-2">
                  <div className="font-sans text-sm font-semibold text-ink truncate group-hover:text-cobalt transition-colors">
                    {call.summary || <span className="text-ink-3 italic">No summary</span>}
                  </div>
                  <div className="font-mono text-[9px] text-ink-3 mt-1 truncate">{call.id}</div>
                </div>

                {/* Agent */}
                <div className="px-3 py-4 border-r border-chalk-2 flex items-center">
                  <span className="font-sans text-xs text-ink-2 truncate">{call.agent_name ?? call.agent_id}</span>
                </div>

                {/* Duration */}
                <div className="px-3 py-4 border-r border-chalk-2 flex items-center">
                  <span className="font-mono text-xs text-ink-2">{formatDuration(call.duration_seconds)}</span>
                </div>

                {/* Status badge */}
                <div className="px-3 py-4 border-r border-chalk-2 flex items-center">
                  <CallStatusBadge call={call} />
                </div>

                {/* Top issue */}
                <div className="px-3 py-4 border-r border-chalk-2 flex items-center">
                  {topError ? (
                    <span className={`font-sans text-xs ${critical ? "text-[var(--crit)] font-semibold" : "text-ink-2"}`}>
                      {errorLabel(topError)}
                    </span>
                  ) : call.analysis_status === "complete" ? (
                    <span className="font-mono text-[10px] text-[var(--ok)]">Clean</span>
                  ) : (
                    <span className="font-mono text-[10px] text-ink-3">—</span>
                  )}
                </div>

                {/* End reason */}
                <div className="px-3 py-4 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-ink-3 truncate">{call.end_reason ?? "ended"}</span>
                  <span className="text-ink-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
              </Link>
            );
          })}

          {calls.length === 0 && (
            <div className="px-6 py-16 text-center">
              <div className="font-display text-2xl text-ink-3 mb-2">No calls yet</div>
              <p className="font-sans text-sm text-ink-3">Pipeline will auto-sync when calls complete.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 font-mono text-[10px] text-ink-3 text-right">
        Showing {calls.length} calls · {MIN_ANALYSIS_SECONDS}s–{Math.round(MAX_ANALYSIS_SECONDS / 60)}m window
      </div>
    </main>
  );
}
