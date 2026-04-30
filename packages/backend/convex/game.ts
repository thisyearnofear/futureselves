import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authAction, authMutation, authQuery } from "./functions";
import { internalMutation, internalQuery } from "./_generated/server";
import { getAIProvider } from "./ai";

const arcValidator = v.union(
  v.literal("money"),
  v.literal("love"),
  v.literal("purpose"),
  v.literal("health"),
);

const timelineValidator = v.union(
  v.literal("6_months"),
  v.literal("5_years"),
  v.literal("10_years"),
);

const archetypeValidator = v.union(
  v.literal("healed"),
  v.literal("wealthy"),
  v.literal("wise"),
  v.literal("builder"),
  v.literal("wanderer"),
);

const castMemberValidator = v.union(
  v.literal("future_self"),
  v.literal("future_best_friend"),
  v.literal("future_mentor"),
  v.literal("future_partner"),
  v.literal("future_employee"),
  v.literal("future_customer"),
  v.literal("future_child"),
  v.literal("future_stranger"),
  v.literal("alternate_self"),
  v.literal("shadow"),
  v.literal("the_ceiling"),
  v.literal("the_flatlined"),
  v.literal("the_resentee"),
  v.literal("the_grandfather"),
  v.literal("the_exhausted_winner"),
  v.literal("the_ghost"),
  v.literal("the_disappointed_healer"),
  v.literal("the_dissolver"),
);

const choiceValidator = v.union(
  v.literal("toward"),
  v.literal("steady"),
  v.literal("release"),
  v.literal("repair"),
);

const personaReturnValidator = v.object({
  id: v.id("personas"),
  name: v.string(),
  age: v.optional(v.string()),
  city: v.string(),
  currentChapter: v.string(),
  primaryArc: arcValidator,
  miraculousYear: v.string(),
  avoiding: v.string(),
  afraidWontHappen: v.string(),
  draining: v.string(),
  timeline: timelineValidator,
  archetype: archetypeValidator,
  firstVoice: castMemberValidator,
  selectedVoiceId: v.string(),
  selectedVoiceName: v.string(),
  selectedVoiceDescription: v.string(),
  futureChildOptIn: v.boolean(),
  themes: v.array(v.string()),
  wounds: v.array(v.string()),
  goals: v.array(v.string()),
  peopleMentioned: v.array(v.string()),
  significantDates: v.array(v.string()),
  streak: v.number(),
  lastCheckInDateKey: v.optional(v.string()),
  lastTransmissionDateKey: v.optional(v.string()),
  timelineDivergenceScore: v.number(),
  activeUnchosenSelves: v.array(castMemberValidator),
});

const checkInReturnValidator = v.object({
  id: v.id("checkIns"),
  dateKey: v.string(),
  word: v.string(),
  note: v.optional(v.string()),
  createdAt: v.number(),
});

const transmissionReturnValidator = v.object({
  id: v.id("transmissions"),
  dateKey: v.string(),
  castMember: castMemberValidator,
  title: v.string(),
  text: v.string(),
  actionPrompt: v.string(),
  cliffhanger: v.string(),
  audioUrl: v.union(v.string(), v.null()),
  status: v.union(
    v.literal("generating"),
    v.literal("ready"),
    v.literal("failed"),
  ),
  createdAt: v.number(),
});

const constellationReturnValidator = v.object({
  castMember: castMemberValidator,
  label: v.string(),
  state: v.union(
    v.literal("lit"),
    v.literal("dim"),
    v.literal("locked"),
    v.literal("quiet"),
  ),
  unlockHint: v.string(),
  emotionalRegister: v.string(),
});

const stateReturnValidator = v.object({
  persona: v.union(personaReturnValidator, v.null()),
  todayCheckIn: v.union(checkInReturnValidator, v.null()),
  todayTransmission: v.union(transmissionReturnValidator, v.null()),
  recentTransmissions: v.array(transmissionReturnValidator),
  constellation: v.array(constellationReturnValidator),
  openThreads: v.array(
    v.object({
      id: v.id("narrativeThreads"),
      title: v.string(),
      seed: v.string(),
      castMember: castMemberValidator,
    }),
  ),
});

const generationContextValidator = v.object({
  persona: personaReturnValidator,
  checkIn: v.union(checkInReturnValidator, v.null()),
  recentTransmissions: v.array(transmissionReturnValidator),
  recentChoices: v.array(
    v.object({
      dateKey: v.string(),
      choice: choiceValidator,
      prompt: v.string(),
    }),
  ),
  openThreads: v.array(
    v.object({
      title: v.string(),
      seed: v.string(),
      castMember: castMemberValidator,
    }),
  ),
  constellation: v.array(constellationReturnValidator),
  existingTransmissionId: v.union(v.id("transmissions"), v.null()),
});

type Arc = "money" | "love" | "purpose" | "health";
type Archetype = "healed" | "wealthy" | "wise" | "builder" | "wanderer";
type CastMember =
  | "future_self"
  | "future_best_friend"
  | "future_mentor"
  | "future_partner"
  | "future_employee"
  | "future_customer"
  | "future_child"
  | "future_stranger"
  | "alternate_self"
  | "shadow"
  | "the_ceiling"
  | "the_flatlined"
  | "the_resentee"
  | "the_grandfather"
  | "the_exhausted_winner"
  | "the_ghost"
  | "the_disappointed_healer"
  | "the_dissolver";
type Choice = "toward" | "steady" | "release" | "repair";

interface PersonaReturn {
  id: Id<"personas">;
  name: string;
  age?: string;
  city: string;
  currentChapter: string;
  primaryArc: Arc;
  miraculousYear: string;
  avoiding: string;
  afraidWontHappen: string;
  draining: string;
  timeline: "6_months" | "5_years" | "10_years";
  archetype: Archetype;
  firstVoice: CastMember;
  selectedVoiceId: string;
  selectedVoiceName: string;
  selectedVoiceDescription: string;
  futureChildOptIn: boolean;
  themes: Array<string>;
  wounds: Array<string>;
  goals: Array<string>;
  peopleMentioned: Array<string>;
  significantDates: Array<string>;
  streak: number;
  lastCheckInDateKey?: string;
  lastTransmissionDateKey?: string;
  timelineDivergenceScore: number;
  activeUnchosenSelves: Array<CastMember>;
}

interface CheckInReturn {
  id: Id<"checkIns">;
  dateKey: string;
  word: string;
  note?: string;
  createdAt: number;
}

interface TransmissionReturn {
  id: Id<"transmissions">;
  dateKey: string;
  castMember: CastMember;
  title: string;
  text: string;
  actionPrompt: string;
  cliffhanger: string;
  audioUrl: string | null;
  status: "generating" | "ready" | "failed";
  createdAt: number;
}

interface ConstellationReturn {
  castMember: CastMember;
  label: string;
  state: "lit" | "dim" | "locked" | "quiet";
  unlockHint: string;
  emotionalRegister: string;
}

interface GenerationContext {
  persona: PersonaReturn;
  checkIn: CheckInReturn | null;
  recentTransmissions: Array<TransmissionReturn>;
  recentChoices: Array<{
    dateKey: string;
    choice: Choice;
    prompt: string;
  }>;
  openThreads: Array<{
    title: string;
    seed: string;
    castMember: CastMember;
  }>;
  constellation: Array<ConstellationReturn>;
  existingTransmissionId: Id<"transmissions"> | null;
}

interface GeneratedTransmission {
  title: string;
  text: string;
  actionPrompt: string;
  cliffhanger: string;
}

export type VoicePreset = "ember" | "atlas" | "sol";

interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

const voicePresetDefaults: Record<VoicePreset, VoiceSettings> = {
  ember: {
    stability: 0.72,
    similarityBoost: 0.85,
    style: 0.1,
    useSpeakerBoost: true,
  },
  atlas: {
    stability: 0.78,
    similarityBoost: 0.88,
    style: 0.12,
    useSpeakerBoost: true,
  },
  sol: {
    stability: 0.65,
    similarityBoost: 0.8,
    style: 0.35,
    useSpeakerBoost: true,
  },
};

const voicePresetIds: Record<VoicePreset, string> = {
  ember: "21m00Tcm4TlvDq8ikWAM",
  atlas: "TxGEqnHWrfWFTfGW9XjX",
  sol: "EXAVITQu4vr4xnSDxMaL",
};

const voicePresetLabels: Record<VoicePreset, string> = {
  ember: "Ember",
  atlas: "Atlas",
  sol: "Sol",
};

const voicePresetDescriptions: Record<VoicePreset, string> = {
  ember: "warm, intimate, certain",
  atlas: "grounded, older, steady",
  sol: "soft, bright, quietly prophetic",
};

/** Default voice used for first-contact transmissions (user-selected at onboarding). */
const defaultVoiceId = voicePresetIds.ember;
const defaultVoiceSettings = voicePresetDefaults.ember;

/**
 * Distinct voice IDs per cast member.
 * Swap these for custom/cloned voices before filming for maximum personality contrast.
 */
const castMemberVoiceMap: Record<CastMember, string> = {
  future_self: "21m00Tcm4TlvDq8ikWAM",
  future_best_friend: "pFZP7JQGylIh6mjFyO2a",
  future_mentor: "TXhJ7dX3GJ5bNj6EPJpd",
  future_partner: "MF3ZGxNSIZHw3HjBFBqu",
  future_employee: "a2HLqOq8XMFZ7V5kWzQf",
  future_customer: "wC6hHJG1mGSpDxHGNzX6",
  future_child: "bIHZnB3eyE6R7V5t7pJn",
  future_stranger: "kD5hB3fN4eR6H8jL2mQp",
  alternate_self: "vN7rEPF2hR8G4sLb3jKc",
  shadow: "qW6tFDg1hO3nL9aY5pRs",
  the_ceiling: "TxGEqnHWrfWFTfGW9XjX",
  the_flatlined: "uPMPQ7L8kO2nR5xH3jCd",
  the_resentee: "nL7mFK9pQ1wY4xT2vAbS",
  the_grandfather: "rQ3nBH6gO5sK7hY9xDfG",
  the_exhausted_winner: "jW5vCM2hK8mP3zX7nPqE",
  the_ghost: "gH8dLP4jN2qL6kW1vBsM",
  the_disappointed_healer: "fZ7nKR3kM1pH5jV8tQwL",
  the_dissolver: "eY6mJQ2iL9sF4qR3nBwD",
};

/** Per-character voice settings tuned for personality contrast. */
const castMemberVoiceSettings: Record<CastMember, VoiceSettings> = {
  future_self: {
    stability: 0.72,
    similarityBoost: 0.85,
    style: 0.1,
    useSpeakerBoost: true,
  },
  future_best_friend: {
    stability: 0.55,
    similarityBoost: 0.7,
    style: 0.38,
    useSpeakerBoost: false,
  },
  future_mentor: {
    stability: 0.78,
    similarityBoost: 0.88,
    style: 0.12,
    useSpeakerBoost: true,
  },
  future_partner: {
    stability: 0.48,
    similarityBoost: 0.72,
    style: 0.42,
    useSpeakerBoost: false,
  },
  future_employee: {
    stability: 0.74,
    similarityBoost: 0.82,
    style: 0.15,
    useSpeakerBoost: true,
  },
  future_customer: {
    stability: 0.7,
    similarityBoost: 0.8,
    style: 0.2,
    useSpeakerBoost: true,
  },
  future_child: {
    stability: 0.44,
    similarityBoost: 0.75,
    style: 0.45,
    useSpeakerBoost: false,
  },
  future_stranger: {
    stability: 0.65,
    similarityBoost: 0.72,
    style: 0.25,
    useSpeakerBoost: true,
  },
  alternate_self: {
    stability: 0.62,
    similarityBoost: 0.78,
    style: 0.28,
    useSpeakerBoost: true,
  },
  shadow: {
    stability: 0.68,
    similarityBoost: 0.65,
    style: 0.18,
    useSpeakerBoost: true,
  },
  the_ceiling: {
    stability: 0.8,
    similarityBoost: 0.9,
    style: 0.05,
    useSpeakerBoost: true,
  },
  the_flatlined: {
    stability: 0.88,
    similarityBoost: 0.95,
    style: 0.02,
    useSpeakerBoost: false,
  },
  the_resentee: {
    stability: 0.52,
    similarityBoost: 0.75,
    style: 0.32,
    useSpeakerBoost: true,
  },
  the_grandfather: {
    stability: 0.82,
    similarityBoost: 0.85,
    style: 0.08,
    useSpeakerBoost: true,
  },
  the_exhausted_winner: {
    stability: 0.76,
    similarityBoost: 0.88,
    style: 0.1,
    useSpeakerBoost: true,
  },
  the_ghost: {
    stability: 0.9,
    similarityBoost: 0.6,
    style: 0.15,
    useSpeakerBoost: false,
  },
  the_disappointed_healer: {
    stability: 0.45,
    similarityBoost: 0.7,
    style: 0.48,
    useSpeakerBoost: false,
  },
  the_dissolver: {
    stability: 0.6,
    similarityBoost: 0.68,
    style: 0.22,
    useSpeakerBoost: false,
  },
};

type UnchosenSelfBase =
  | "the_ceiling"
  | "the_flatlined"
  | "the_resentee"
  | "the_grandfather"
  | "the_exhausted_winner"
  | "the_ghost"
  | "the_disappointed_healer"
  | "the_dissolver";

/** Display labels for cast-member voices (used in UI/audio attribution). */
const castMemberVoiceLabels: Record<CastMember, string> = {
  future_self: "Future Self",
  future_best_friend: "Future Best Friend",
  future_mentor: "Future Mentor",
  future_partner: "Future Partner",
  future_employee: "Future Employee",
  future_customer: "Future Customer",
  future_child: "Future Child",
  future_stranger: "Future Stranger",
  alternate_self: "Alternate Self",
  shadow: "The Shadow",
  the_ceiling: "The Ceiling",
  the_flatlined: "The Flatlined",
  the_resentee: "The Resentee",
  the_grandfather: "The Grandfather",
  the_exhausted_winner: "The Exhausted Winner",
  the_ghost: "The Ghost",
  the_disappointed_healer: "The Disappointed Healer",
  the_dissolver: "The Dissolver",
};

function toPersonaReturn(persona: {
  _id: Id<"personas">;
  name: string;
  age?: string;
  city: string;
  currentChapter: string;
  primaryArc: Arc;
  miraculousYear: string;
  avoiding: string;
  afraidWontHappen: string;
  draining: string;
  timeline: "6_months" | "5_years" | "10_years";
  archetype: Archetype;
  firstVoice: CastMember;
  selectedVoiceId: string;
  selectedVoiceName: string;
  selectedVoiceDescription: string;
  futureChildOptIn: boolean;
  themes: Array<string>;
  wounds: Array<string>;
  goals: Array<string>;
  peopleMentioned: Array<string>;
  significantDates: Array<string>;
  streak: number;
  lastCheckInDateKey?: string;
  lastTransmissionDateKey?: string;
  timelineDivergenceScore: number;
  activeUnchosenSelves: Array<CastMember>;
}): PersonaReturn {
  return {
    id: persona._id,
    name: persona.name,
    age: persona.age,
    city: persona.city,
    currentChapter: persona.currentChapter,
    primaryArc: persona.primaryArc,
    miraculousYear: persona.miraculousYear,
    avoiding: persona.avoiding,
    afraidWontHappen: persona.afraidWontHappen,
    draining: persona.draining,
    timeline: persona.timeline,
    archetype: persona.archetype,
    firstVoice: persona.firstVoice,
    selectedVoiceId: persona.selectedVoiceId,
    selectedVoiceName: persona.selectedVoiceName,
    selectedVoiceDescription: persona.selectedVoiceDescription,
    futureChildOptIn: persona.futureChildOptIn,
    themes: persona.themes,
    wounds: persona.wounds,
    goals: persona.goals,
    peopleMentioned: persona.peopleMentioned,
    significantDates: persona.significantDates,
    streak: persona.streak,
    lastCheckInDateKey: persona.lastCheckInDateKey,
    lastTransmissionDateKey: persona.lastTransmissionDateKey,
    timelineDivergenceScore: persona.timelineDivergenceScore,
    activeUnchosenSelves: persona.activeUnchosenSelves ?? [],
  };
}

function toCheckInReturn(checkIn: {
  _id: Id<"checkIns">;
  dateKey: string;
  word: string;
  note?: string;
  createdAt: number;
}): CheckInReturn {
  return {
    id: checkIn._id,
    dateKey: checkIn.dateKey,
    word: checkIn.word,
    note: checkIn.note,
    createdAt: checkIn.createdAt,
  };
}

async function toTransmissionReturn(
  ctx: {
    storage: { getUrl: (storageId: Id<"_storage">) => Promise<string | null> };
  },
  transmission: {
    _id: Id<"transmissions">;
    dateKey: string;
    castMember: CastMember;
    title: string;
    text: string;
    actionPrompt: string;
    cliffhanger: string;
    audioStorageId?: Id<"_storage">;
    status: "generating" | "ready" | "failed";
    createdAt: number;
  },
): Promise<TransmissionReturn> {
  return {
    id: transmission._id,
    dateKey: transmission.dateKey,
    castMember: transmission.castMember,
    title: transmission.title,
    text: transmission.text,
    actionPrompt: transmission.actionPrompt,
    cliffhanger: transmission.cliffhanger,
    audioUrl: transmission.audioStorageId
      ? await ctx.storage.getUrl(transmission.audioStorageId)
      : null,
    status: transmission.status,
    createdAt: transmission.createdAt,
  };
}

function buildConstellation(
  persona: PersonaReturn,
): Array<ConstellationReturn> {
  const hasAvoidance = persona.timelineDivergenceScore >= 4;
  const partnerUnlocked = persona.primaryArc === "love";
  const employeeUnlocked =
    persona.streak >= 21 && ["purpose", "money"].includes(persona.primaryArc);
  const customerUnlocked =
    persona.streak >= 30 && persona.primaryArc === "money";

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
      state: persona.streak >= 7 ? "lit" : "locked",
      unlockHint: "7-day streak",
      emotionalRegister: "Warm, irreverent, nostalgic",
    },
    {
      castMember: "future_mentor",
      label: "Future Mentor",
      state: persona.streak >= 30 ? "lit" : "locked",
      unlockHint: "30-day streak",
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
      unlockHint: "21 days of creative/work consistency",
      emotionalRegister: "Grateful, specific, professional",
    },
    {
      castMember: "future_customer",
      label: "Future Customer",
      state: customerUnlocked ? "lit" : "locked",
      unlockHint: "30-day business arc",
      emotionalRegister: "Changed by something you built",
    },
    {
      castMember: "future_child",
      label: "Future Child",
      state:
        persona.futureChildOptIn && persona.streak >= 60 ? "dim" : "locked",
      unlockHint: "Opt-in, then wait for the right day",
      emotionalRegister: "Rare, gentle, devastating",
    },
    {
      castMember: "future_stranger",
      label: "Future Stranger",
      state: persona.streak >= 100 ? "dim" : "locked",
      unlockHint: "Unannounced after 100 days",
      emotionalRegister: "Unknown, moving, uncanny",
    },
    {
      castMember: "alternate_self",
      label: "Alternate Self",
      state: persona.streak >= 60 ? "dim" : "locked",
      unlockHint: "Timeline divergence event, day 60+",
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

function deriveUnchosenSelves(
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

  // Alcohol/dissolution signals
  if (
    /\b(drink|alcohol|buzzed|tipsy|booze|drunk|wine|beer|cocktail|substance)\b/.test(
      text,
    )
  ) {
    arcs.push("the_dissolver");
  }

  // Settling signals → The Ceiling
  if (
    /\b(safe|practical|settled|compromise|comfortable|settle|playing it safe)\b/.test(
      text,
    )
  ) {
    arcs.push("the_ceiling");
  }

  // Loss of self → The Flatlined
  if (
    /\b(yes|saying yes|overcommitted|overwhelmed|no boundary|lost yourself)\b/.test(
      text,
    )
  ) {
    arcs.push("the_flatlined");
  }

  // Bitterness signals → The Resentee
  if (/\b(resent|bitter|score|holding it|kept|couldn't forgive)\b/.test(text)) {
    arcs.push("the_resentee");
  }

  // Wisdom at cost of momentum → The Grandfather (wanderer archetype)
  if (
    archetype === "wanderer" ||
    /\b(wander|drift|lost|uncertain|age|older|grandfather|momentum|time running out)\b/.test(
      text,
    )
  ) {
    arcs.push("the_grandfather");
  }

  // Money arc → The Exhausted Winner
  if (
    primaryArc === "money" ||
    /\b(money|wealth|rich|business|financial|ceo|venture)\b/.test(text)
  ) {
    arcs.push("the_exhausted_winner");
  }

  // Never arrived → The Ghost
  if (
    /\b(never|arrived|disappear|vanish|gone|fade|nonexistent|empty|no future)\b/.test(
      text,
    )
  ) {
    arcs.push("the_ghost");
  }

  // Failed to heal → The Disappointed Healer
  if (
    primaryArc === "health" ||
    /\b(heal|health|body|sick|wellness|mental|therapy|counseling)\b/.test(text)
  ) {
    arcs.push("the_disappointed_healer");
  }

  // Stepped away from hope → The Dissolver (catch-all)
  if (
    /\b(step|away|left|behind|give up|quit|quit on|stopped trying)\b/.test(text)
  ) {
    if (!arcs.includes("the_dissolver")) {
      arcs.push("the_dissolver");
    }
  }

  // Remove duplicates and limit to 4 max
  return [...new Set(arcs)].slice(0, 4);
}

function isUnchosenSelfTriggered(
  unchosen: CastMember,
  persona: PersonaReturn,
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

function chooseCastMember(context: GenerationContext): CastMember {
  const litMembers = context.constellation
    .filter((member) => member.state === "lit" || member.state === "dim")
    .map((member) => member.castMember);

  if (context.recentTransmissions.length === 0) {
    return context.persona.firstVoice;
  }

  // Unchosen Selves override — rare, condition-driven
  const activeUnchosen = context.persona.activeUnchosenSelves ?? [];
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

  if (context.persona.timelineDivergenceScore >= 5) return "shadow";
  if (
    context.persona.streak >= 100 &&
    !hasRecentCast(context, "future_stranger")
  )
    return "future_stranger";
  if (context.persona.streak >= 60 && !hasRecentCast(context, "alternate_self"))
    return "alternate_self";
  if (context.persona.streak >= 30 && litMembers.includes("future_mentor"))
    return "future_mentor";
  if (context.persona.streak >= 21 && litMembers.includes("future_employee"))
    return "future_employee";
  if (context.persona.streak >= 7 && litMembers.includes("future_best_friend"))
    return "future_best_friend";
  if (
    context.persona.primaryArc === "love" &&
    litMembers.includes("future_partner")
  )
    return "future_partner";
  return "future_self";
}

function hasRecentCast(
  context: GenerationContext,
  castMember: CastMember,
): boolean {
  return context.recentTransmissions.some(
    (transmission) => transmission.castMember === castMember,
  );
}

function extractTerms(text: string): Array<string> {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 8);
}

function toGeneratedTransmission(value: unknown): GeneratedTransmission | null {
  if (typeof value !== "object" || value === null) return null;
  if (
    !("title" in value) ||
    !("text" in value) ||
    !("actionPrompt" in value) ||
    !("cliffhanger" in value)
  ) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.title !== "string" ||
    typeof candidate.text !== "string" ||
    typeof candidate.actionPrompt !== "string" ||
    typeof candidate.cliffhanger !== "string"
  ) {
    return null;
  }
  return {
    title: candidate.title.slice(0, 80),
    text: candidate.text,
    actionPrompt: candidate.actionPrompt.slice(0, 180),
    cliffhanger: candidate.cliffhanger.slice(0, 220),
  };
}

function fallbackTransmission(
  context: GenerationContext,
  castMember: CastMember,
): GeneratedTransmission {
  const checkInWord = context.checkIn?.word ?? "between things";
  if (castMember === "future_partner") {
    return {
      title: "I kept thinking about today",
      text: `${context.persona.name}, it's me. I wish I could sit beside you for five minutes and point to the exact part of today I noticed: ${checkInWord}. You may think it was too small to matter, but I know how this version of us begins. It starts when you stop trying to make the whole future believable and just make one loving move you can actually keep. If your chest feels tight, do not turn that into a verdict. Send the message, clear the corner, take the walk, say the true sentence, or make the tiny repair. I am not waiting for a perfect version of you. I am coming closer because of the ordinary choices you make when nobody can applaud them yet. Tonight, choose one thing that would make it slightly easier for me to find you tomorrow.`,
      actionPrompt:
        "Make one small repair or loving move before the day closes.",
      cliffhanger:
        "Tomorrow, I want to tell you the first moment I realized you were actually letting me in.",
    };
  }
  return {
    title: "The echo from here",
    text: `${context.persona.name}, I remember the texture of this day: ${checkInWord}. Not because it looked dramatic from the outside, but because something in you kept moving even when the shape was still unclear. The future you are building is not asking for a performance today. It is asking for one honest turn toward ${context.persona.miraculousYear}. Do the smallest visible thing before the day closes. Let it be almost embarrassingly simple. That is how this chapter begins to answer back.`,
    actionPrompt: "Choose one small visible action before the day closes.",
    cliffhanger:
      "Tomorrow, I want to tell you what changed the first time you stopped waiting to feel ready.",
  };
}

function getCastDirection(castMember: CastMember): string {
  const directions: Record<string, string> = {
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
  return directions[castMember] || "";
}
function buildPrompt(
  context: GenerationContext,
  castMember: CastMember,
): string {
  const recentTransmissions = context.recentTransmissions
    .map((t) => `${t.dateKey}: ${t.title} (Cliffhanger: ${t.cliffhanger})`)
    .join("\n");

  const previousCheckIn =
    context.recentTransmissions.length > 0 ? context.checkIn : null;

  const continuityInstruction = previousCheckIn
    ? `NARRATIVE CONTINUITY: You MUST explicitly reference today's check-in word ("${previousCheckIn.word}") and contrast it with their current chapter or recent choices. If there was a recent choice, acknowledge the "lean" they took.`
    : "NARRATIVE START: This is the first contact. Make it feel like a long-awaited signal finally breaking through.";

  const choices = context.recentChoices
    .map(
      (choice) =>
        `${choice.dateKey}: ${choice.choice} (Prompt: ${choice.prompt})`,
    )
    .join("\n");

  return `Create today's futureself transmission as JSON only.

${continuityInstruction}

Player profile:
- Name: ${context.persona.name}
- City: ${context.persona.city}
- Current chapter: ${context.persona.currentChapter}
- Primary arc: ${context.persona.primaryArc}
- Miraculous next year: ${context.persona.miraculousYear}
- Avoiding: ${context.persona.avoiding}
- Afraid won't happen: ${context.persona.afraidWontHappen}
- Draining them: ${context.persona.draining}
- Today's check-in word: ${context.checkIn?.word ?? "not submitted"}
- Today's note: ${context.checkIn?.note ?? "none"}

Voice speaking today: ${castMember}.
Voice continuity: ${context.persona.selectedVoiceName}, ${context.persona.selectedVoiceDescription}.
${getCastDirection(castMember)}

Constraints:
- 160-230 words; intimate, warm, cinematic, not therapy-speak.
- Mention the word "${context.checkIn?.word ?? ""}" naturally in the first 2 paragraphs.
- If they made a choice recently, reference the "direction" they moved (toward, repair, etc).
- End with an unresolved cliffhanger that makes them want to check in tomorrow.

Return exactly:
{"title":"...","text":"...","actionPrompt":"one concrete action","cliffhanger":"tomorrow thread"}`;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(6, value));
}

function getChoiceDivergenceDelta(choice: Choice): number {
  if (choice === "toward") return -2;
  if (choice === "repair") return -1;
  if (choice === "release") return -1;
  return 0;
}

export const completeOnboarding = authMutation({
  args: {
    name: v.string(),
    age: v.optional(v.string()),
    city: v.string(),
    currentChapter: v.string(),
    primaryArc: arcValidator,
    miraculousYear: v.string(),
    avoiding: v.string(),
    afraidWontHappen: v.string(),
    draining: v.string(),
    timeline: timelineValidator,
    archetype: archetypeValidator,
    firstVoice: castMemberValidator,
    voicePreset: v.union(
      v.literal("ember"),
      v.literal("atlas"),
      v.literal("sol"),
    ),
    futureChildOptIn: v.boolean(),
    significantDates: v.array(v.string()),
  },
  returns: v.id("personas"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const preset = args.voicePreset as VoicePreset;
    const terms = [
      ...extractTerms(args.currentChapter),
      ...extractTerms(args.miraculousYear),
      ...extractTerms(args.avoiding),
    ];
    const existing = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    const activeUnchosenSelves =
      existing?.activeUnchosenSelves ??
      deriveUnchosenSelves(
        args.avoiding,
        args.afraidWontHappen,
        args.draining,
        args.currentChapter,
        args.primaryArc,
        args.archetype,
      );
    const payload = {
      userId: ctx.user._id,
      name: args.name.trim(),
      age: args.age?.trim() || undefined,
      city: args.city.trim(),
      currentChapter: args.currentChapter.trim(),
      primaryArc: args.primaryArc,
      miraculousYear: args.miraculousYear.trim(),
      avoiding: args.avoiding.trim(),
      afraidWontHappen: args.afraidWontHappen.trim(),
      draining: args.draining.trim(),
      timeline: args.timeline,
      archetype: args.archetype,
      firstVoice: args.firstVoice,
      selectedVoiceId: voicePresetIds[preset],
      selectedVoiceName: voicePresetLabels[preset],
      selectedVoiceDescription: voicePresetDescriptions[preset],
      futureChildOptIn: args.futureChildOptIn,
      themes: Array.from(new Set(terms)).slice(0, 10),
      wounds: extractTerms(`${args.avoiding} ${args.afraidWontHappen}`).slice(
        0,
        6,
      ),
      goals: extractTerms(args.miraculousYear).slice(0, 8),
      peopleMentioned: [],
      significantDates: args.significantDates,
      streak: existing?.streak ?? 0,
      lastCheckInDateKey: existing?.lastCheckInDateKey,
      lastTransmissionDateKey: existing?.lastTransmissionDateKey,
      timelineDivergenceScore: existing?.timelineDivergenceScore ?? 0,
      activeUnchosenSelves,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("personas", payload);
  },
});

export const saveCheckIn = authMutation({
  args: {
    dateKey: v.string(),
    word: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.id("checkIns"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const word = args.word.trim().slice(0, 40);
    if (!word) throw new Error("Check-in word is required");
    const existing = await ctx.db
      .query("checkIns")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", ctx.user._id).eq("dateKey", args.dateKey),
      )
      .unique();
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!persona) throw new Error("Complete onboarding before checking in");

    if (existing) {
      await ctx.db.patch(existing._id, {
        word,
        note: args.note?.trim() || undefined,
        updatedAt: now,
      });
      return existing._id;
    }

    let divergenceAdjustment = -1;
    if (
      persona.lastTransmissionDateKey &&
      persona.lastTransmissionDateKey !== args.dateKey
    ) {
      const previousChoice = await ctx.db
        .query("choices")
        .withIndex("by_userId_and_dateKey", (q) =>
          q
            .eq("userId", ctx.user._id)
            .eq("dateKey", persona.lastTransmissionDateKey!),
        )
        .unique();
      divergenceAdjustment = previousChoice ? -1 : 1;
    }

    const streak =
      persona.lastCheckInDateKey &&
      isPreviousDateKey(persona.lastCheckInDateKey, args.dateKey)
        ? persona.streak + 1
        : persona.lastCheckInDateKey === args.dateKey
          ? persona.streak
          : 1;
    await ctx.db.patch(persona._id, {
      streak,
      lastCheckInDateKey: args.dateKey,
      timelineDivergenceScore: clampScore(
        persona.timelineDivergenceScore + divergenceAdjustment,
      ),
      updatedAt: now,
    });
    return await ctx.db.insert("checkIns", {
      userId: ctx.user._id,
      dateKey: args.dateKey,
      word,
      note: args.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const recordChoice = authMutation({
  args: {
    dateKey: v.string(),
    choice: choiceValidator,
    prompt: v.string(),
  },
  returns: v.id("choices"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("choices")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", ctx.user._id).eq("dateKey", args.dateKey),
      )
      .unique();
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    const openThreads = await ctx.db
      .query("narrativeThreads")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", ctx.user._id).eq("status", "open"),
      )
      .take(3);

    const selectedThread = openThreads[0] ?? null;
    if (selectedThread && args.choice === "repair") {
      await ctx.db.patch(selectedThread._id, {
        status: "resolved",
        updatedAt: now,
      });
    }
    if (selectedThread && args.choice === "release") {
      await ctx.db.patch(selectedThread._id, {
        status: "quiet",
        updatedAt: now,
      });
    }
    if (persona) {
      await ctx.db.patch(persona._id, {
        timelineDivergenceScore: clampScore(
          persona.timelineDivergenceScore +
            getChoiceDivergenceDelta(args.choice),
        ),
        updatedAt: now,
      });
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        choice: args.choice,
        prompt: args.prompt,
        createdAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("choices", {
      userId: ctx.user._id,
      dateKey: args.dateKey,
      choice: args.choice,
      prompt: args.prompt,
      createdAt: now,
    });
  },
});

export const getState = authQuery({
  args: {
    dateKey: v.string(),
    now: v.number(),
  },
  returns: stateReturnValidator,
  handler: async (ctx, args) => {
    const personaDoc = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!personaDoc) {
      return {
        persona: null,
        todayCheckIn: null,
        todayTransmission: null,
        recentTransmissions: [],
        constellation: [],
        openThreads: [],
      };
    }
    const persona = toPersonaReturn(personaDoc);
    const todayCheckInDoc = await ctx.db
      .query("checkIns")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", ctx.user._id).eq("dateKey", args.dateKey),
      )
      .unique();
    const todayTransmissionDoc = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", ctx.user._id).eq("dateKey", args.dateKey),
      )
      .unique();
    const recentTransmissionDocs = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .take(5);
    const openThreadDocs = await ctx.db
      .query("narrativeThreads")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", ctx.user._id).eq("status", "open"),
      )
      .take(3);

    return {
      persona,
      todayCheckIn: todayCheckInDoc ? toCheckInReturn(todayCheckInDoc) : null,
      todayTransmission: todayTransmissionDoc
        ? await toTransmissionReturn(ctx, todayTransmissionDoc)
        : null,
      recentTransmissions: await Promise.all(
        recentTransmissionDocs.map((transmission) =>
          toTransmissionReturn(ctx, transmission),
        ),
      ),
      constellation: buildConstellation(persona),
      openThreads: openThreadDocs.map((thread) => ({
        id: thread._id,
        title: thread.title,
        seed: thread.seed,
        castMember: thread.castMember,
      })),
    };
  },
});

export const getGenerationContext = internalQuery({
  args: {
    userId: v.id("users"),
    dateKey: v.string(),
  },
  returns: v.union(generationContextValidator, v.null()),
  handler: async (ctx, args) => {
    const personaDoc = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!personaDoc) return null;
    const persona = toPersonaReturn(personaDoc);
    const checkInDoc = await ctx.db
      .query("checkIns")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", args.userId).eq("dateKey", args.dateKey),
      )
      .unique();
    const todayTransmissionDoc = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", args.userId).eq("dateKey", args.dateKey),
      )
      .unique();
    const recentTransmissionDocs = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(5);
    const recentChoiceDocs = await ctx.db
      .query("choices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);
    const openThreadDocs = await ctx.db
      .query("narrativeThreads")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "open"),
      )
      .take(3);
    return {
      persona,
      checkIn: checkInDoc ? toCheckInReturn(checkInDoc) : null,
      recentTransmissions: await Promise.all(
        recentTransmissionDocs.map((transmission) =>
          toTransmissionReturn(ctx, transmission),
        ),
      ),
      recentChoices: recentChoiceDocs.map((choice) => ({
        dateKey: choice.dateKey,
        choice: choice.choice,
        prompt: choice.prompt,
      })),
      openThreads: openThreadDocs.map((thread) => ({
        title: thread.title,
        seed: thread.seed,
        castMember: thread.castMember,
      })),
      constellation: buildConstellation(persona),
      existingTransmissionId: todayTransmissionDoc?._id ?? null,
    };
  },
});

export const beginTransmissionGeneration = internalMutation({
  args: {
    userId: v.id("users"),
    dateKey: v.string(),
    castMember: castMemberValidator,
  },
  returns: v.id("transmissions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", args.userId).eq("dateKey", args.dateKey),
      )
      .unique();
    const payload = {
      userId: args.userId,
      dateKey: args.dateKey,
      castMember: args.castMember,
      title: "Tuning the signal",
      text: "Your transmission is being composed. The written message lands first, then the voice catches up if audio is available.",
      actionPrompt: "",
      cliffhanger: "The next line is almost here.",
      status: "generating" as const,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("transmissions", {
      ...payload,
      createdAt: now,
    });
  },
});

export const storeGeneratedTransmission = internalMutation({
  args: {
    userId: v.id("users"),
    dateKey: v.string(),
    castMember: castMemberValidator,
    title: v.string(),
    text: v.string(),
    actionPrompt: v.string(),
    cliffhanger: v.string(),
    audioStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("transmissions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", args.userId).eq("dateKey", args.dateKey),
      )
      .unique();
    const payload = {
      userId: args.userId,
      dateKey: args.dateKey,
      castMember: args.castMember,
      title: args.title,
      text: args.text,
      actionPrompt: args.actionPrompt,
      cliffhanger: args.cliffhanger,
      audioStorageId: args.audioStorageId,
      status: "ready" as const,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (persona) {
      await ctx.db.patch(persona._id, {
        lastTransmissionDateKey: args.dateKey,
        updatedAt: now,
      });
    }
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    const transmissionId = await ctx.db.insert("transmissions", payload);
    await ctx.db.insert("narrativeThreads", {
      userId: args.userId,
      title: args.title,
      status: "open",
      castMember: args.castMember,
      seed: args.cliffhanger,
      createdAt: now,
      updatedAt: now,
    });
    return transmissionId;
  },
});

export const generateDailyTransmission = authAction({
  args: {
    dateKey: v.string(),
    localNow: v.string(),
  },
  returns: v.object({
    transmissionId: v.union(v.id("transmissions"), v.null()),
    generated: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    transmissionId: Id<"transmissions"> | null;
    generated: boolean;
  }> => {
    const context: GenerationContext | null = await ctx.runQuery(
      internal.game.getGenerationContext,
      {
        userId: ctx.userId,
        dateKey: args.dateKey,
      },
    );
    if (!context)
      throw new Error("Complete onboarding before generating a transmission");
    if (context.existingTransmissionId) {
      return {
        transmissionId: context.existingTransmissionId,
        generated: false,
      };
    }
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    const castMember = chooseCastMember(context);
    const transmissionId = await ctx.runMutation(
      internal.game.beginTransmissionGeneration,
      {
        userId: ctx.userId,
        dateKey: args.dateKey,
        castMember,
      },
    );
    let parsed: unknown = null;

    try {
      const aiProvider = getAIProvider();
      const generatedText = await aiProvider.generate(
        `${buildPrompt(context, castMember)}\n\nLocal open time: ${args.localNow}`,
        "You write emotionally precise narrative transmissions for futureself, a reflective imagination game. Output valid JSON only.",
      );
      if (generatedText) {
        try {
          parsed = JSON.parse(generatedText) as unknown;
        } catch {
          parsed = null;
        }
      }

      const generated =
        toGeneratedTransmission(parsed) ??
        fallbackTransmission(context, castMember);

      let audioStorageId: Id<"_storage"> | undefined;
      if (elevenLabsKey) {
        try {
          const voiceId = castMemberVoiceMap[castMember] ?? defaultVoiceId;
          const settings =
            castMemberVoiceSettings[castMember] ?? defaultVoiceSettings;
          const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
              method: "POST",
              headers: {
                accept: "audio/mpeg",
                "content-type": "application/json",
                "xi-api-key": elevenLabsKey,
              },
              body: JSON.stringify({
                text: generated.text,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                  stability: settings.stability,
                  similarity_boost: settings.similarityBoost,
                  style: settings.style,
                  use_speaker_boost: settings.useSpeakerBoost,
                },
              }),
            },
          );
          if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            throw new Error(`ElevenLabs synthesis failed: ${errorText}`);
          }
          const audioBlob = await ttsResponse.blob();
          audioStorageId = await ctx.storage.store(audioBlob);
        } catch {
          audioStorageId = undefined;
        }
      }
      await ctx.runMutation(internal.game.storeGeneratedTransmission, {
        userId: ctx.userId,
        dateKey: args.dateKey,
        castMember,
        title: generated.title,
        text: generated.text,
        actionPrompt: generated.actionPrompt,
        cliffhanger: generated.cliffhanger,
        audioStorageId,
      });
      return { transmissionId, generated: true };
    } catch {
      const generated = fallbackTransmission(context, castMember);
      await ctx.runMutation(internal.game.storeGeneratedTransmission, {
        userId: ctx.userId,
        dateKey: args.dateKey,
        castMember,
        title: generated.title,
        text: generated.text,
        actionPrompt: generated.actionPrompt,
        cliffhanger: generated.cliffhanger,
      });
      return { transmissionId, generated: true };
    }
  },
});

function isPreviousDateKey(previous: string, current: string): boolean {
  const previousDate = new Date(`${previous}T12:00:00`);
  const currentDate = new Date(`${current}T12:00:00`);
  const diff = currentDate.getTime() - previousDate.getTime();
  return diff > 0 && diff <= 36 * 60 * 60 * 1000;
}

export const debugResetPersona = authMutation({
  args: {},
  handler: async (ctx) => {
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (persona) {
      await ctx.db.delete(persona._id);
      const checkIns = await ctx.db
        .query("checkIns")
        .filter((q) => q.eq(q.field("userId"), ctx.user._id))
        .collect();
      for (const c of checkIns) await ctx.db.delete(c._id);
      const transmissions = await ctx.db
        .query("transmissions")
        .filter((q) => q.eq(q.field("userId"), ctx.user._id))
        .collect();
      for (const t of transmissions) await ctx.db.delete(t._id);
      const threads = await ctx.db
        .query("narrativeThreads")
        .filter((q) => q.eq(q.field("userId"), ctx.user._id))
        .collect();
      for (const th of threads) await ctx.db.delete(th._id);
      const choices = await ctx.db
        .query("choices")
        .filter((q) => q.eq(q.field("userId"), ctx.user._id))
        .collect();
      for (const ch of choices) await ctx.db.delete(ch._id);
    }
  },
});

export const debugSetGameState = authMutation({
  args: {
    streak: v.optional(v.number()),
    divergence: v.optional(v.number()),
    clearToday: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!persona) return;

    await ctx.db.patch(persona._id, {
      streak: args.streak ?? persona.streak,
      timelineDivergenceScore:
        args.divergence ?? persona.timelineDivergenceScore,
      lastTransmissionDateKey: args.clearToday
        ? undefined
        : persona.lastTransmissionDateKey,
      lastCheckInDateKey: args.clearToday
        ? undefined
        : persona.lastCheckInDateKey,
    });

    if (args.clearToday) {
      const dateKey = new Date().toISOString().split("T")[0];
      const todayT = await ctx.db
        .query("transmissions")
        .withIndex("by_userId_and_dateKey", (q) =>
          q.eq("userId", ctx.user._id).eq("dateKey", dateKey),
        )
        .unique();
      if (todayT) await ctx.db.delete(todayT._id);
      const todayC = await ctx.db
        .query("checkIns")
        .withIndex("by_userId_and_dateKey", (q) =>
          q.eq("userId", ctx.user._id).eq("dateKey", dateKey),
        )
        .unique();
      if (todayC) await ctx.db.delete(todayC._id);
    }
  },
});
