import type { GeneratedPatch } from "@/lib/types";

type FixPatch = {
  label: string;
  find: string;
  replace: string;
  agentIds?: string[];
};

type FixSpec = {
  patches: FixPatch[];
};

const SALES_AI_AGENT_ID = "65ae3d7d-5a1f-4880-89f4-1ce690efae89";
const COLD_OUTREACH_AGENT_ID = "74c435db-0382-45d4-8f84-65343c0dde5f";
const EDIFICE_AGENT_ID = "bfea3820-a447-4444-bd41-53ff919bbfe3";

const FIX_SPECS: Record<string, FixSpec> = {
  accepted_garbled_audio: {
    patches: [
      {
        label: "Sales AI — Add second-attempt exit for unclear audio",
        agentIds: [SALES_AI_AGENT_ID],
        find: "Do NOT interpret noise as a valid answer under any circumstances.",
        replace: `Do NOT interpret noise as a valid answer under any circumstances.

GARBLED AUDIO COUNTER RULE:
If this is the SECOND consecutive unclear response to the SAME question, stop re-asking.
Say: "I'm having trouble hearing you clearly... let me have our team follow up at a better time."
Then call saveAnswers with whatever data was collected and call hangUp immediately.
Do NOT loop on a bad line. Two garbled responses in a row = graceful exit.`
      },
      {
        label: "Cold Outreach — Add second-attempt exit for unclear audio",
        agentIds: [COLD_OUTREACH_AGENT_ID],
        find: "Do NOT interpret noise as a valid answer.",
        replace: `Do NOT interpret noise as a valid answer.

GARBLED AUDIO COUNTER RULE:
If this is the SECOND consecutive unclear response to the SAME question, stop re-asking.
Say: "I'm having trouble hearing you clearly... let me have our team follow up at a better time."
Then call saveAnswers with whatever data was collected and call hangUp immediately.
Do NOT loop on a bad line. Two garbled responses in a row = graceful exit.`
      }
    ]
  },
  no_save_answers: {
    patches: [
      {
        label: "Save answers on every exit path",
        find: `CRITICAL: Do NOT say the closing sentence before saveAnswers returns.
Do NOT call hangUp before saveAnswers returns.
Speaking the closing before saving is a FAILURE.`,
        replace: `CRITICAL: Do NOT say the closing sentence before saveAnswers returns.
Do NOT call hangUp before saveAnswers returns.
Speaking the closing before saving is a FAILURE.

EARLY EXIT RULE — ALL CALL PATHS:
No matter how the call ends — busy, wrong number, not interested, or fully completed —
saveAnswers MUST be called before hangUp. There are NO exceptions.
Busy customer  → save with call_status = "callback_scheduled" then hangUp.
Not interested → save with call_status = "not_interested" then hangUp.
Wrong number   → save with is_lead = false then hangUp.
A call without saveAnswers is complete data loss.`
      },
      {
        label: "Edifice — Save answers on every exit path",
        agentIds: [EDIFICE_AGENT_ID],
        find: "Never call hangUp before saveAnswers completes successfully.",
        replace: `Never call hangUp before saveAnswers completes successfully.

EARLY EXIT RULE — ALL CALL PATHS:
No matter how the call ends — caller hangs up early, wrong number, not interested,
or fully completed — saveAnswers MUST be called before hangUp. No exceptions.
Wrong number          → save with is_lead = false, call_status = "not_interested"
Caller not interested → save with call_status = "not_interested", is_lead = false
Caller busy / requests callback → save with call_status = "callback_scheduled"
A call that ends without saveAnswers is complete data loss.`
      }
    ]
  },
  broke_promise: {
    patches: [
      {
        label: "Add forbidden promise list",
        find: "Never make promises you cannot keep.",
        replace: `Never make promises you cannot keep.

FORBIDDEN PHRASES — never say any of these:
- "I will send you the floor plans"
- "I will send you photos on WhatsApp"
- "I will send you details on WhatsApp right now"
- "Let me connect you with our manager now"
- "I will transfer you to someone"
- "I can arrange that for you right now"

APPROVED REPLACEMENT for all of the above:
"Our team will follow up with you with the full details after this call."
This is the ONLY promise you are allowed to make about future actions.`
      }
    ]
  },
  wrong_info: {
    patches: [
      {
        label: "Sales AI — Context verification gate",
        find: "Never guess or assume missing information.",
        replace: `Never guess or assume missing information.
Never invent product, pricing, date, availability, or feature details.

CONTEXT VERIFICATION GATE:
Before stating any fact:
1. Locate the exact information in context.
2. If you cannot locate it, do NOT state it.
3. Say: "That's a great question — I want to give you the exact answer, so let me have our team confirm that and follow up with you directly."
4. Log the unanswered question for follow-up.`
      },
      {
        label: "Property agent — Context verification gate",
        agentIds: [EDIFICE_AGENT_ID],
        find: "Never invent information not in the knowledge base.",
        replace: `Never invent information not in the knowledge base.

CONTEXT VERIFICATION GATE (mandatory before any factual claim):
Before stating any price, availability, timeline, feature, size, or specification:
1. Ask yourself: "Is this word-for-word in my knowledge base?"
2. If YES → state it exactly as written.
3. If NO  → say: "That's a great question — I want to give you the most accurate answer, so let me have our team confirm that and get back to you directly."
Never estimate. Never approximate. Never infer from similar properties.`
      }
    ]
  },
  stacked_questions: {
    patches: [
      {
        label: "Add self-correction rule for stacked questions",
        find: "✓ Ask ONLY ONE QUESTION AT A TIME",
        replace: `✓ Ask ONLY ONE QUESTION AT A TIME — if you catch yourself combining two questions into one sentence, stop mid-sentence and say "Uhm, sorry — let me take that one at a time..." then re-ask only the first question`
      }
    ]
  },
  wrong_call_type: {
    patches: [
      {
        label: "Cold Outreach — Strengthen no identity-check opening rule",
        agentIds: [COLD_OUTREACH_AGENT_ID],
        find: `DO NOT say "Am I speaking to..." — there is no client name.`,
        replace: `DO NOT say "Am I speaking to..." — there is no client name.
DO NOT say "Is this [name]?" or any identity-check phrasing at the opening.
DO NOT reference client_name in any form at call start.
VIOLATION: Any form of identity verification in the cold opening is a CRITICAL ERROR.
If you have already said the identity check → do not correct yourself mid-call.
Instead, proceed with the script from wherever you paused.`
      },
      {
        label: "Sales AI — Add cold-call guard to greeting",
        agentIds: [SALES_AI_AGENT_ID],
        find: `Step 1 - Greeting:
"Hello... Good {{time}}... Am I speaking to {{client_name}}?"`,
        replace: `Step 1 - Greeting:
"Hello... Good {{time}}... Am I speaking to {{client_name}}?"

COLD CALL GUARD: Before saying the greeting, check {{client_name}}.
If {{client_name}} is empty, null, or not provided:
→ DO NOT say "Am I speaking to [name]?" — there is no name available.
→ USE instead: "Hello... Good {{time}}... My name is {{agent_name}}... calling from {{company_name}}... Is this a good time to talk?"`
      }
    ]
  },
  ignored_objection: {
    patches: [
      {
        label: "Cold Outreach — Hard stop after rejection",
        agentIds: [COLD_OUTREACH_AGENT_ID],
        find: "- If they disengage → save and close immediately, no pushback, no arguing",
        replace: `- If they disengage → FULL STOP. Do NOT counter-offer. Do NOT re-explain the product.

DISENGAGEMENT = IMMEDIATE CLOSE (non-negotiable):
When the customer says "not interested", "no thank you", "I don't want this", "please don't call again",
or shows any clear disengagement:
→ Say EXACTLY: "No problem at all... thank you so much for your time today... have a wonderful and blessed day..."
→ THEN: Set call_status = "not_interested", is_lead = false, interest = "cold"
→ Call saveAnswers → hangUp
→ DO NOT add "but just let me tell you one thing..."
→ DO NOT ask "Are you sure?"
→ DO NOT offer a WhatsApp follow-up unless customer asks
Any attempt to re-engage after clear rejection is a CRITICAL VIOLATION.`
      }
    ]
  },
  robotic_repetition: {
    patches: [
      {
        label: "Cold Outreach — Strengthen no-restart rule",
        agentIds: [COLD_OUTREACH_AGENT_ID],
        find: `✓ DO NOT restart from "Hello..."`,
        replace: `✓ DO NOT restart from "Hello..."  ← CRITICAL VIOLATION if broken
✓ DO NOT repeat your name after being interrupted
✓ DO NOT repeat the company name after being interrupted
✓ DO NOT repeat the time greeting after being interrupted

RESTART = CRITICAL VIOLATION.
Every customer interruption ("Hello", "Yes", "Okay", any sound) → acknowledge with "uhm..."
and continue the exact sentence you were on. Starting over creates an infinite loop
where every customer breath restarts the opening.`
      },
      {
        label: "Sales AI — Opening interrupt handler",
        agentIds: [SALES_AI_AGENT_ID],
        find: "Step 2 - Introduction with Lead Source Context:",
        replace: `OPENING INTERRUPT RULE (read before first word):
If the customer says anything while you are still delivering the opening:
→ Say "uhm..." and continue from exactly where you paused.
→ Do NOT go back to "Hello Good morning..."
→ Do NOT repeat your name or company name again.
→ Restarting the greeting from the top is a CRITICAL VIOLATION.

Step 2 - Introduction with Lead Source Context:`
      }
    ]
  },
  language_mismatch: {
    patches: [
      {
        label: "Cold Outreach — Tighten language detection",
        agentIds: [COLD_OUTREACH_AGENT_ID],
        find: `Step 2 - Language Confirmation (ONLY if Swahili detected):`,
        replace: `Step 2 - Language Confirmation (ONLY if Swahili detected):

LANGUAGE DETECTION GUARD:
Do NOT guess a language from accent, fluency, or pronunciation alone.
Only treat Swahili as detected if the customer clearly uses Swahili words.
If the customer is speaking limited or broken English, keep the call in simple English.
Say: "Okay... I’ll speak slowly in English... if you want me to repeat anything, just tell me."
If language is still unclear after one attempt, offer a callback or handoff instead of guessing.`
      },
      {
        label: "Inbound agent — Add limited-English handling rule",
        find: "Speak slowly, clearly, and naturally. Do not rush. Do not sound robotic.",
        replace: `Speak slowly, clearly, and naturally. Do not rush. Do not sound robotic.

LANGUAGE CLARITY RULE:
Never guess the caller's language from accent or limited fluency.
If the caller seems to speak limited English, stay in simple English, slow down, and ask one short clarifying question at a time.
Do NOT label their language unless they clearly say it or use unmistakable words from that language.
If mutual understanding is still weak, offer a callback or handoff instead of continuing normally.`
      }
    ]
  },
  no_clear_close: {
    patches: [
      {
        label: "Add commitment or escalation gate",
        find: "Never make promises you cannot keep.",
        replace: `Never make promises you cannot keep.

CLOSING GATE:
Before ending the call, there must be one clear outcome:
1. a confirmed next step,
2. a saved callback,
3. a saved rejection/not-interested disposition, or
4. an escalation / handoff.
Do NOT end on a vague close with no disposition captured.`
      }
    ]
  },
  missed_intent: {
    patches: [
      {
        label: "Clarify before moving on",
        find: `1. Repeat the EXACT last sentence or question you just said — word for word
2. Do NOT advance to the next question
3. Do NOT assume an answer was given
4. Do NOT summarize or paraphrase — repeat it exactly`,
        replace: `1. Repeat the EXACT last sentence or question you just said — word for word
2. Do NOT advance to the next question
3. Do NOT assume an answer was given
4. Do NOT summarize or paraphrase — repeat it exactly

INTENT CLARIFICATION RULE:
If the customer's meaning is still unclear after one repeat, ask one short clarifying question.
Do NOT move to a new question until you understand what they meant or explicitly park the issue.`
      }
    ]
  }
};

export function getApplicableStructuredPatch(input: {
  agentId: string;
  errorType: string;
  systemPrompt: string;
}): GeneratedPatch | null {
  const spec = FIX_SPECS[input.errorType];
  if (!spec) return null;

  for (const patch of spec.patches) {
    if (patch.agentIds && !patch.agentIds.includes(input.agentId)) continue;
    if (!input.systemPrompt.includes(patch.find)) continue;
    return {
      find_text: patch.find,
      replace_text: patch.replace,
      reason: patch.label
    };
  }

  return null;
}
