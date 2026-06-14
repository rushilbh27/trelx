export const MIN_ANALYSIS_SECONDS = 30;
export const MAX_ANALYSIS_SECONDS = 420;

export const TARGET_PROCESSED_CALLS = 400;
export const SALES_AI_AGENT_ID = "65ae3d7d-5a1f-4880-89f4-1ce690efae89";
export const SALES_AI_TARGET_CALLS = 150;

export function isEligibleAnalysisDuration(durationSeconds: number | null | undefined): boolean {
  if (durationSeconds == null) return false;
  return durationSeconds >= MIN_ANALYSIS_SECONDS && durationSeconds <= MAX_ANALYSIS_SECONDS;
}
