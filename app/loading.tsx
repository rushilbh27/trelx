import { WaveLoadingScreen } from "@/app/components/WaveLoadingScreen";

export default function Loading() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
      <WaveLoadingScreen text="Loading…" />
    </main>
  );
}
