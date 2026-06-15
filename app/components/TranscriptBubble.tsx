import { quoteMatchesLine, type TranscriptLine } from "@/lib/transcript";

const ROLE_CONFIG = {
  Agent: {
    avatar: "AG",
    avatarClass: "bg-ink text-chalk border-2 border-ink",
    label: "Agent",
    labelColor: "text-ink-2",
    bubbleClass: "bubble-agent",
    align: "left" as const
  },
  User: {
    avatar: "US",
    avatarClass: "bg-cobalt text-white border-2 border-cobalt",
    label: "User",
    labelColor: "text-cobalt",
    bubbleClass: "bubble-user",
    align: "right" as const
  },
  Tool: {
    avatar: "FN",
    avatarClass: "bg-[var(--warn-bg)] text-[var(--warn)] border-2 border-[var(--warn-border)]",
    label: "Tool Call",
    labelColor: "text-[var(--warn)]",
    bubbleClass: "bubble-tool",
    align: "left" as const
  }
};

export function TranscriptBubble({
  line,
  quotes
}: {
  line: TranscriptLine;
  quotes: Array<string | null>;
}) {
  const role = line.role === "Agent" ? "Agent" : line.role === "Tool" ? "Tool" : "User";
  const config = ROLE_CONFIG[role];
  const hasError = quotes.some((q) => quoteMatchesLine(q, line));
  const isRight = config.align === "right";

  const bubbleClass = hasError ? "bubble-error" : config.bubbleClass;

  return (
    <div
      className={`flex gap-2.5 ${isRight ? "flex-row-reverse" : ""}`}
      style={{ animation: "fade-up 0.25s ease-out both" }}
    >
      {/* Avatar */}
      <div
        className={`mt-0.5 shrink-0 h-7 w-7 flex items-center justify-center text-[9px] font-bold tracking-widest ${config.avatarClass}`}
        aria-label={config.label}
        title={config.label}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {config.avatar}
      </div>

      {/* Bubble */}
      <div className={`max-w-[78%] ${bubbleClass} px-4 py-3`}>
        {/* Role label + index */}
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`font-mono text-[9px] font-bold uppercase tracking-widest ${config.labelColor}`}
          >
            {config.label}
          </span>
          <span className="font-mono text-[9px] text-ink-3">#{line.index}</span>
          {hasError && (
            <span
              className="badge badge-crit"
              style={{ fontSize: "9px", padding: "1px 6px" }}
            >
              ⚠ Flagged
            </span>
          )}
        </div>

        {/* Message text */}
        <p
          className={`text-sm leading-relaxed whitespace-pre-wrap break-words m-0 ${
            hasError ? "text-[var(--crit)] font-medium" : "text-ink"
          } ${role === "Tool" ? "font-mono text-xs" : ""}`}
        >
          {line.text || <span className="text-ink-3 italic">…</span>}
        </p>
      </div>
    </div>
  );
}
