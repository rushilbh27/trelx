import Link from "next/link";
import { BlueprintGenerator } from "@/app/components/BlueprintGenerator";

export const metadata = { title: "Blueprint Generator" };

export default function BlueprintPage() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-cobalt mb-2">Trelx · Synthesize</div>
          <h1 className="font-display text-5xl font-bold text-ink leading-none mb-3">Blueprint Generator</h1>
          <p className="font-sans text-sm text-ink-3 max-w-xl leading-relaxed">
            GPT-4o reads observed failure patterns from Supabase and writes a deployable system prompt.
            Ultravox apply stays manual — you review and paste.
          </p>
        </div>
        <Link href="/dashboard" className="btn-brutal" style={{ padding: "8px 16px", fontSize: "10px" }}>
          ← Dashboard
        </Link>
      </div>

      {/* Generator */}
      <BlueprintGenerator />

    </main>
  );
}
