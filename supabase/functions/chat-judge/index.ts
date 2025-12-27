function chatJudge(input: JudgeInput & { context_signals: any[] }): ChatDecision {
  const decision: ChatDecision = {
    mode: "observer",
    tone: "soft",
    reference_signal: false, // IMPORTANT: almost always false now
    ask_question: false,
    allow_banter: false,
  };

  if (!input.user_message) {
    return decision;
  }

  const msg = input.user_message.toLowerCase();
  const userOpenedDoor =
    msg.includes("?") ||
    /help|what to do|next|thinking|consider|advice/i.test(msg) ||
    input.conversation_state === "returning";

  if (!userOpenedDoor) {
    return decision;
  }

  const dominantContext = getDominantContext(input.context_signals);

  if (!dominantContext) {
    // User opened door but no strong context → gentle observer
    decision.mode = "observer";
    decision.tone = "soft";
    return decision;
  }

  // Context exists → reflect, not assert
  decision.mode = "reflect";
  decision.ask_question = true;
  decision.reference_signal = false; // NEVER reference email

  // Tone rules
  if (dominantContext === "CAREER" || dominantContext === "FINANCE") {
    decision.tone = "soft";
  } else if (input.has_prior_banter) {
    decision.tone = "playful";
    decision.allow_banter = true;
  }

  // Escalate only if user explicitly asks for advice
  if (/should i|what should|do you think/i.test(msg)) {
    decision.mode = "guide";
    decision.tone = "neutral";
    decision.ask_question = false;
  }

  return decision;
}
