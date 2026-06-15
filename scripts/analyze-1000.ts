import dotenv from "dotenv";

// Load environment variables before importing any Next.js/app code that might depend on them
dotenv.config({ path: ".env.local" });

// Now we can safely import pipeline logic
import { syncLatestCalls, analyzeAllEligibleCalls } from "../lib/pipeline";

async function main() {
  console.log("=========================================");
  console.log("   TRELX - 1000 CALL BATCH PROCESSING    ");
  console.log("=========================================\n");

  console.log("1. Syncing latest 1000 calls from Ultravox...");
  const syncStart = Date.now();
  const { synced } = await syncLatestCalls(1000, true);
  console.log(`✅ Synced ${synced} calls in ${((Date.now() - syncStart) / 1000).toFixed(1)}s\n`);

  console.log("2. Analyzing pending calls with GPT-4o (concurrency=3)...");
  console.log("   (This will take several minutes to respect rate limits)\n");
  
  const analyzeStart = Date.now();
  const summary = await analyzeAllEligibleCalls(100);
  
  console.log("\n=========================================");
  console.log("           ANALYSIS COMPLETE             ");
  console.log("=========================================");
  console.log(`Analyzed:      ${summary.analyzed}`);
  console.log(`Skipped short: ${summary.skippedShort}`);
  console.log(`Errors found:  ${summary.errors}`);
  console.log(`Time taken:    ${((Date.now() - analyzeStart) / 1000 / 60).toFixed(2)}m`);
  console.log("=========================================");
}

main().catch((err) => {
  console.error("FATAL BATCH ERROR:", err);
  process.exit(1);
});
