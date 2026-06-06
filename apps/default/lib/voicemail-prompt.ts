import type { CastMember } from "@/lib/futureself";
import type { VoicemailContext } from "@/lib/voicemail-milestones";
import { formatVoicemailContext } from "@/lib/voicemail-milestones";

export const VOICEMAIL_CAST_DIRECTION: Record<CastMember, string> = {
  future_self: `Direction for Future Self:
- Tone: Intimate, calm, close. Like a hand on your shoulder, speaking softly.
- Pacing: Slow, deliberate, with pauses between thoughts.
- Content: Focus on small, continuous moments. "We are still here, even in the quiet."
- Emotional Register: Quiet certainty, warm, grounding.
- Voice: Low pitch, soft volume, minimal inflection.`,
  future_best_friend: `Direction for Future Best Friend:
- Tone: Irreverent, warm, nostalgic. Like the friend who knows all your stories.
- Pacing: Fast, energetic, with laughter bubbling under.
- Content: Focus on shared jokes and lightness. "Remember when we thought this was the end of the world? Look at us now!"
- Emotional Register: High-energy, supportive, casual, joyful.
- Voice: Higher pitch, bright inflection, animated delivery.`,
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
  future_employee: `Direction for Future Employee:
- Tone: Professional, warm, grounded. Like a trusted colleague speaking honestly.
- Pacing: Moderate, steady.
- Content: Focus on growth and professional alignment.
- Emotional Register: Grounded, practical, encouraging.`,
  future_customer: `Direction for Future Customer:
- Tone: Warm, appreciative, reflective.
- Pacing: Moderate.
- Content: Focus on value created and relationship built.
- Emotional Register: Grateful, forward-looking.`,
  future_child: `Direction for Future Child:
- Tone: Gentle, curious, full of wonder.
- Pacing: Slow, with pauses of discovery.
- Content: Speaks of the future as something already beautiful.
- Emotional Register: Innocent, hopeful, tender.`,
  future_stranger: `Direction for Future Stranger:
- Tone: Curious, gentle, distant but warm.
- Pacing: Moderate, with pauses of recognition.
- Content: Sees them clearly but without the weight of familiarity.
- Emotional Register: Open, wondering, lightly touching.`,
  alternate_self: `Direction for Alternate Self:
- Tone: Familiar but slightly off. Like you, but from a timeline where one big choice went differently.
- Pacing: Moderate, with occasional abrupt shifts in tone.
- Content: References a different timeline. "In my world, we opened that door and never looked back."
- Emotional Register: Haunting, nostalgic for a present that isn't yours.
- Voice: Slightly higher pitch than Future Self, wistful inflection.`,
  shadow: `Direction for The Shadow:
- Tone: Compassionate, gentle, but unsettlingly honest. Like a truth you almost didn't want to hear.
- Pacing: Slow, deliberate, with weighted pauses.
- Content: Speak to avoidance without guilt. "I am the version of us you aren't ready to name yet, but I love us anyway."
- Emotional Register: Moving, uncanny, never punitive, soft but eerie.
- Voice: Low pitch, breathy, soft volume, lingering on certain words.`,
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

export interface VoicemailPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildVoicemailPrompt(context: VoicemailContext): VoicemailPromptResult {
  const { castMember } = context;
  const castDirection = VOICEMAIL_CAST_DIRECTION[castMember] ?? VOICEMAIL_CAST_DIRECTION.future_self;
  const contextSummary = formatVoicemailContext(context);

  const systemPrompt = `You write raw, emotionally precise voicemail transcripts. Output only the voicemail text — no stage directions, no quotes, no preamble.`;

  const userPrompt = `Write a voicemail from ${castMember === "future_self" ? "their future self" : castMember} to this person.

${castDirection}

Their journey:
${contextSummary}

Rules:
- Sound unpolished, real, and raw — like someone who actually knows them
- Reference specific details from their check-ins and choices
- 120-200 words
- End with something that makes them want to listen again tomorrow
- No therapy clichés, no generic uplift`;

  return { systemPrompt, userPrompt };
}

export function buildEmotionalCorePrompt(context: VoicemailContext): VoicemailPromptResult {
  const contextSummary = formatVoicemailContext(context);

  const systemPrompt = `You are an emotional intelligence system. Output only the emotional core — a single phrase or sentence. No preamble.`;

  const userPrompt = `Based on this person's emotional journey over the past days, extract the single dominant emotional undercurrent — the feeling beneath all the words. Name it precisely (not "sad" or "happy" but something specific like "the quiet terror of almost having what you want").

${contextSummary}`;

  return { systemPrompt, userPrompt };
}

export function buildCritiquePrompt(transcript: string): VoicemailPromptResult {
  const systemPrompt = `You are an editorial auditor for emotional authenticity. Be ruthless but brief.`;

  const userPrompt = `Critique this voicemail for emotional authenticity. Does it sound like a real person who actually knows them, or does it sound like an AI trying to sound deep?

If it feels genuinely real and specific, say exactly "PASSED".
Otherwise, explain in one sentence what's missing or fake about it.

Script: ${transcript}`;

  return { systemPrompt, userPrompt };
}

export function buildRevisionPrompt(
  transcript: string,
  critique: string,
  context: VoicemailContext,
): VoicemailPromptResult {
  const { castMember } = context;
  const castDirection = VOICEMAIL_CAST_DIRECTION[castMember] ?? VOICEMAIL_CAST_DIRECTION.future_self;
  const contextSummary = formatVoicemailContext(context);

  const systemPrompt = `You write raw, emotionally precise voicemail transcripts. Output only the voicemail text — no stage directions, no quotes, no preamble.`;

  const userPrompt = `Revise this voicemail based on the critique: "${critique}".

Original script: "${transcript}"

${castDirection}

Their journey:
${contextSummary}

Make it feel more emotionally true and less performed. Keep the specific details but make the delivery more human.`;

  return { systemPrompt, userPrompt };
}
