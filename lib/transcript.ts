export type TranscriptLine = {
  index: number;
  role: "Agent" | "User" | "Tool";
  text: string;
  raw: string;
};

type MessageLike = {
  role: string;
  text: string;
  ordinal: number;
};

const LINE_RE = /^\[(\d+)\]\s*(Agent|User|Tool):\s*([\s\S]*)$/;

export function parseTranscript(transcript: string | null | undefined): TranscriptLine[] {
  if (!transcript) return [];
  return transcript
    .split("\n")
    .map((raw, fallbackIndex): TranscriptLine | null => {
      const match = raw.match(LINE_RE);
      if (!match) return null;
      return {
        index: Number.parseInt(match[1], 10) || fallbackIndex,
        role: match[2] as TranscriptLine["role"],
        text: match[3] ?? "",
        raw
      };
    })
    .filter((line): line is TranscriptLine => line !== null);
}

export function messageRoleToTranscriptRole(role: string): TranscriptLine["role"] {
  const normalized = role.toUpperCase();
  if (normalized.includes("AGENT")) return "Agent";
  if (normalized.includes("TOOL")) return "Tool";
  return "User";
}

export function messageRowsToTranscriptLines(messages: MessageLike[]): TranscriptLine[] {
  return messages.map((message) => {
    const role = messageRoleToTranscriptRole(message.role);
    return {
      index: message.ordinal,
      role,
      text: message.text ?? "",
      raw: `[${message.ordinal}] ${role}: ${message.text ?? ""}`
    };
  });
}

export function quoteIndex(quote: string | null | undefined): number | null {
  if (!quote) return null;
  const match = quote.match(/^\[(\d+)\]/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function quoteMatchesLine(quote: string | null | undefined, line: TranscriptLine): boolean {
  if (!quote) return false;
  const byIndex = quoteIndex(quote);
  if (byIndex !== null) return byIndex === line.index;
  return quote.includes(line.text) || line.raw.includes(quote);
}

export function transcriptContext(lines: TranscriptLine[], quote: string | null | undefined, radius = 2): TranscriptLine[] {
  const index = lines.findIndex((line) => quoteMatchesLine(quote, line));
  if (index === -1) return [];
  return lines.slice(Math.max(0, index - radius), Math.min(lines.length, index + radius + 1));
}

export function formatDuration(seconds: number | null | undefined): string {
  const total = seconds ?? 0;
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}
