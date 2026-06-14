import Link from "next/link";

const proofCards = [
  {
    eyebrow: "Transcript-backed",
    title: "Exact failure evidence",
    body: "Every miss ties back to the agent turn, the stage, and the quote that caused the problem."
  },
  {
    eyebrow: "Simulation-first",
    title: "Prove fixes before touching prod",
    body: "Generate the patch, replay it against past calls, and show before/after impact before a human decides."
  },
  {
    eyebrow: "Blueprint mode",
    title: "Synthesize what actually works",
    body: "Trelx turns repeated failure patterns into hardened system prompts built from real production drift."
  }
];

const loopSteps = [
  ["01", "Ingest", "Pull ended Ultravox calls, transcript, summaries, and tool traces into Supabase."],
  ["02", "Evaluate", "GPT-4o flags wrong turns, severity, stage breakdown, and quote-backed reasoning."],
  ["03", "Fix", "Generate patch suggestions, simulate against history, and surface the safest improvement path."],
  ["04", "Synthesize", "Roll repeated failures into a stronger blueprint for the next agent version."]
];

export default function Home() {
  return (
    <main className="overflow-hidden">
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(249,115,22,0.22),transparent_24%),radial-gradient(circle_at_50%_24%,rgba(249,115,22,0.1),transparent_42%)]" />
        <div className="pointer-events-none absolute left-1/2 top-28 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full border border-orange-300/10" />
        <div className="pointer-events-none absolute left-1/2 top-36 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full border border-orange-300/10" />
        <div className="pointer-events-none absolute left-1/2 top-44 h-[22rem] w-[22rem] -translate-x-1/2 rounded-full border border-orange-300/10" />

        <div className="mx-auto max-w-[1500px] px-4 pb-20 pt-16 md:px-6 md:pb-28 md:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-100">
              <span className="h-2 w-2 rounded-full bg-orange-300" />
              Production eval engine for Ultravox
            </div>
            <h1 className="mt-8 font-[family-name:var(--font-display)] text-5xl font-black leading-[0.92] tracking-[-0.04em] text-white md:text-7xl">
              Turn live voice calls into a sharper agent every week.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
              Trelx watches real calls, catches exact failures, generates safer prompt fixes, and synthesizes stronger blueprints from what broke in production.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-full border border-orange-300 bg-orange-300 px-6 py-3 text-sm font-bold text-black transition hover:scale-[1.02]"
              >
                Open dashboard
              </Link>
              <Link
                href="/blueprint"
                className="rounded-full border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-bold text-white transition hover:border-white/25 hover:bg-white/[0.05]"
              >
                Generate blueprint
              </Link>
            </div>
          </div>

          <div className="relative mx-auto mt-16 grid max-w-6xl gap-4 lg:grid-cols-[0.8fr_1.1fr_0.8fr] lg:items-center">
            <div className="grid gap-4">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur">
                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Failure queue</div>
                <div className="mt-3 text-3xl font-black text-white">37</div>
                <div className="mt-2 text-sm text-zinc-400">Transcript-backed issues ready for triage and simulation.</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/60 p-5">
                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Best proof line</div>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  “Customer pushed back, but agent continued the script instead of handling the objection.”
                </p>
              </div>
            </div>

            <div className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.5)]">
              <div className="rounded-[28px] border border-white/8 bg-black/70 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-orange-100">Trelx control room</div>
                    <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-black text-white">Live eval loop</div>
                  </div>
                  <span className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-100">
                    Autopilot on
                  </span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {[
                    ["Calls synced", "200"],
                    ["Analyzed", "223"],
                    ["Critical", "5"]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</div>
                      <div className="mt-2 text-3xl font-black text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_45%),rgba(255,255,255,0.02)] p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Recent pressure</div>
                    <div className="text-xs text-orange-100">proof before patch</div>
                  </div>
                  <div className="mt-6 flex h-36 items-end gap-2">
                    {[28, 40, 32, 58, 46, 65, 54, 72, 49, 61, 78, 64].map((value, index) => (
                      <div key={index} className="flex-1 rounded-t-full bg-gradient-to-t from-orange-400 via-orange-300/60 to-transparent" style={{ height: `${value}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur">
                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Blueprint engine</div>
                <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-black text-white">From scattered misses to one hardened prompt.</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/60 p-5">
                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Simulation delta</div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-3xl font-black text-red-300">100%</span>
                  <span className="mb-1 text-zinc-500">before</span>
                  <span className="text-3xl font-black text-orange-100">0%</span>
                  <span className="mb-1 text-zinc-500">after</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 pb-8 md:px-6">
        <div className="grid gap-5 lg:grid-cols-3">
          {proofCards.map((card) => (
            <div key={card.title} className="rounded-[32px] border border-white/10 bg-white/[0.03] p-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-100">{card.eyebrow}</div>
              <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-black leading-tight text-white">{card.title}</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-400">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 pb-20 pt-10 md:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-100">Workflow</div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-black tracking-[-0.03em] text-white">
              One loop. Real evidence. Cleaner agents.
            </h2>
          </div>
          <div className="max-w-md text-sm leading-7 text-zinc-400">
            No vanity analytics. No fake QA. Just a dense, production-first loop from live transcript to measurable improvement.
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {loopSteps.map(([index, title, body]) => (
            <div key={index} className="rounded-[32px] border border-white/10 bg-black/45 p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{index}</div>
              <h3 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-black text-white">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
