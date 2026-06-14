export const ERROR_TYPES = {
  wrong_info: "Agent stated factually incorrect information about product/service/price",
  no_save_answers: "Agent collected info but failed to call the save/tool function",
  broke_promise: "Agent promised an action (callback, email) that wasn't logged or fulfilled",
  accepted_garbled_audio: "Agent proceeded on clearly garbled/misheard input without confirming",
  stacked_questions: "Agent asked multiple questions in one turn, confusing the customer",
  wrong_call_type: "Agent treated the call as wrong direction (inbound as outbound, etc.)",
  ignored_objection: "Customer raised an objection the agent ignored or steamrolled",
  no_clear_close: "Call ended without a clear next step or resolution",
  language_mismatch: "Agent responded in wrong language vs customer preference",
  premature_hangup: "Agent ended the call before the goal was met",
  robotic_repetition: "Agent repeated the same phrase/line multiple times (loop behavior)",
  missed_intent: "Agent failed to recognize what the customer actually wanted"
} as const;

export type ErrorType = keyof typeof ERROR_TYPES;
