import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trelx",
  description: "Self-improving evaluation engine for Ultravox voice AI agents",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-[family-name:var(--font-sans)] text-zinc-100">
        <div className="min-h-screen">
          <header className="sticky top-0 z-50 border-b border-orange-300/15 bg-[#0a0a0a]/88 backdrop-blur-xl">
            <nav className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 md:px-6">
              <Link href="/" className="flex items-center gap-3 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-300/35 bg-orange-500/10 text-sm font-black tracking-[0.2em] text-orange-50">
                  T
                </span>
                <div>
                  <div className="font-[family-name:var(--font-display)] text-lg font-black tracking-[0.18em]">TRELX</div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">Ultravox control room</div>
                </div>
              </Link>

              <div className="hidden items-center gap-1 rounded-full border border-orange-300/12 bg-[#1a1512] p-1 md:flex">
                {[
                  ["/dashboard", "Dashboard"],
                  ["/calls", "Calls"],
                  ["/errors", "Errors"],
                  ["/blueprint", "Blueprint"]
                ].map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition hover:bg-orange-500/10 hover:text-orange-50"
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <div className="hidden items-center gap-3 lg:flex">
                <span className="rounded-full border border-orange-300/25 bg-orange-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-50">
                  Live eval loop
                </span>
                <Link
                  href="/dashboard"
                  className="rounded-full border border-white/10 bg-[#1a1512] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:border-orange-300/30 hover:bg-orange-500/10"
                >
                  Open workspace
                </Link>
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
