"use client";

import { useEffect, useState } from "react";

export function VoiceWave({
  size = "md",
  color = "cobalt",
  bars = 8
}: {
  size?: "sm" | "md" | "lg";
  color?: "cobalt" | "ink" | "chalk";
  bars?: number;
}) {
  const sizeClass = size === "sm" ? "voice-wave-sm" : size === "lg" ? "voice-wave" : "voice-wave";
  const colorClass = color === "ink" ? "voice-wave-ink" : color === "chalk" ? "voice-wave-chalk" : "";
  const barCount = bars;

  return (
    <div
      className={`voice-wave ${sizeClass} ${colorClass}`}
      aria-label="Loading..."
      role="status"
      style={{ height: size === "lg" ? "48px" : size === "sm" ? "18px" : "32px" }}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-chalk"
      role="status"
      aria-live="polite"
    >
      {/* Logo mark */}
      <div className="mb-10 flex flex-col items-center gap-3 animate-fade-in">
        <div className="flex h-14 w-14 items-center justify-center bg-ink border-2 border-ink shadow-brutal">
          <span className="font-mono text-chalk text-base font-bold">T</span>
        </div>
        <span className="font-display text-2xl font-bold tracking-tight text-ink">TRELX</span>
      </div>

      {/* Voice wave */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: "150ms" }}>
        <VoiceWave size="lg" color="cobalt" bars={10} />
      </div>

      {/* Label */}
      <div
        className="font-mono text-xs uppercase tracking-widest text-ink-3 animate-fade-in"
        style={{ animationDelay: "250ms" }}
      >
        {label}{dots}
      </div>

      {/* Progress bar */}
      <div
        className="mt-8 w-48 h-[2px] bg-chalk-3 overflow-hidden animate-fade-in"
        style={{ animationDelay: "350ms" }}
      >
        <div
          className="h-full bg-cobalt"
          style={{
            animation: "progress-bar 2s cubic-bezier(0.4, 0, 0.2, 1) both"
          }}
        />
      </div>
    </div>
  );
}
