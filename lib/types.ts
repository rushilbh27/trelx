export type Severity = "low" | "medium" | "high" | "critical";
export type CallStage = "greeting" | "discovery" | "pitch" | "close" | "save";
export type PatchStatus = "draft" | "simulated" | "applied";

export type Call = {
  id: string;
  agent_id: string;
  agent_name: string | null;
  agent_type: string | null;
  transcript: string | null;
  summary: string | null;
  tool_calls: unknown;
  duration_seconds: number | null;
  created_at: string;
  analyzed: boolean;
};

export type CallError = {
  id: string;
  call_id: string;
  agent_id: string;
  error_type: string;
  severity: Severity;
  quote: string | null;
  call_stage: CallStage | null;
};

export type Patch = {
  id: string;
  agent_id: string;
  error_type: string;
  find_text: string;
  replace_text: string;
  reason: string | null;
  before_rate: number | null;
  after_rate: number | null;
  status: PatchStatus;
};

export type Blueprint = {
  id: string;
  agent_type: string;
  system_prompt: string;
  based_on_calls: number | null;
  based_on_errors: number | null;
  created_at: string;
};

export type DetectedError = {
  error_type: string;
  severity: Severity;
  quote: string;
  call_stage: CallStage;
  reasoning: string;
};

export type GeneratedPatch = {
  find_text: string;
  replace_text: string;
  reason: string;
};

export type SimulationResult = {
  would_error: boolean;
  reason: string;
};
