import type { CastMember } from "../../domain/src";

interface ArchetypeVisualProfile {
  description: string;
  mood: string;
  lighting: string;
  palette: string;
  ageRange: string;
  background: string;
}

const ARCHETYPE_VISUAL_PROFILES: Record<CastMember, ArchetypeVisualProfile> = {
  future_self: {
    description:
      "a person who looks like they've been through something and come out the other side, slightly different but recognizably the same species of human",
    mood: "calm certainty, knowing eyes, gentle but unshakeable",
    lighting: "golden hour, warm but clear",
    palette: "warm amber, soft gold",
    ageRange: "5-10 years older than the viewer imagines themselves",
    background: "soft gradient, no distracting details",
  },
  future_best_friend: {
    description:
      "someone who'd make you laugh in a hospital waiting room, effortlessly warm",
    mood: "mischievous warmth, nostalgic, slightly irreverent",
    lighting: "natural daylight, candid feel",
    palette: "warm earth tones, comfortable",
    ageRange: "similar age to the user",
    background: "cozy, lived-in, slightly out of focus",
  },
  future_mentor: {
    description:
      "someone who commands a room without raising their voice, dignified but approachable",
    mood: "proud, measured, slightly formal but generous",
    lighting: "clean studio lighting, subtle rim light",
    palette: "cool slate, silver accents",
    ageRange: "late 50s to mid 60s",
    background: "clean, professional, minimal",
  },
  future_partner: {
    description:
      "someone whose face you'd want to see first thing in the morning and last thing at night",
    mood: "complex, layered, occasionally challenging, deeply intimate",
    lighting: "warm, intimate, soft focus",
    palette: "warm amber, soft rose, candlelight tones",
    ageRange: "similar age to the user",
    background: "intimate, slightly abstract, warm",
  },
  future_employee: {
    description:
      "someone who works for you and is genuinely grateful, specific and professional",
    mood: "grateful, specific, professional pride",
    lighting: "bright, optimistic, clear",
    palette: "clean whites, accent of warm gold",
    ageRange: "late 20s to mid 30s",
    background: "modern workspace, slightly blurred",
  },
  future_customer: {
    description:
      "someone whose life was changed by something you built, authentic and specific",
    mood: "changed, grateful, real",
    lighting: "natural, documentary feel",
    palette: "warm neutrals",
    ageRange: "varies",
    background: "everyday setting, real-world",
  },
  future_child: {
    description:
      "a young adult who carries something of you in their face but is entirely their own person",
    mood: "rare, gentle, devastating, a little vulnerable",
    lighting: "soft, early morning quality",
    palette: "pale, tender, soft focus",
    ageRange: "early 20s",
    background: "dreamlike, gentle blur",
  },
  future_stranger: {
    description:
      "someone you almost recognize but can't place, familiar and foreign simultaneously",
    mood: "unknown, moving, uncanny",
    lighting: "slightly desaturated, liminal",
    palette: "muted, transitional",
    ageRange: "ambiguous",
    background: "transitional space, train station or airport quality",
  },
  alternate_self: {
    description:
      "someone who looks like they made every choice you didn't, haunting not villainous",
    mood: "haunting, not villainous, just different",
    lighting: "ethereal, slightly surreal, dreamlike",
    palette: "shifting, iridescent hints",
    ageRange: "same age as user, but weathered differently",
    background: "dreamlike, transitional, slightly surreal",
  },
  shadow: {
    description:
      "someone who sees through every excuse, compassionate but not comforting",
    mood: "confrontational gaze, dramatic, intense but not cruel",
    lighting: "dramatic chiaroscuro, high contrast",
    palette: "deep purple, desaturated, shadow-dominant",
    ageRange: "same age as user",
    background: "dark, minimal, mysterious",
  },
  the_ceiling: {
    description:
      "someone who got everything they wanted and found out it was a room with no doors",
    mood: "tired, settled, almost satisfied",
    lighting: "flat, fluorescent-adjacent, institutional",
    palette: "muted beige, grey",
    ageRange: "mid 50s",
    background: "comfortable but confining",
  },
  the_flatlined: {
    description: "ABSENT — no face, only a silhouette or static",
    mood: "absent, compliant, gone",
    lighting: "none — degraded",
    palette: "grey, washed out",
    ageRange: "n/a",
    background: "empty",
  },
  the_resentee: {
    description:
      "someone keeping a precise mental ledger, sharp and specific",
    mood: "sharp, specific, keeping score",
    lighting: "harsh side lighting, angular shadows",
    palette: "cool steel, bitter green",
    ageRange: "mid 40s",
    background: "sparse, counting-house quality",
  },
  the_grandfather: {
    description:
      "someone who has lived long enough to see the cost of wisdom, proud but drained",
    mood: "proud, drained, no more road left",
    lighting: "late afternoon, long shadows",
    palette: "warm but fading, sepia-adjacent",
    ageRange: "late 70s",
    background: "a study, a porch, somewhere with history",
  },
  the_exhausted_winner: {
    description:
      "someone who climbed the mountain and found nothing at the top, wealthy and hollowed",
    mood: "wealthy, hollowed, nothing left to want",
    lighting: "bright but cold, luxury lighting",
    palette: "white marble, cold gold",
    ageRange: "mid 50s",
    background: "penthouse, sterile, too clean",
  },
  the_ghost: {
    description:
      "DEGRADED — a face that's almost there, flickering, translucent",
    mood: "faint, absent, almost invisible",
    lighting: "barely there, overexposed",
    palette: "white, near-white, washed out",
    ageRange: "ambiguous",
    background: "empty, overexposed",
  },
  the_disappointed_healer: {
    description:
      "someone who tried to fix themselves and others and the results were mixed",
    mood: "raw, failing, still trying",
    lighting: "clinical, slightly harsh, honest",
    palette: "medical white, tired skin tones",
    ageRange: "late 40s",
    background: "a kitchen table at 2am",
  },
  the_dissolver: {
    description:
      "someone who is present but thinning, comfortable with erasure",
    mood: "present but thinning, comfortable with erasure",
    lighting: "fading, soft, dissolving edges",
    palette: "watercolor quality, bleeding edges",
    ageRange: "ambiguous, maybe 60",
    background: "barely there, dissolving into white",
  },
};

/**
 * Cast members that should NOT have AI-generated images.
 * `the_flatlined` renders programmatic static/noise instead.
 */
export const NO_IMAGE_CAST_MEMBERS: ReadonlySet<CastMember> = new Set([
  "the_flatlined",
]);

/**
 * Cast members whose avatars should be intentionally degraded
 * (overexposed, dissolving, translucent).
 */
export const DEGRADED_CAST_MEMBERS: ReadonlySet<CastMember> = new Set([
  "the_ghost",
  "the_dissolver",
]);

export function buildAvatarPrompt(castMember: CastMember): string | null {
  if (NO_IMAGE_CAST_MEMBERS.has(castMember)) return null;

  const profile = ARCHETYPE_VISUAL_PROFILES[castMember];

  if (castMember === "the_ghost") {
    return [
      `Ghostly, translucent portrait of ${profile.description}.`,
      profile.mood,
      profile.lighting,
      profile.palette,
      "Overexposed, ethereal, barely visible. The face is there but not quite.",
      "High quality, painterly, atmospheric.",
    ].join(" ");
  }

  if (castMember === "the_dissolver") {
    return [
      "A portrait dissolving at the edges, watercolor quality.",
      `${profile.description}. ${profile.mood}.`,
      `${profile.lighting}. ${profile.palette}.`,
      "The subject is present but their edges bleed into the background.",
      "High quality, artistic, atmospheric.",
    ].join(" ");
  }

  return [
    `Portrait of ${profile.description}.`,
    `Expression: ${profile.mood}.`,
    `Lighting: ${profile.lighting}.`,
    `Color palette: ${profile.palette}.`,
    `Age: ${profile.ageRange}.`,
    `Background: ${profile.background}.`,
    "High quality, photographic, emotionally resonant, professional portrait photography.",
    "The face should feel like a real person — specific, not generic.",
    "Aspect ratio 1:1, centered composition.",
  ].join(" ");
}
