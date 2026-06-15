export function WaveLoadingScreen({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 animate-fade-in">
      <div className="voice-wave voice-wave-ink" style={{ transform: "scale(1.5)" }}>
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
        {text}
      </div>
    </div>
  );
}
