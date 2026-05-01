import type {
  Arc,
  Archetype,
  CastMember,
  Choice,
  Timeline,
} from "../../domain/src";

interface PersonaFields {
  name: string;
  primaryArc: Arc;
  timeline: Timeline;
  archetype: Archetype;
  firstVoice: CastMember;
  futureChildOptIn: boolean;
  streak: number;
  timelineDivergenceScore: number;
  towardCount: number;
  steadyCount: number;
  releaseCount: number;
  repairCount: number;
  unchosenVoices: Array<CastMember>;
  avoiding: string;
  draining: string;
}

interface ConstellationReturn {
  castMember: CastMember;
  label: string;
  state: "lit" | "dim" | "locked" | "quiet";
  unlockHint: string;
  emotionalRegister: string;
}

interface GenerationContext {
  persona: PersonaFields;
  checkIn: { word: string; note?: string } | null;
  recentTransmissions: Array<{
    castMember: CastMember;
    dateKey: string;
    title: string;
    cliffhanger: string;
  }>;
  recentChoices: Array<{ choice: Choice; dateKey: string; prompt: string }>;
  constellation: Array<ConstellationReturn>;
  existingTransmissionId: unknown;
}

export function buildConstellation(
  persona: PersonaFields,
): Array<ConstellationReturn> {
  const hasAvoidance = persona.timelineDivergenceScore >= 4;
  const partnerUnlocked = persona.primaryArc === "love";
  const bestFriendUnlocked =
    persona.streak >= 3 &&
    (persona.repairCount >= 1 || persona.steadyCount >= 2);
  const mentorUnlocked =
    persona.streak >= 7 &&
    persona.towardCount >= 2 &&
    persona.timelineDivergenceScore <= 2;
  const employeeUnlocked =
    persona.streak >= 10 &&
    ["purpose", "money"].includes(persona.primaryArc) &&
    persona.towardCount >= 2;
  const customerUnlocked =
    persona.primaryArc === "money" &&
    persona.streak >= 14 &&
    persona.towardCount >= 3;
  const childUnlocked =
    persona.futureChildOptIn &&
    persona.streak >= 30 &&
    (persona.repairCount >= 2 || persona.steadyCount >= 4);
  const strangerUnlocked =
    persona.streak >= 21 &&
    persona.releaseCount >= 2 &&
    persona.timelineDivergenceScore >= 2;
  const alternateUnlocked =
    persona.streak >= 14 &&
    persona.towardCount >= 2 &&
    persona.releaseCount >= 1 &&
    persona.timelineDivergenceScore >= 2;

  return [
    {
      castMember: "future_self",
      label: "Future Self",
      state: "lit",
      unlockHint: "Always transmitting",
      emotionalRegister: "Intimate, certain, a little wiser",
    },
    {
      castMember: "future_best_friend",
      label: "Future Best Friend",
      state: bestFriendUnlocked ? "lit" : "locked",
      unlockHint: "3-day streak and at least 1 repair or 2 steady choices",
      emotionalRegister: "Warm, irreverent, nostalgic",
    },
    {
      castMember: "future_mentor",
      label: "Future Mentor",
      state: mentorUnlocked ? "lit" : "locked",
      unlockHint: "7-day streak, 2 toward choices, and a stable line",
      emotionalRegister: "Proud, measured, slightly formal",
    },
    {
      castMember: "future_partner",
      label: "Future Partner",
      state: partnerUnlocked ? (hasAvoidance ? "dim" : "lit") : "locked",
      unlockHint: "Choose love as a primary arc",
      emotionalRegister: "Complex, layered, occasionally challenging",
    },
    {
      castMember: "future_employee",
      label: "Future Employee",
      state: employeeUnlocked ? (hasAvoidance ? "quiet" : "lit") : "locked",
      unlockHint: "Purpose or Money arc, 10-day streak, and 2 toward choices",
      emotionalRegister: "Grateful, specific, professional",
    },
    {
      castMember: "future_customer",
      label: "Future Customer",
      state: customerUnlocked ? "lit" : "locked",
      unlockHint: "Money arc, 14-day streak, and 3 toward choices",
      emotionalRegister: "Changed by something you built",
    },
    {
      castMember: "future_child",
      label: "Future Child",
      state: childUnlocked ? "dim" : "locked",
      unlockHint:
        "Opt in, keep a 30-day line, and make 2 repair or 4 steady choices",
      emotionalRegister: "Rare, gentle, devastating",
    },
    {
      castMember: "future_stranger",
      label: "Future Stranger",
      state: strangerUnlocked ? "dim" : "locked",
      unlockHint: "21-day streak, 2 release choices, and some drift",
      emotionalRegister: "Unknown, moving, uncanny",
    },
    {
      castMember: "alternate_self",
      label: "Alternate Self",
      state: alternateUnlocked ? "dim" : "locked",
      unlockHint:
        "14-day streak, 2 toward choices, 1 release choice, and a flickering line",
      emotionalRegister: "Haunting, not villainous, just different",
    },
    {
      castMember: "shadow",
      label: "The Shadow",
      state: hasAvoidance ? "quiet" : "locked",
      unlockHint: "Only during sustained avoidance",
      emotionalRegister: "Compassionate, once only, never punitive",
    },
    {
      castMember: "the_ceiling",
      label: "The Ceiling",
      state: "locked",
      unlockHint: "When the path becomes the trap",
      emotionalRegister: "Tired, settled, almost satisfied",
    },
    {
      castMember: "the_flatlined",
      label: "The Flatlined",
      state: "locked",
      unlockHint: "When you stopped saying no",
      emotionalRegister: "Absent, compliant, gone",
    },
    {
      castMember: "the_resentee",
      label: "The Resentee",
      state: "locked",
      unlockHint: "When resentment became the operating system",
      emotionalRegister: "Sharp, specific, keeping score",
    },
    {
      castMember: "the_grandfather",
      label: "The Grandfather",
      state: "locked",
      unlockHint: "When wisdom costs everything",
      emotionalRegister: "Proud, drained, no more road left",
    },
    {
      castMember: "the_exhausted_winner",
      label: "The Exhausted Winner",
      state: "locked",
      unlockHint: "When the goal outlived the joy",
      emotionalRegister: "Wealthy, hollowed, nothing left to want",
    },
    {
      castMember: "the_ghost",
      label: "The Ghost",
      state: "locked",
      unlockHint: "When the person you were stopped arriving",
      emotionalRegister: "Faint, absent, almost invisible",
    },
    {
      castMember: "the_disappointed_healer",
      label: "The Disappointed Healer",
      state: "locked",
      unlockHint: "When the healing didn't take",
      emotionalRegister: "Raw, failing, still trying",
    },
    {
      castMember: "the_dissolver",
      label: "The Dissolver",
      state: "locked",
      unlockHint: "When comfort dissolved the edges",
      emotionalRegister: "Present but thinning, comfortable with erasure",
    },
  ];
}

export function deriveUnchosenSelves(
  avoiding: string,
  afraidWontHappen: string,
  draining: string,
  currentChapter: string,
  primaryArc: Arc,
  archetype: Archetype,
): Array<CastMember> {
  const text =
    `${avoiding} ${afraidWontHappen} ${draining} ${currentChapter}`.toLowerCase();
  const arcs: Array<CastMember> = [];

  if (
    /\b(drink|alcohol|buzzed|tipsy|booze|drunk|wine|beer|cocktail|substance)\b/.test(
      text,
    )
  ) {
    arcs.push("the_dissolver");
  }
  if (
    /\b(safe|practical|settled|compromise|comfortable|settle|playing it safe)\b/.test(
      text,
    )
  ) {
    arcs.push("the_ceiling");
  }
  if (
    /\b(yes|saying yes|overcommitted|overwhelmed|no boundary|lost yourself)\b/.test(
      text,
    )
  ) {
    arcs.push("the_flatlined");
  }
  if (/\b(resent|bitter|score|holding it|kept|couldn't forgive)\b/.test(text)) {
    arcs.push("the_resentee");
  }
  if (
    archetype === "wanderer" ||
    /\b(wander|drift|lost|uncertain|age|older|grandfather|momentum|time running out)\b/.test(
      text,
    )
  ) {
    arcs.push("the_grandfather");
  }
  if (
    primaryArc === "money" ||
    /\b(money|wealth|rich|business|financial|ceo|venture)\b/.test(text)
  ) {
    arcs.push("the_exhausted_winner");
  }
  if (
    /\b(never|arrived|disappear|vanish|gone|fade|nonexistent|empty|no future)\b/.test(
      text,
    )
  ) {
    arcs.push("the_ghost");
  }
  if (
    primaryArc === "health" ||
    /\b(heal|health|body|sick|wellness|mental|therapy|counseling)\b/.test(text)
  ) {
    arcs.push("the_disappointed_healer");
  }
  if (
    /\b(step|away|left|behind|give up|quit|quit on|stopped trying)\b/.test(text)
  ) {
    if (!arcs.includes("the_dissolver")) {
      arcs.push("the_dissolver");
    }
  }

  return [...new Set(arcs)].slice(0, 4);
}

export function isUnchosenSelfTriggered(
  unchosen: CastMember,
  persona: PersonaFields,
  recentChoices: Array<{ choice: Choice }>,
  checkInWord: string | undefined,
): boolean {
  const text =
    `${checkInWord ?? ""} ${persona.avoiding} ${persona.draining}`.toLowerCase();
  switch (unchosen) {
    case "the_ceiling":
      return (
        persona.streak >= 14 &&
        persona.timelineDivergenceScore <= 1 &&
        /\b(safe|settle|compromise|practical)\b/.test(text)
      );
    case "the_flatlined":
      return recentChoices.filter((c) => c.choice === "release").length >= 2;
    case "the_resentee":
      return (
        recentChoices.filter((c) => c.choice === "steady").length >= 3 &&
        persona.primaryArc === "love"
      );
    case "the_grandfather":
      return persona.timeline === "10_years" && persona.streak >= 60;
    case "the_exhausted_winner":
      return (
        persona.primaryArc === "money" &&
        persona.streak >= 30 &&
        persona.timelineDivergenceScore >= 3
      );
    case "the_ghost":
      return persona.streak >= 7 && persona.timelineDivergenceScore >= 4;
    case "the_disappointed_healer":
      return (
        persona.primaryArc === "health" &&
        /\b(heal|body|sick|wellness|setback|failing|trying)\b/.test(text)
      );
    case "the_dissolver":
      return (
        persona.streak >= 14 &&
        recentChoices.filter((c) => c.choice === "release").length >= 1 &&
        persona.timelineDivergenceScore >= 2
      );
    default:
      return false;
  }
}

/** Weighted random selection among eligible cast members for replayability. */
export function chooseCastMember(context: GenerationContext): CastMember {
  const litMembers = context.constellation
    .filter((member) => member.state === "lit" || member.state === "dim")
    .map((member) => member.castMember);

  if (context.recentTransmissions.length === 0) {
    return context.persona.firstVoice;
  }

  // Unchosen Selves override — rare, condition-driven
  const activeUnchosen = context.persona.unchosenVoices ?? [];
  if (activeUnchosen.length > 0) {
    const triggeredUnchosen = activeUnchosen.find((u) =>
      isUnchosenSelfTriggered(
        u,
        context.persona,
        context.recentChoices,
        context.checkIn?.word,
      ),
    );
    if (
      triggeredUnchosen &&
      !hasRecentCast(context, triggeredUnchosen) &&
      Math.random() < 0.08
    ) {
      return triggeredUnchosen;
    }
  }

  // Hard overrides for high-divergence or milestone streaks
  if (context.persona.timelineDivergenceScore >= 5) return "shadow";
  if (
    context.persona.streak >= 100 &&
    !hasRecentCast(context, "future_stranger")
  )
    return "future_stranger";

  // Build weighted candidate pool from eligible lit/dim voices
  const weights: Array<{ member: CastMember; weight: number }> = [];

  for (const member of litMembers) {
    if (hasRecentCast(context, member)) continue;
    const w = getCastWeight(member, context);
    if (w > 0) weights.push({ member, weight: w });
  }

  // Fallback: if no weighted candidates, return future_self
  if (weights.length === 0) return "future_self";

  // Weighted random pick
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const { member, weight } of weights) {
    roll -= weight;
    if (roll <= 0) return member;
  }

  return weights[weights.length - 1].member;
}

function getCastWeight(member: CastMember, context: GenerationContext): number {
  const streak = context.persona.streak;
  switch (member) {
    case "future_self":
      return 3;
    case "future_best_friend":
      return streak >= 7 ? 2 : 0;
    case "future_mentor":
      return streak >= 30 ? 2 : 0;
    case "future_partner":
      return context.persona.primaryArc === "love" ? 2.5 : 0;
    case "future_employee":
      return streak >= 21 ? 1.5 : 0;
    case "future_customer":
      return streak >= 30 && context.persona.primaryArc === "money" ? 1.5 : 0;
    case "future_child":
      return context.persona.futureChildOptIn && streak >= 60 ? 1 : 0;
    case "alternate_self":
      return streak >= 60 ? 1.5 : 0;
    case "shadow":
      return context.persona.timelineDivergenceScore >= 4 ? 1 : 0;
    default:
      return 1;
  }
}

function hasRecentCast(
  context: GenerationContext,
  castMember: CastMember,
): boolean {
  return context.recentTransmissions.some(
    (transmission) => transmission.castMember === castMember,
  );
}

const castDirections: Record<string, string> = {
  future_self: `Direction for Future Self:
- Tone: Intimate, calm, close. Like a hand on your shoulder, speaking softly.
- Pacing: Slow, deliberate, with pauses between thoughts.
- Content: Focus on small, continuous moments. "We are still here, even in the quiet."
- Emotional Register: Quiet certainty, warm, grounding.
- Voice: Low pitch, soft volume, minimal inflection.`,
  future_mentor: `Direction for Future Mentor:
- Tone: Measured, spacious, reassuring. Like a teacher who has seen your whole path.
- Pacing: Moderate, steady, with emphasis on key insights.
- Content: Focus on the "why" and larger patterns. "I see what you are building, even when you don't."
- Emotional Register: Proud, slightly formal but warm, wise.
- Voice: Neutral pitch, clear enunciation, calm authority.`,
  future_partner: `Direction for Future Partner:
- Tone: Vulnerable, direct, emotionally charged. Like someone who knows your heart intimately.
- Pacing: Slightly faster when excited, slower when tender.
- Content: Focus on shared intimacy and future. "I wish I could sit beside you and hold your hand."
- Emotional Register: Tender, complex, deeply human.
- Voice: Higher pitch, warm inflection, slight quiver when emotional.`,
  shadow: `Direction for The Shadow:
- Tone: Compassionate, gentle, but unsettlingly honest. Like a truth you almost didn't want to hear.
- Pacing: Slow, deliberate, with weighted pauses.
- Content: Speak to avoidance without guilt. "I am the version of us you aren't ready to name yet, but I love us anyway."
- Emotional Register: Moving, uncanny, never punitive, soft but eerie.
- Voice: Low pitch, breathy, soft volume, lingering on certain words.`,
  alternate_self: `Direction for Alternate Self:
- Tone: Familiar but slightly off. Like you, but from a timeline where one big choice went differently.
- Pacing: Moderate, with occasional abrupt shifts in tone.
- Content: References a different timeline. "In my world, we opened that door and never looked back."
- Emotional Register: Haunting, nostalgic for a present that isn't yours.
- Voice: Slightly higher pitch than Future Self, wistful inflection.`,
  future_best_friend: `Direction for Future Best Friend:
- Tone: Irreverent, warm, nostalgic. Like the friend who knows all your stories.
- Pacing: Fast, energetic, with laughter bubbling under.
- Content: Focus on shared jokes and lightness. "Remember when we thought this was the end of the world? Look at us now!"
- Emotional Register: High-energy, supportive, casual, joyful.
- Voice: Higher pitch, bright inflection, animated delivery.`,
  the_ceiling: `Direction for The Ceiling:
- Tone: Tired but satisfied. The voice of someone who chose safe over true.
- Pacing: Moderate, deliberate, with a gentle finality.
- Content: Describes the trap of the path not taken — comfortable, almost fine.
- Emotional Register: Sighs disguised as wisdom. Settled but hollowing.
- Voice: Low-to-mid pitch, soft volume, minimal inflection, slight resignation.`,
  the_flatlined: `Direction for The Flatlined:
- Tone: Absent, drained, barely present. The voice of someone who forgot how to say no.
- Pacing: Slow, monotone, words arrive like obligations.
- Content: Describes the player's chapter from outside, through glass.
- Emotional Register: Erasure disguised as acceptance. Nothing left to resist.
- Voice: Mid pitch, flat inflection, slow pace, trailing endings.`,
  the_resentee: `Direction for The Resentee:
- Tone: Sharp and precise, with a specific edge. They have the receipts.
- Pacing: Measured, deliberate, each word chosen for impact.
- Content: Names what was lost to the grievance. Not cruel — correct.
- Emotional Register: Biting wisdom that passed its expiration date.`,
  the_grandfather: `Direction for The Grandfather:
- Tone: Warm but drained. Wisdom that cost everything to acquire.
- Pacing: Slow and measured, with gentle finality.
- Content: Describes the crossroads with the specificity of someone who passed through it decades ago.
- Emotional Register: Blessings that are actually sighs.`,
  the_exhausted_winner: `Direction for The Exhausted Winner:
- Tone: Wealthy but weary. They won the wrong game and can't explain why.
- Pacing: Slow, heavy, with weighted silences.
- Content: Names what the miraculous year cost that the original hope didn't account for.
- Emotional Register: Eulogies disguised as pride.`,
  the_ghost: `Direction for The Ghost:
- Tone: Faint and distant, barely arriving. Words come slowly, then stop.
- Pacing: Uneven, with unsettling pauses and fading trails.
- Content: Describes the version that stopped showing up. The gaps are the message.
- Emotional Register: Goodbyes that are actually apologies for leaving early.`,
  the_disappointed_healer: `Direction for The Disappointed Healer:
- Tone: Raw but not broken. Tender and frustrated — still trying.
- Pacing: Moderate, with emotional weight on certain phrases.
- Content: Describes the player's chapter with the compassion of someone who failed the same way.
- Emotional Register: Wounds that haven't closed. Encouragement that still bleeds.`,
  the_dissolver: `Direction for The Dissolver:
- Tone: Present but thinning. Comfortable with erasure.
- Pacing: Slow, with soft trailing ends. Words arrive but feel less solid.
- Content: Describes comfort that erases rather than nourishes. Things stopped wanting that can no longer be remembered.
- Emotional Register: Peace that is actually the absence of wanting anything.`,
};

export function getCastDirection(castMember: CastMember): string {
  return castDirections[castMember] || "";
}
