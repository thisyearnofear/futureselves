export type Arc = "money" | "love" | "purpose" | "health";
export type Timeline = "6_months" | "5_years" | "10_years";
export type Archetype = "healed" | "wealthy" | "wise" | "builder" | "wanderer";
export type CastMember =
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
export type Choice = "toward" | "steady" | "release" | "repair";

export interface PersonaState {
    id: string;
    name: string;
    age?: string;
    city: string;
    currentChapter: string;
    primaryArc: Arc;
    miraculousYear: string;
    avoiding: string;
    afraidWontHappen: string;
    draining: string;
    timeline: Timeline;
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

export interface CheckInState {
    id: string;
    dateKey: string;
    word: string;
    note?: string;
    createdAt: number;
}

export interface TransmissionState {
    id: string;
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

export interface ConstellationStar {
    castMember: CastMember;
    label: string;
    state: "lit" | "dim" | "locked" | "quiet";
    unlockHint: string;
    emotionalRegister: string;
}

export interface ThreadState {
    id: string;
    title: string;
    seed: string;
    castMember: CastMember;
}

export interface GameState {
    persona: PersonaState | null;
    todayCheckIn: CheckInState | null;
    todayTransmission: TransmissionState | null;
    recentTransmissions: Array<TransmissionState>;
    constellation: Array<ConstellationStar>;
    openThreads: Array<ThreadState>;
}

export interface OnboardingDraft {
    name: string;
    age: string;
    city: string;
    currentChapter: string;
    primaryArc: Arc;
    miraculousYear: string;
    avoiding: string;
    afraidWontHappen: string;
    draining: string;
    timeline: Timeline;
    archetype: Archetype;
    firstVoice: "future_self" | "future_partner" | "future_mentor";
    voicePreset: "ember" | "atlas" | "sol";
    futureChildOptIn: boolean;
    significantDates: Array<string>;
}

export function getLocalDateKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function formatCastMember(castMember: CastMember): string {
    const labels: Record<CastMember, string> = {
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
    return labels[castMember];
}

export const arcLabels: Record<Arc, string> = {
    money: "Money",
    love: "Love",
    purpose: "Purpose",
    health: "Health",
};

export const timelineLabels: Record<Timeline, string> = {
    "6_months": "6 months ahead",
    "5_years": "5 years ahead",
    "10_years": "10 years ahead",
};

export const archetypeLabels: Record<Archetype, string> = {
    healed: "Healed",
    wealthy: "Wealthy",
    wise: "Wise",
    builder: "Builder",
    wanderer: "Wanderer",
};
