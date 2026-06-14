import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-57px)] bg-[radial-gradient(circle_at_20%_20%,rgba(32,80,70,0.42),transparent_30%),linear-gradient(135deg,#0b0d0f_0%,#101418_55%,#11100c_100%)]">
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <p className="mb-5 text-xs uppercase tracking-[0.25em] text-emerald-300">Detect. Fix. Prove. Synthesize.</p>
          <h1 className="max-w-4xl text-5xl font-black leading-none text-white md:text-7xl">
            Trelx makes Ultravox agents better from real calls.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300">
            Sync production calls, find exact transcript-backed failures with GPT-4o, simulate prompt patches, and synthesize hardened agent blueprints.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="border border-emerald-300 bg-emerald-300 px-5 py-3 text-sm font-bold text-black">
              Open dashboard
            </Link>
            <Link href="/blueprint" className="border border-white/15 px-5 py-3 text-sm font-bold text-white">
              Generate blueprint
            </Link>
          </div>
        </div>
        <div className="grid content-start gap-3 text-sm">
          {[
            ["INGEST", "GET-only Ultravox sync into Supabase"],
            ["EVAL", "GPT-4o audits calls and stores exact quotes"],
            ["FIX", "Prompt patches generated and simulated before manual apply"],
            ["BLUEPRINT", "Prompt synthesis from repeated failure patterns"]
          ].map(([label, text]) => (
            <div key={label} className="border border-white/10 bg-black/50 p-5">
              <div className="text-xs font-black tracking-[0.2em] text-emerald-300">{label}</div>
              <div className="mt-2 text-zinc-200">{text}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
