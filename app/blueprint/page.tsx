import { BlueprintGenerator } from "@/app/components/BlueprintGenerator";

export default function BlueprintPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Synthesize</p>
      <h1 className="mt-2 text-4xl font-black text-white">Blueprint generator</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
        GPT-4o reads observed failure patterns from Supabase and writes a deployable system prompt. Ultravox apply stays manual.
      </p>
      <div className="mt-8">
        <BlueprintGenerator />
      </div>
    </main>
  );
}
