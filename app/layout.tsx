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
      <body className="min-h-screen font-mono">
        <div className="border-b border-white/10 bg-black">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <Link href="/" className="text-lg font-black tracking-[0.2em] text-white">
              TRELX
            </Link>
            <div className="flex gap-4 text-xs uppercase tracking-[0.16em] text-zinc-400">
              <Link href="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
              <Link href="/blueprint" className="hover:text-white">
                Blueprint
              </Link>
            </div>
          </nav>
        </div>
        {children}
      </body>
    </html>
  );
}
