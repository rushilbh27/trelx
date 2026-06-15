import Link from "next/link";
import { errorImpact, errorLabel, severityTone, hasAgentEvidence } from "@/lib/error-copy";
import { transcriptContext, type TranscriptLine } from "@/lib/transcript";
import type { CallError } from "@/lib/types";
import { GenerateFixButton } from "@/app/components/FixActions";

const SEVERITY_CONFIG = {
  critical: { badge: "badge-crit",  border: "border-[var(--crit)]", bg: "bg-[var(--crit-bg)]",  label: "Critical",  icon: "🔴" },
  high:     { badge: "badge-warn",  border: "border-[var(--warn)]", bg: "bg-[var(--warn-bg)]",  label: "High",      icon: "🟡" },
  medium:   { badge: "badge-cobalt",border: "border-cobalt",        bg: "bg-[var(--cobalt-bg)]", label: "Medium",    icon: "🔵" },
  low:      { badge: "badge",       border: "border-chalk-3",       bg: "bg-white",              label: "Low",       icon: "⚪" }
} as const;

type Severity = keyof typeof SEVERITY_CONFIG;

export function ErrorEvidenceCard({
  error,
  transcriptLines,
  showFix = false
}: {
  error: CallError;
  transcriptLines: TranscriptLine[];
  showFix?: boolean;
}) {
  const context = transcriptContext(transcriptLines, error.quote, 2);
  const sev = (error.severity as Severity) in SEVERITY_CONFIG
    ? (error.severity as Severity)
    : "low";
  const config = SEVERITY_CONFIG[sev];

  return (
    <article
      className={`bg-white border-2 ${config.border} shadow-brutal-sm p-5`}
      style={{ animation: "fade-up 0.3s ease-out both" }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2 mb-3">
        <span className={`badge ${config.badge}`}>
          {config.icon} {config.label}
        </span>
        <span className="font-sans text-sm font-bold text-ink flex-1 min-w-0">
          {errorLabel(error.error_type)}
        </span>
        {error.call_stage && (
          <span className="badge text-ink-3 border-chalk-3">{error.call_stage}</span>
        )}
        <Link
          href={`/calls/${encodeURIComponent(error.call_id)}`}
          className="btn-brutal btn-brutal-cobalt ml-auto shrink-0"
          style={{ padding: "4px 12px", fontSize: "10px" }}
        >
          Inspect call →
        </Link>
      </div>

      {/* Impact description */}
      <p className="font-sans text-sm text-ink-2 leading-relaxed mb-4">
        {errorImpact(error.error_type)}
      </p>

      {/* Quote evidence */}
      <blockquote
        className={`border-l-4 ${config.border} ${config.bg} px-4 py-3 mb-4`}
      >
        <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-1.5">Agent quote</div>
        <p className="font-sans text-sm text-ink leading-relaxed m-0">
          {error.quote ?? "No quote captured."}
        </p>
      </blockquote>

      {/* Context window */}
      {context.length > 0 && (
        <div className="bg-chalk-2 border border-chalk-3 p-3 mb-4">
          <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-2">Failure context</div>
          <div className="space-y-1">
            {context.map((line) => (
              <div
                key={`${line.index}-${line.role}`}
                className={`text-xs leading-relaxed font-sans ${
                  line.raw === error.quote
                    ? "text-[var(--crit)] font-semibold"
                    : "text-ink-3"
                }`}
              >
                <span className="font-mono text-[9px] text-ink-3 mr-2">[{line.index}] {line.role}:</span>
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate fix */}
      {showFix && <GenerateFixButton errorId={error.id} />}
    </article>
  );
}
