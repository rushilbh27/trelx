import { quoteMatchesLine, type TranscriptLine } from "@/lib/transcript";

export function TranscriptBubble({
  line,
  quotes
}: {
  line: TranscriptLine;
  quotes: Array<string | null>;
}) {
  const isAgent = line.role === "Agent";
  const isTool = line.role === "Tool";
  const hasError = quotes.some((quote) => quoteMatchesLine(quote, line));
  const bubbleClass = hasError
    ? "border-red-400/50 bg-red-950/30 text-red-100"
    : isTool
      ? "border-yellow-400/30 bg-yellow-950/20 text-yellow-100"
      : isAgent
        ? "border-emerald-300/30 bg-emerald-950/20 text-zinc-100"
        : "border-white/10 bg-zinc-950 text-zinc-300";

  return (
    <div className={`flex gap-3 ${isAgent || isTool ? "" : "flex-row-reverse"}`}>
      <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center border text-[10px] font-black ${
        isAgent ? "border-emerald-300/40 text-emerald-200" : isTool ? "border-yellow-400/40 text-yellow-200" : "border-zinc-600 text-zinc-300"
      }`}>
        {isAgent ? "A" : isTool ? "T" : "U"}
      </div>
      <div className={`max-w-[84%] border px-3 py-2 text-sm leading-6 ${bubbleClass}`}>
        <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">[{line.index}] {line.role}</div>
        <div className="whitespace-pre-wrap break-words">{line.text || "..."}</div>
      </div>
    </div>
  );
}
