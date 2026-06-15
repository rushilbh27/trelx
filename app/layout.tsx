import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Trelx", template: "%s · Trelx" },
  description: "Self-improving evaluation engine for Ultravox voice AI agents",
  icons: { icon: "/favicon.ico", apple: "/apple-icon.png" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ fontFamily: "var(--font-sans)" }}>
        <div className="min-h-screen bg-chalk">

          {/* ── Navigation ───────────────────────────────────────────────── */}
          <header className="sticky top-0 z-50 bg-chalk border-b-2 border-ink">
            <nav className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-0 md:px-8">

              {/* Logo */}
              <Link href="/" className="flex items-center gap-3 py-4 group">
                <img 
                  src="/logo3.png" 
                  alt="Trelx Logo" 
                  className="h-8 w-8 object-contain shrink-0 group-hover:scale-105 transition-transform duration-150" 
                />
                <div>
                  <div className="font-display text-xl font-bold tracking-tight text-ink leading-none">
                    TRELX
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3 leading-none mt-0.5">
                    Ultravox QA Engine
                  </div>
                </div>
              </Link>

              {/* Main nav links */}
              <div className="hidden md:flex items-center gap-6 h-full">
                <Link href="/dashboard" className="nav-link">Dashboard</Link>
                <Link href="/calls" className="nav-link">All Calls</Link>
                <Link href="/blueprint" className="nav-link">Blueprint</Link>
              </div>


            </nav>
          </header>

          {/* ── Page content ─────────────────────────────────────────────── */}
          {children}

        </div>
      </body>
    </html>
  );
}
