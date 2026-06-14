import Link from "next/link";
import { errorImpact, errorLabel, severityTone } from "@/lib/error-copy";
import { transcriptContext, type TranscriptLine } from "@/lib/transcript";
import type { CallError } from "@/lib/types";
import { GenerateFixButton } from "@/app/components/FixActions";

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

  return (
    <article className="rounded-[26px] border border-white/8 bg-[#111111] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${severityTone(error.severity)}`}>
          {error.severity}
        </span>
        <span className="text-sm font-black text-white">{errorLabel(error.error_type)}</span>
        {error.call_stage ? <span className="border border-white/10 px-2 py-1 text-[10px] uppercase text-zinc-500">{error.call_stage}</span> : null}
        <Link href={`/calls/${encodeURIComponent(error.call_id)}`} className="ml-auto text-xs uppercase tracking-[0.14em] text-orange-100 hover:text-white">
          inspect call
        </Link>
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-400">{errorImpact(error.error_type)}</p>

      <blockquote className="mt-4 border-l-2 border-orange-300 bg-[#18110d] px-4 py-3 text-sm leading-6 text-zinc-100">
        {error.quote ?? "No quote captured."}
      </blockquote>

      {context.length > 0 ? (
        <div className="mt-4 grid gap-2 border border-white/10 bg-zinc-950 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Failure context</div>
          {context.map((line) => (
            <div key={`${line.index}-${line.role}`} className={line.raw === error.quote ? "text-sm text-red-200" : "text-xs text-zinc-400"}>
              <span className="text-zinc-600">[{line.index}] {line.role}: </span>{line.text}
            </div>
          ))}
        </div>
      ) : null}

      {showFix ? <GenerateFixButton errorId={error.id} /> : null}
    </article>
  );
}
