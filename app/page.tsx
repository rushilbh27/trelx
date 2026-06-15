import Link from "next/link";

const features = [
  {
    tag: "Transcript-backed",
    title: "Exact failure evidence",
    body: "Every miss ties back to the agent turn, the stage, and the quote that caused the problem. No vague metrics."
  },
  {
    tag: "Simulation-first",
    title: "Prove fixes before touching prod",
    body: "Generate the patch, replay it against past calls, and show before/after impact before a human decides."
  },
  {
    tag: "Blueprint mode",
    title: "Synthesize what actually works",
    body: "Trelx turns repeated failure patterns into hardened system prompts built from real production drift."
  }
];

const steps = [
  ["01", "Ingest", "Pull ended Ultravox calls, transcripts, summaries, and tool traces into Supabase."],
  ["02", "Evaluate", "GPT-4o flags wrong turns, severity, stage, and quote-backed reasoning."],
  ["03", "Fix", "Generate patch suggestions, simulate against history, and surface the safest path."],
  ["04", "Synthesize", "Roll repeated failures into a stronger blueprint for the next agent version."]
];

export default function Home() {
  return (
    <main className="overflow-hidden bg-chalk">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-5 pt-16 pb-20 md:px-8 md:pt-24 md:pb-28">
        <div className="max-w-3xl animate-fade-up">
          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-2 border-2 border-ink bg-white px-4 py-2 mb-8 shadow-brutal-sm">
            <div className="dot-live" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink">
              Production eval engine for Ultravox
            </span>
          </div>

          {/* Title */}
          <h1 className="font-display text-6xl md:text-7xl lg:text-8xl font-bold text-ink leading-none tracking-tight mb-6">
            Turn live<br />voice calls into<br />
            <em className="not-italic text-cobalt">a sharper agent.</em>
          </h1>

          <p className="font-sans text-base md:text-lg text-ink-2 leading-relaxed max-w-xl mb-10">
            Trelx watches real calls, catches exact failures, generates safer prompt fixes, and synthesizes stronger blueprints from what broke in production.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/dashboard" className="btn-brutal btn-brutal-cobalt" style={{ padding: "14px 28px", fontSize: "12px" }}>
              Open Dashboard →
            </Link>
            <Link href="/blueprint" className="btn-brutal" style={{ padding: "14px 28px", fontSize: "12px" }}>
              Generate Blueprint
            </Link>
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: "200ms" }}>
          {[
            { label: "Calls analyzed",   value: "500+",  sub: "in production" },
            { label: "Errors detected",  value: "60+",   sub: "transcript-backed" },
            { label: "Agents monitored", value: "4",     sub: "Ultravox agents" },
            { label: "Fix latency",      value: "<2min", sub: "end-to-end" }
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white border-2 border-ink p-5 shadow-brutal-sm">
              <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-2">{label}</div>
              <div className="font-display text-4xl font-bold text-ink leading-none mb-1">{value}</div>
              <div className="font-sans text-xs text-ink-3">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mock dashboard preview ────────────────────────────────────────── */}
      <section className="bg-ink py-16 md:py-20 border-y-2 border-ink">
        <div className="mx-auto max-w-[1440px] px-5 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-chalk-3 mb-2">Live control room</div>
              <h2 className="font-display text-4xl font-bold text-chalk leading-tight">Real-time agent watchlist</h2>
            </div>
            <Link href="/dashboard" className="btn-brutal" style={{ background: "var(--chalk)", color: "var(--ink)" }}>
              View live →
            </Link>
          </div>

          {/* Faux dashboard UI */}
          <div className="bg-chalk border-2 border-chalk-3 p-0 overflow-hidden">
            {/* Faux table header */}
            <div className="bg-chalk-2 border-b-2 border-chalk-3 grid grid-cols-[1fr_80px_80px_80px_100px] px-4 py-3">
              {["Agent", "Calls", "Analyzed", "Errors", "Rate"].map((h) => (
                <div key={h} className="font-mono text-[9px] uppercase tracking-widest text-ink-3">{h}</div>
              ))}
            </div>
            {/* Faux rows */}
            {[
              { name: "Cold Outreach AI", calls: 76, analyzed: 68, errors: 12, rate: "17.6%", color: "text-[var(--warn)]", bar: 60 },
              { name: "Edifice Properties", calls: 20, analyzed: 18, errors: 3, rate: "16.7%", color: "text-[var(--warn)]", bar: 50 },
              { name: "Ramco Gas", calls: 14, analyzed: 12, errors: 1, rate: "8.3%", color: "text-cobalt", bar: 25 },
              { name: "Debt Collector", calls: 8, analyzed: 7, errors: 0, rate: "0%", color: "text-[var(--ok)]", bar: 0 }
            ].map((row) => (
              <div key={row.name} className="grid grid-cols-[1fr_80px_80px_80px_100px] px-4 py-4 border-b border-chalk-2 items-center hover:bg-chalk-2 transition-colors">
                <div>
                  <div className="font-sans text-sm font-semibold text-ink">{row.name}</div>
                  <div className="mt-1 h-1.5 w-full bg-chalk-3 overflow-hidden">
                    <div className="h-full bg-cobalt" style={{ width: `${row.bar}%` }} />
                  </div>
                </div>
                <div className="font-mono text-sm text-ink-2">{row.calls}</div>
                <div className="font-mono text-sm text-ink-3">{row.analyzed}</div>
                <div className="font-mono text-sm text-ink-2">{row.errors}</div>
                <div className={`font-display text-2xl font-bold ${row.color}`}>{row.rate}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-8">
        <div className="mb-12 animate-fade-up">
          <div className="font-mono text-[10px] uppercase tracking-widest text-cobalt mb-3">Why Trelx</div>
          <h2 className="font-display text-5xl font-bold text-ink leading-tight">Built for production.</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3 stagger">
          {features.map((card) => (
            <div key={card.title} className="card-brutal p-7 animate-fade-up">
              <div className="badge badge-cobalt mb-5">{card.tag}</div>
              <h3 className="font-display text-3xl font-bold text-ink leading-tight mb-4">{card.title}</h3>
              <p className="font-sans text-sm text-ink-2 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Eval loop steps ──────────────────────────────────────────────── */}
      <section className="bg-chalk-2 border-y-2 border-ink py-20">
        <div className="mx-auto max-w-[1440px] px-5 md:px-8">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-cobalt mb-3">Workflow</div>
              <h2 className="font-display text-5xl font-bold text-ink leading-tight">One loop.<br />Real evidence.<br />Cleaner agents.</h2>
            </div>
            <p className="max-w-sm font-sans text-sm text-ink-2 leading-relaxed">
              No vanity analytics. No fake QA. Just a dense, production-first loop from live transcript to measurable improvement.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger">
            {steps.map(([idx, title, body]) => (
              <div key={idx} className="bg-white border-2 border-ink p-6 shadow-brutal hover:shadow-brutal-lg hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150 animate-fade-up">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3 mb-5">{idx}</div>
                <h3 className="font-display text-2xl font-bold text-ink mb-3">{title}</h3>
                <p className="font-sans text-sm text-ink-2 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA footer ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-8">
        <div className="bg-ink border-2 border-ink p-10 md:p-14 shadow-brutal">
          <div className="max-w-2xl">
            <div className="font-mono text-[10px] uppercase tracking-widest text-chalk-3 mb-4">Get started</div>
            <h2 className="font-display text-5xl md:text-6xl font-bold text-chalk leading-none mb-6">
              Your agents are failing right now.
            </h2>
            <p className="font-sans text-base text-chalk-3 leading-relaxed mb-8">
              Trelx is already watching your Ultravox calls. Open the dashboard to see what&apos;s broken.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/dashboard" className="btn-brutal" style={{ background: "var(--chalk)", color: "var(--ink)", padding: "14px 28px", fontSize: "12px" }}>
                Open Dashboard →
              </Link>
              <Link href="/calls" className="btn-brutal" style={{ background: "transparent", color: "var(--chalk)", borderColor: "var(--chalk-3)", padding: "14px 28px", fontSize: "12px" }}>
                Browse Calls
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
