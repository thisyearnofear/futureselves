import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useMutation } from "convex/react";
import * as Haptics from "expo-haptics";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "expo-router";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  CastMember,
  Choice,
  ChoiceOutcome,
  ConstellationStar,
  FirstVoiceCastMember,
  GameState,
  PersonaState,
  VoicePreset,
} from "@/lib/futureself";
import type { ReminderPreferences } from "@/lib/reminder-preferences";
import { useSavedSignalPins } from "@/lib/saved-signal-pins";
import { buildSignalLink, formatCastMember, inferVoicePresetFromSelectedVoice } from "@/lib/futureself";
import {
  ChoiceSection,
  EveningUrgencyBanner,
  FlareOverlay,
  HeroSection,
  MilestoneOverlay,
  ProgressionSection,
  ReceiveSignalSection,
  SessionArc,
  VoiceUnlockOverlay,
  WeeklyReflectionSection,
  RitualRefinementPrompt,
  StorySection,
  TransmissionSection,
  YesterdayMoment,
} from "@/components/futureself-home-sections";
import { RitualState } from "@/components/ritual-state";
import {
  MemoryArchiveSection,
  sortMemoryTransmissions,
  type MemoryArchiveFilter,
} from "@/components/memory-archive-section";
import { FutureselfProfileSheet } from "@/components/futureself-profile-sheet";
import { FutureselfSettingsSheet } from "@/components/futureself-settings-sheet";
import { TransmissionShareCard } from "@/components/transmission-share-card";
import { MemoryReadout } from "@/components/memory-readout";
import { BottomNav } from "@/components/bottom-nav";
import { styles } from "@/components/futureself-home.styles";
import { isLocalMode } from "@/lib/ai";
import { generateLocalTransmission } from "@/lib/local-llm";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { QVAC_MODELS } from "@/hooks/use-qvac-prewarm";

interface FutureselfHomeProps {
  state: GameState;
  dateKey: string;
  reminderPreferences: ReminderPreferences;
  saveReminderPreferences: (preferences: ReminderPreferences) => Promise<void>;
}

const choiceCopy: Record<Choice, string> = {
  toward: "Move toward it",
  steady: "Keep faith",
  release: "Release one thing",
  repair: "Repair a thread",
};

const choiceColors: Record<Choice, string> = {
  toward: "#F7D38B",
  steady: "#AEB6D4",
  release: "#FF9A9A",
  repair: "#A9F7B5",
};

const wordNudges = ["threshold", "brave", "lighter"];
const noteNudges = [
  "I almost did the hard thing today.",
  "There is one conversation I keep replaying.",
  "I want the next version of me to feel less defended.",
];

const actionNudges: Array<{
  label: string;
  choice: Choice;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    label: "Send one honest text",
    choice: "repair",
    icon: "chatbubble-ellipses-outline",
  },
  {
    label: "Open the thing for five minutes",
    choice: "toward",
    icon: "arrow-forward-circle-outline",
  },
  {
    label: "Remove one small drain",
    choice: "release",
    icon: "close-circle-outline",
  },
];

const demoCastOptions: Array<{ castMember: CastMember; label: string }> = [
  { castMember: "future_partner", label: "Future Partner" },
  { castMember: "future_mentor", label: "Future Mentor" },
  { castMember: "alternate_self", label: "Alternate Self" },
  { castMember: "shadow", label: "The Shadow" },
  { castMember: "the_ghost", label: "The Ghost" },
];

const isDebugMode = process.env.EXPO_PUBLIC_DEBUG_MODE === "true";

export function FutureselfHome({
  state,
  dateKey,
  reminderPreferences,
  saveReminderPreferences,
}: FutureselfHomeProps) {
  const router = useRouter();
  const { signOut } = useAuthActions();

  const completeOnboarding = useMutation(api.game.completeOnboarding);
  const saveCheckIn = useMutation(api.game.saveCheckIn);
  const recordChoice = useMutation(api.game.recordChoice);
  const saveTransmissionResponse = useMutation(api.game.saveTransmissionResponse);
  const generateTransmission = useAction(api.game.generateDailyTransmission);
  const generateAvatar = useAction(api.face.generateAvatar);
  const generateSynthesis = useAction(api.synthesis.generateWeeklySynthesis);
  const generateWelcomeVoicemail = useAction(api.voicemail_native.generateNativeVoicemail);

  // Debug mutations
  const debugReset = useMutation(api.game.debugResetPersona);
  const debugSetState = useMutation(api.game.debugSetGameState);

  // QVAC local-mode hooks (no-op on web, called in handleReceive when local)
  const localMode = useMemo(() => isLocalMode(), []);
  // beginTransmissionGenerationLocal is an authMutation, so useMutation (not
  // useAction) is the correct hook. useAction is for authAction; calling a
  // mutation through it would invoke action-timeout/retry semantics on a
  // synchronous DB write.
  const beginLocalTransmission = useMutation(api.game.beginTransmissionGenerationLocal);
  // attachLocalTransmission is an internalMutation; the client should call it
  // via internal.*, not api.*. The type system permits the api.* form but the
  // runtime expects internal.* for internal mutations.
  const attachLocalText = useMutation(internal.game.attachLocalTransmission);
  // Cleanup for the local stub row if on-device generation throws between
  // beginLocalTransmission and attachLocalText. Without this, an empty
  // "Tuning the signal" row persists and the chamber shows the stub forever.
  const cancelLocalTransmission = useMutation(api.game.cancelLocalTransmission);

  // On-device speech recognition (Parakeet via QVAC). Only active in local mode.
  const speech = useSpeechRecognition({
    sttModelId: localMode ? QVAC_MODELS.stt : null,
    onResult: (transcribedText) => {
      // Take the first word if the model transcribed a full sentence.
      const firstWord = transcribedText.split(/\s+/)[0] ?? transcribedText;
      setWord(firstWord.toLowerCase());
    },
  });

  const [word, setWord] = useState(state.todayCheckIn?.word ?? "");
  const [note, setNote] = useState(state.todayCheckIn?.note ?? "");
  const [showDetailInput, setShowDetailInput] = useState(
    Boolean(state.todayCheckIn?.note),
  );
  const [isReceiving, setIsReceiving] = useState(false);
  const [isSavingResponse, setIsSavingResponse] = useState(false);
  const [isGeneratingSynthesis, setIsGeneratingSynthesis] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFlare, setShowFlare] = useState(false);
  const [flareColor, setFlareColor] = useState("#F7D38B");
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [celebrateNextTransmission, setCelebrateNextTransmission] =
    useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [newlyUnlockedVoice, setNewlyUnlockedVoice] = useState<{
    label: string;
    emotionalRegister: string;
    castMember: string;
  } | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const milestoneShownRef = useRef(false);
  const unlockedRef = useRef<Set<string>>(new Set());
  const [showTransmissionArrival, setShowTransmissionArrival] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profilePromptDismissed, setProfilePromptDismissed] = useState(false);
  const [forcedCastMember, setForcedCastMember] = useState<CastMember | null>(
    null,
  );
  const [selectedThreadId, setSelectedThreadId] =
    useState<Id<"narrativeThreads"> | null>(null);
  const [yesterdayMomentDismissed, setYesterdayMomentDismissed] = useState(false);
  const [choiceOutcome, setChoiceOutcome] = useState<ChoiceOutcome | null>(
    null,
  );
  const [archiveFilter, setArchiveFilter] = useState<MemoryArchiveFilter>("all");
  const arrivalPulse = useSharedValue(0);
  const arrivalSweep = useSharedValue(-280);
  const welcomeVoicemailTriggered = useRef(false);
  const shareCardRef = useRef<View>(null);

  const persona = state.persona;
  const { pinnedSignalIds, togglePinnedSignal } = useSavedSignalPins();
  const nextUnlock = useMemo(
    () => (persona ? getNextUnlock(persona, state.constellation) : null),
    [persona, state.constellation],
  );
  const previousTransmissions = useMemo(
    () =>
      state.recentTransmissions.filter(
        (transmission) => transmission.id !== state.todayTransmission?.id,
      ),
    [state.recentTransmissions, state.todayTransmission],
  );
  const memoryTransmissions = useMemo(
    () => sortMemoryTransmissions(previousTransmissions, pinnedSignalIds),
    [pinnedSignalIds, previousTransmissions],
  );
  const homeMemoryTransmissions = useMemo(
    () => memoryTransmissions.slice(0, 3),
    [memoryTransmissions],
  );
  const transmissionCount = state.recentTransmissions.length;
  const hasTransmissionToday = Boolean(state.todayTransmission);
  const isProfileIncomplete = Boolean(
    persona && (!persona.age || !persona.draining.trim() || persona.significantDates.length === 0),
  );
  const shouldShowRefinementPrompt =
    hasTransmissionToday &&
    transmissionCount <= 2 &&
    Boolean(persona);
  const shouldShowProfilePrompt =
    hasTransmissionToday &&
    transmissionCount >= 3 &&
    isProfileIncomplete &&
    !profilePromptDismissed;
  // Progressive disclosure & Focus Mode Enforcement:
  // If today's transmission hasn't arrived, hide most of the UI to focus on the check-in ritual.
  const isFocusMode = !hasTransmissionToday;
  const shouldShowProgression = hasTransmissionToday;
  // Lowered from >= 5 to >= 1 so Day-1 users see their streak/divergence/constellation
  // immediately after their first transmission. The early constellation is sparse on purpose
  // — it visualises future capacity rather than current emptiness.
  const shouldShowSystemDepth = !isFocusMode && transmissionCount >= 1;
  const shouldShowStoryDepth = !isFocusMode && transmissionCount >= 3;
  const shouldShowWeeklyReflection = !isFocusMode && transmissionCount >= 7;

  const transmissionArrivalGlow = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + arrivalPulse.value * 0.08 }],
    opacity: 0.24 + arrivalPulse.value * 0.42,
  }));

  const transmissionArrivalCore = useAnimatedStyle(() => ({
    transform: [{ scale: 0.96 + arrivalPulse.value * 0.06 }],
    opacity: 0.3 + arrivalPulse.value * 0.5,
  }));

  const transmissionArrivalSweep = useAnimatedStyle(() => ({
    transform: [{ translateX: arrivalSweep.value }, { rotate: "18deg" }],
    opacity: 0.14 + arrivalPulse.value * 0.18,
  }));

  useEffect(() => {
    if (
      !celebrateNextTransmission ||
      !state.todayTransmission ||
      state.todayTransmission.status === "generating"
    ) {
      return;
    }

    setShowTransmissionArrival(true);
    arrivalPulse.value = 0;
    arrivalSweep.value = -280;
    arrivalPulse.value = withRepeat(
      withTiming(1, {
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
      }),
      2,
      true,
    );

    arrivalSweep.value = withTiming(280, {
      duration: 1450,
      easing: Easing.out(Easing.cubic),
    });

    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const timeout = setTimeout(() => {
      setShowTransmissionArrival(false);
      setCelebrateNextTransmission(false);
    }, 1800);

    return () => clearTimeout(timeout);
  }, [
    arrivalPulse,
    arrivalSweep,
    celebrateNextTransmission,
    state.todayTransmission,
  ]);

  // Streak milestone detection
  const streakMilestones = [3, 7, 14, 30, 60, 100];
  const currentStreak = persona?.streak ?? 0;
  const isMilestone = streakMilestones.includes(currentStreak);

  useEffect(() => {
    if (isMilestone && hasTransmissionToday && !milestoneShownRef.current) {
      milestoneShownRef.current = true;
      const timer = setTimeout(() => setShowMilestone(true), 600);
      return () => clearTimeout(timer);
    }
  }, [isMilestone, hasTransmissionToday]);

  // Day 1 Welcome Voicemail: auto-trigger a free voicemail after the very first transmission.
  // Guarded by !localMode because the underlying Convex action (voicemail.native.generateNativeVoicemail)
  // calls Anthropic + ElevenLabs server-side and would break the submission's "zero bytes leave the
  // device" thesis. On-device voicemail synthesis is tracked separately; for now, local mode is
  // strictly cloud-free.
  useEffect(() => {
    if (
      !welcomeVoicemailTriggered.current &&
      !localMode &&
      hasTransmissionToday &&
      persona &&
      persona.streak === 1 &&
      state.recentTransmissions.length === 1
    ) {
      welcomeVoicemailTriggered.current = true;
      // Fire-and-forget: generate a welcome voicemail in the background
      void generateWelcomeVoicemail({ castMember: "future_self" }).catch((err: unknown) => {
        console.warn("[Day1Voicemail] Could not generate welcome voicemail:", err);
      });
    }
  }, [hasTransmissionToday, persona, state.recentTransmissions.length, generateWelcomeVoicemail, localMode]);

  // Voice unlock detection + avatar generation.
  // Avatar generation is gated by !localMode because api.face.generateAvatar calls
  // Replicate server-side. In local mode we still surface the unlock UI; we just don't
  // ship the cast member identifier off the device for image synthesis. (When QVAC ships
  // a local image-gen capability we can swap the call.)
  useEffect(() => {
    if (!state.constellation.length) return;
    const currentUnlocked = new Set(
      state.constellation
        .filter((star) => star.state === "lit" || star.state === "dim")
        .map((star) => star.castMember),
    );
    const prevUnlocked = unlockedRef.current;
    if (prevUnlocked.size === 0) {
      if (!localMode) {
        // First mount: generate avatars for any already-unlocked cast members
        // (e.g., future_self is always lit). The action is idempotent — skips if exists.
        for (const castMember of currentUnlocked) {
          void generateAvatar({ castMember: castMember as CastMember }).catch(() => {});
        }
      }
    } else {
      const newlyUnlocked = [...currentUnlocked].filter((v) => !prevUnlocked.has(v));
      if (newlyUnlocked.length > 0 && hasTransmissionToday) {
        const voice = state.constellation.find((s) => s.castMember === newlyUnlocked[0]);
        if (voice) {
          setNewlyUnlockedVoice({
            label: voice.label,
            emotionalRegister: voice.emotionalRegister,
            castMember: voice.castMember,
          });
        }
        if (!localMode) {
          // Fire-and-forget avatar generation for newly unlocked cast members
          for (const castMember of newlyUnlocked) {
            void generateAvatar({ castMember: castMember as CastMember }).catch(() => {});
          }
        }
      }
    }
    unlockedRef.current = currentUnlocked;
  }, [state.constellation, hasTransmissionToday, generateAvatar, localMode]);

  const handleShare = useCallback(async () => {
    if (!state.todayTransmission || !persona) return;
    const t = state.todayTransmission;
    const teaser = t.text.length > 160 ? `${t.text.slice(0, 157)}...` : t.text;
    const castLabel = formatCastMember(t.castMember);
    const signalLink = buildSignalLink({
      type: "transmission",
      cast: t.castMember,
      from: persona.name,
      streak: persona.streak,
      quote: teaser,
    });
    const shareText = [
      `"${teaser}"`,
      ``,
      `— ${castLabel}, Day ${persona.streak}`,
      ``,
      `My future self left me a voice message today. Hear from yours:`,
      signalLink,
    ].join("\n");

    if (Platform.OS !== "web" && shareCardRef.current) {
      // Native: capture the styled card as an image and share it
      try {
        const { captureRef } = await import("react-native-view-shot");
        const uri = await captureRef(shareCardRef, {
          format: "png",
          quality: 1,
          result: "tmpfile",
        });
        const { Share: RNShare } = await import("react-native");
        await RNShare.share({
          url: uri,
          message: shareText,
          title: `${castLabel} — Future Selves`,
        });
        setShareStatus("Shared");
      } catch {
        // Fallback to text-only if capture fails
        const { Share: RNShare } = await import("react-native");
        try {
          await RNShare.share({ message: shareText, title: `${castLabel} — Future Selves` });
          setShareStatus("Shared");
        } catch {
          setShareStatus(null);
        }
      }
    } else if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${castLabel} — Future Selves`,
          text: shareText,
        });
        setShareStatus("Shared");
      } catch {
        setShareStatus(null);
      }
    } else if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(shareText);
        setShareStatus("Copied to clipboard");
      } catch {
        setShareStatus("Could not share");
      }
    }
    if (shareStatus) setTimeout(() => setShareStatus(null), 2500);
  }, [state.todayTransmission, persona, shareStatus]);

  const handleShareMilestone = useCallback(async () => {
    const signalLink = buildSignalLink({
      type: "milestone",
      from: persona?.name,
      streak: currentStreak,
    });
    const shareText = `I've kept my Future Selves ritual going for ${currentStreak} days straight. 🔮\n\n${signalLink}`;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Future Selves Streak", text: shareText });
      } catch {
        /* cancelled */
      }
    } else if (Platform.OS === "web") {
      try { await navigator.clipboard.writeText(shareText); } catch { /* noop */ }
    } else {
      const { Share: RNShare } = await import("react-native");
      try { await RNShare.share({ message: shareText }); } catch { /* cancelled */ }
    }
  }, [currentStreak, persona?.name]);

  const handleShareVoiceUnlock = useCallback(async (voiceLabel: string, voiceCastMember?: string) => {
    const signalLink = buildSignalLink({
      type: "unlock",
      cast: voiceCastMember,
      from: persona?.name,
      streak: persona?.streak,
    });
    const shareText = `A new voice just arrived on my Future Selves line: ${voiceLabel}. ✨\n\n${signalLink}`;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Future Selves — New Voice", text: shareText }); } catch { /* cancelled */ }
    } else if (Platform.OS === "web") {
      try { await navigator.clipboard.writeText(shareText); } catch { /* noop */ }
    } else {
      const { Share: RNShare } = await import("react-native");
      try { await RNShare.share({ message: shareText }); } catch { /* cancelled */ }
    }
  }, [persona?.name, persona?.streak]);

  async function handleSaveSettings(preferences: {
    timeline: PersonaState["timeline"];
    archetype: PersonaState["archetype"];
    firstVoice: FirstVoiceCastMember;
    voicePreset: VoicePreset;
    futureChildOptIn: boolean;
    reminderEnabled: boolean;
    reminderHour: number;
  }) {
    if (!persona) return;

    try {
      setIsSavingSettings(true);
      await completeOnboarding({
        name: persona.name,
        age: persona.age,
        city: persona.city,
        currentChapter: persona.currentChapter,
        primaryArc: persona.primaryArc,
        miraculousYear: persona.miraculousYear,
        avoiding: persona.avoiding,
        afraidWontHappen: persona.afraidWontHappen,
        draining: persona.draining,
        timeline: preferences.timeline,
        archetype: preferences.archetype,
        firstVoice: preferences.firstVoice,
        voicePreset: preferences.voicePreset,
        futureChildOptIn: preferences.futureChildOptIn,
        significantDates: persona.significantDates,
      });
      await saveReminderPreferences({
        enabled: preferences.reminderEnabled,
        hour: preferences.reminderHour,
        minute: reminderPreferences.minute,
      });
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setShowSettings(false);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not save your ritual settings just now.";
      Alert.alert("Could not save settings", message);
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleSignOutFromSettings() {
    setShowSettings(false);
    await signOut();
  }

  async function handleSaveProfile(values: {
    age?: string;
    afraidWontHappen?: string;
    draining: string;
    significantDates: Array<string>;
    skinTone?: string;
    hairStyle?: string;
    distinguishing?: string;
  }) {
    if (!persona) return;

    try {
      setIsSavingProfile(true);
      await completeOnboarding({
        name: persona.name,
        age: values.age,
        city: persona.city,
        currentChapter: persona.currentChapter,
        primaryArc: persona.primaryArc,
        miraculousYear: persona.miraculousYear,
        avoiding: persona.avoiding,
        afraidWontHappen: values.afraidWontHappen ?? persona.afraidWontHappen,
        draining: values.draining,
        timeline: persona.timeline,
        archetype: persona.archetype,
        firstVoice: persona.firstVoice as FirstVoiceCastMember,
        voicePreset: inferVoicePresetFromSelectedVoice(persona.selectedVoiceName),
        futureChildOptIn: persona.futureChildOptIn,
        significantDates: values.significantDates,
        skinTone: values.skinTone,
        hairStyle: values.hairStyle,
        distinguishing: values.distinguishing,
      });
      setProfilePromptDismissed(true);
      setShowProfileSheet(false);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not save your profile just now.";
      Alert.alert("Could not save profile", message);
    } finally {
      setIsSavingProfile(false);
    }
  }

  useEffect(() => {
    if (state.openThreads.length === 0) {
      setSelectedThreadId(null);
      return;
    }

    setSelectedThreadId((current) => {
      if (
        current &&
        state.openThreads.some((thread) => thread.id === current)
      ) {
        return current;
      }
      return state.openThreads[0]?.id ?? null;
    });
  }, [state.openThreads]);

  async function handleReceive() {
    setError(null);
    const trimmedWord = word.trim();
    if (!trimmedWord) {
      setError("Give today one word first. It becomes the seed for your transmission.");
      return;
    }
    setChoiceOutcome(null);
    setCelebrateNextTransmission(true);
    setIsReceiving(true);
    // Track the local stub so we can clean it up if the on-device LLM
    // throws between beginLocalTransmission and attachLocalText.
    let startedLocalStub: Id<"transmissions"> | null = null;
    try {
      await saveCheckIn({
        dateKey,
        word: trimmedWord,
        note: note.trim() || undefined,
      });
      if (isLocalMode() && state.persona) {
        // Local path: generate text on-device, attach via internal mutation.
        startedLocalStub = await beginLocalTransmission({
          dateKey,
          castMember: forcedCastMember ?? "future_self",
        });
        // Generate the LLM text on-device.
        const generated = await generateLocalTransmission({
          personaId: state.persona.id,
          modelId: "LLAMA_3_2_1B_INST_Q4_0",
          castMember: forcedCastMember ?? "future_self",
          context: buildLocalGenerationContext(state),
          localNow: new Date().toLocaleString(),
        });
        await attachLocalText({
          transmissionId: startedLocalStub as any,
          title: generated.title,
          text: generated.text,
          actionPrompt: generated.actionPrompt,
          cliffhanger: generated.cliffhanger,
        });
      } else {
        // Cloud path: existing Convex action.
        await generateTransmission({
          dateKey,
          localNow: new Date().toLocaleString(),
          forcedCastMember: forcedCastMember ?? undefined,
        });
      }
      setForcedCastMember(null);
    } catch (caughtError) {
      // If the local path created a stub row but failed before attach,
      // delete it so the chamber doesn't show a permanent "Tuning the signal"
      // placeholder. Best-effort: a failed cleanup doesn't replace the original
      // error surfacing below.
      if (startedLocalStub) {
        try {
          await cancelLocalTransmission({ transmissionId: startedLocalStub });
        } catch {
          // Swallow — the user-facing error from caughtError is the real signal.
        }
      }
      setCelebrateNextTransmission(false);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not receive today's transmission.",
      );
    } finally {
      setIsReceiving(false);
    }
  }

  async function handleSaveTransmissionResponse(payload: {
    reaction?: "landed" | "not_quite" | "did_it" | "keep_close";
    replyNote?: string;
  }) {
    if (!state.todayTransmission) return;

    try {
      setIsSavingResponse(true);
      await saveTransmissionResponse({
        transmissionId: state.todayTransmission.id as Id<"transmissions">,
        dateKey,
        reaction: payload.reaction,
        replyNote: payload.replyNote?.trim() || undefined,
      });
      if (Platform.OS !== "web") {
        if (payload.reaction === "did_it" || payload.reaction === "keep_close") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          void Haptics.selectionAsync();
        }
      }
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not save your note back just now.";
      Alert.alert("Could not save response", message);
    } finally {
      setIsSavingResponse(false);
    }
  }

  const yesterdayTransmission = state.recentTransmissions[0];
  const showYesterdayMoment =
    !state.todayTransmission &&
    !yesterdayMomentDismissed &&
    state.yesterdayAccountability?.actionPrompt &&
    yesterdayTransmission?.id &&
    !yesterdayTransmission.response?.reaction;

  async function handleYesterdayResponse(reaction: "did_it" | "not_quite" | "keep_close") {
    if (!yesterdayTransmission?.id) return;
    try {
      setIsSavingResponse(true);
      await saveTransmissionResponse({
        transmissionId: yesterdayTransmission.id as Id<"transmissions">,
        dateKey: yesterdayTransmission.dateKey,
        reaction,
      });
      setYesterdayMomentDismissed(true);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setYesterdayMomentDismissed(true);
    } finally {
      setIsSavingResponse(false);
    }
  }

  async function handleGenerateSynthesis() {
    // Synthesis ships the 7-day transmission log + user notes to a cloud LLM via
    // convex/synthesis.ts → generateWithAI. Refuse in local mode so the submission's
    // on-device thesis holds. (A local-LLM synthesis path can land later.)
    if (localMode) {
      Alert.alert(
        "Synthesis runs in cloud mode",
        "Weekly synthesis isn't available on the local-only build yet — it would send your 7-day log to a cloud LLM.",
      );
      return;
    }
    try {
      setIsGeneratingSynthesis(true);

      const last7 = state.recentTransmissions.slice(0, 7);
      const textLog = last7.map(t => 
        `Date: ${t.dateKey}\nVoice: ${t.castMember}\nMessage: ${t.text}\nUser's Reaction: ${t.response?.reaction || 'none'}\nUser's Note: ${t.response?.replyNote || 'none'}`
      ).join("\n\n---\n\n");
      
      const weekStartDateKey = last7[last7.length - 1]?.dateKey || dateKey;

      await generateSynthesis({
        dateKey,
        weekStartDateKey,
        transmissionsText: textLog,
      });

      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      Alert.alert("Failed to synthesize", err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingSynthesis(false);
    }
  }

  async function handleChoice(choice: Choice) {
    if (!state.todayTransmission) return;

    const requiresThreadTarget =
      (choice === "repair" || choice === "release") &&
      state.openThreads.length > 0;

    if (requiresThreadTarget && !selectedThreadId) {
      setError("Choose a thread to aim that move at.");
      return;
    }

    setSelectedChoice(choice);
    setFlareColor(choiceColors[choice]);
    setShowFlare(true);
    setError(null);

    try {
      const result = await recordChoice({
        dateKey,
        choice,
        prompt: state.todayTransmission.actionPrompt,
        targetThreadId: selectedThreadId ?? undefined,
      });
      setChoiceOutcome(result.outcome);
      if (Platform.OS !== "web") await Haptics.selectionAsync();
      setTimeout(() => setShowFlare(false), 2000);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not log choice.",
      );
      setShowFlare(false);
    }
  }

  async function stageDemoCastMember(castMember: CastMember) {
    if (!isDebugMode) return;
    setError(null);
    setForcedCastMember(castMember);
    await debugSetState({ clearToday: true });
    if (Platform.OS === "web") {
      window.alert(
        `Demo voice locked: ${formatCastMember(castMember)}. Today's transmission was cleared so you can receive it now.`,
      );
    }
  }

  function openDemoVoiceMenu() {
    if (!isDebugMode) return;
    if (Platform.OS === "web") {
      const cmd = window.prompt(
        "DEBUG voice: partner | mentor | alternate | shadow | ghost | unlock",
      );
      if (cmd === "partner") void stageDemoCastMember("future_partner");
      if (cmd === "mentor") void stageDemoCastMember("future_mentor");
      if (cmd === "alternate") void stageDemoCastMember("alternate_self");
      if (cmd === "shadow") void stageDemoCastMember("shadow");
      if (cmd === "ghost") void stageDemoCastMember("the_ghost");
      if (cmd === "unlock") setForcedCastMember(null);
      return;
    }

    Alert.alert(
      "Demo Voices",
      "Lock the next transmission to a showcase voice",
      [
        ...demoCastOptions.map((option) => ({
          text: option.label,
          onPress: () => void stageDemoCastMember(option.castMember),
        })),
        ...(forcedCastMember
          ? [
              {
                text: "Release Demo Lock",
                onPress: () => setForcedCastMember(null),
              },
            ]
          : []),
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  function handleDebugTap() {
    if (!isDebugMode) return;
    const newCount = debugTapCount + 1;
    if (newCount >= 3) {
      setDebugTapCount(0);
      if (Platform.OS === "web") {
        const cmd = window.prompt(
          "DEBUG: reset | streak | shadow | clear | voices",
        );
        if (cmd === "reset") debugReset();
        if (cmd === "streak") debugSetState({ streak: 30 });
        if (cmd === "shadow") debugSetState({ divergence: 6 });
        if (cmd === "clear") debugSetState({ clearToday: true });
        if (cmd === "voices") openDemoVoiceMenu();
      } else {
        Alert.alert("Debug Menu", "Stage the demo recording", [
          { text: "Reset Persona", onPress: () => debugReset() },
          {
            text: "Force 30-Day Streak",
            onPress: () => debugSetState({ streak: 30 }),
          },
          {
            text: "Force Shadow Mode",
            onPress: () => debugSetState({ divergence: 6 }),
          },
          {
            text: "Stage Demo Voice",
            onPress: openDemoVoiceMenu,
          },
          {
            text: "Clear Today",
            onPress: () => debugSetState({ clearToday: true }),
          },
          { text: "Cancel", style: "cancel" },
        ]);
      }
    } else {
      setDebugTapCount(newCount);
      setTimeout(() => setDebugTapCount(0), 2000);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Memory readout chip — only visible on native + local mode */}
      <MemoryReadout />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <HeroSection
          divergenceLabel={persona ? getDivergenceLabel(persona.timelineDivergenceScore) : "steady"}
          divergenceScore={persona?.timelineDivergenceScore ?? 0}
          forcedCastMember={forcedCastMember}
          hasTransmissionToday={hasTransmissionToday}
          isDebugMode={isDebugMode}
          onDebugTap={handleDebugTap}
          onOpenSettings={() => setShowSettings(true)}
          onOpenVoicemail={() => router.push("/voicemail" as any)}
          persona={persona}
          shouldShowSystemDepth={shouldShowSystemDepth}
        />

        <SessionArc
          hasCheckIn={Boolean(state.todayCheckIn)}
          hasChoice={Boolean(choiceOutcome)}
          hasTransmission={hasTransmissionToday}
        />

        {!hasTransmissionToday ? <EveningUrgencyBanner /> : null}

        {state.todayTransmission ? (
          <TransmissionSection
            isSavingResponse={isSavingResponse}
            onSaveResponse={handleSaveTransmissionResponse}
            onShare={handleShare}
            shareStatus={shareStatus}
            showTransmissionArrival={showTransmissionArrival}
            transmission={state.todayTransmission}
            yesterdayAccountability={state.yesterdayAccountability}
            transmissionArrivalCoreStyle={transmissionArrivalCore}
            transmissionArrivalGlowStyle={transmissionArrivalGlow}
            transmissionArrivalSweepStyle={transmissionArrivalSweep}
          />
        ) : showYesterdayMoment ? (
          <YesterdayMoment
            actionPrompt={state.yesterdayAccountability!.actionPrompt}
            isResponding={isSavingResponse}
            onDismiss={() => setYesterdayMomentDismissed(true)}
            onRespond={handleYesterdayResponse}
          />
        ) : (
          <ReceiveSignalSection
            isReceiving={isReceiving}
            note={note}
            noteNudges={noteNudges}
            onNoteChange={setNote}
            onReceive={handleReceive}
            onToggleDetail={() => setShowDetailInput((current) => !current)}
            onWordChange={setWord}
            showDetailInput={showDetailInput}
            word={word}
            wordNudges={wordNudges}
            yesterdayCliffhanger={state.recentTransmissions[0]?.cliffhanger}
            onSpeakWord={(w) => setWord(w.toLowerCase())}
            isSpeaking={speech.isRecording || speech.isTranscribing}
            onStartSpeak={speech.startRecording}
            onStopSpeak={speech.stopRecording}
            speakDuration={speech.durationSeconds}
          />
        )}

        {state.todayTransmission ? (
          <ChoiceSection
            actionNudges={actionNudges}
            choiceCopy={choiceCopy}
            choiceOutcome={choiceOutcome}
            divergenceScore={persona?.timelineDivergenceScore ?? 0}
            onChoice={handleChoice}
            onSelectThread={setSelectedThreadId}
            openThreads={state.openThreads}
            selectedChoice={selectedChoice}
            selectedThreadId={selectedThreadId}
            shouldShowStoryDepth={shouldShowStoryDepth}
            shouldShowSystemDepth={shouldShowSystemDepth}
            transmission={state.todayTransmission}
          />
        ) : null}

        {shouldShowRefinementPrompt ? (
          <RitualRefinementPrompt onOpenSettings={() => setShowSettings(true)} />
        ) : null}

        {shouldShowProfilePrompt ? (
          <RitualRefinementPrompt
            body="A few extra details make later transmissions feel more grounded. Add what's draining you, the future you almost don't let yourself want, plus one date worth remembering."
            buttonLabel="Complete your profile"
            onOpenSettings={() => setShowProfileSheet(true)}
            title="Ready to deepen the line?"
          />
        ) : null}

        {shouldShowWeeklyReflection ? (
          <WeeklyReflectionSection
            persona={persona}
            transmissions={state.recentTransmissions}
            currentSynthesis={state.currentSynthesis}
            isGeneratingSynthesis={isGeneratingSynthesis}
            onGenerateSynthesis={handleGenerateSynthesis}
          />
        ) : null}

        {shouldShowSystemDepth && persona ? (
          <RitualState
            persona={persona}
            recentChoices={(
              (state as unknown as {
                recentChoices?: Array<{ choice: Choice; dateKey: string }>;
              }).recentChoices ?? []
            ).slice(0, 7)}
          />
        ) : null}

        <ProgressionSection
          constellation={state.constellation}
          divergenceScore={persona?.timelineDivergenceScore ?? 0}
          nextUnlock={nextUnlock}
          shouldShowStoryDepth={shouldShowStoryDepth}
          shouldShowSystemDepth={shouldShowSystemDepth}
          systemSignals={state.systemSignals}
        />

        {shouldShowStoryDepth ? (
          <StorySection
            description="Lines your next transmissions can tug on."
            items={state.openThreads.map((thread) => ({
              id: thread.id,
              castMember: thread.castMember,
              title: thread.title,
              body: thread.seed,
            }))}
            title="Open threads"
          />
        ) : null}

        {shouldShowStoryDepth ? (
          <View style={styles.memoryArchiveEntryRow}>
            <Text style={styles.memoryArchiveEntryCopy}>
              Pin transmissions and revisit recent lines in one place.
            </Text>
            <Pressable
              onPress={() => router.push("./archive")}
              style={({ pressed }) => [styles.memoryArchiveEntryButton, pressed && styles.pressed]}
            >
              <Text style={styles.memoryArchiveEntryButtonText}>Open archive</Text>
              <Ionicons name="arrow-forward-outline" size={14} color="#101320" />
            </Pressable>
          </View>
        ) : null}

        {shouldShowStoryDepth ? (
          <MemoryArchiveSection
            expandedByDefault
            filter={archiveFilter}
            onFilterChange={setArchiveFilter}
            onOpenArchive={() => router.push("./archive")}
            onTogglePin={togglePinnedSignal}
            pinnedSignalIds={pinnedSignalIds}
            showHeaderCta
            transmissions={homeMemoryTransmissions}
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <MilestoneOverlay
        currentStreak={currentStreak}
        onDismiss={() => setShowMilestone(false)}
        onShare={handleShareMilestone}
        visible={showMilestone}
      />
      <VoiceUnlockOverlay
        voice={newlyUnlockedVoice}
        onDismiss={() => setNewlyUnlockedVoice(null)}
        onShare={(voiceLabel) => handleShareVoiceUnlock(voiceLabel, newlyUnlockedVoice?.castMember)}
      />
      <FlareOverlay flareColor={flareColor} visible={showFlare} />
      <FutureselfSettingsSheet
        isSaving={isSavingSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
        onSignOut={handleSignOutFromSettings}
        persona={persona}
        reminderPreferences={reminderPreferences}
        visible={showSettings}
      />
      <FutureselfProfileSheet
        isSaving={isSavingProfile}
        onClose={() => {
          setShowProfileSheet(false);
          setProfilePromptDismissed(true);
        }}
        onSave={handleSaveProfile}
        persona={persona}
        visible={showProfileSheet}
      />

      {/* Off-screen share card for native image capture */}
      {state.todayTransmission && persona && Platform.OS !== "web" ? (
        <View style={{ position: "absolute", left: -9999, top: -9999 }}>
          <TransmissionShareCard
            ref={shareCardRef}
            text={state.todayTransmission.text}
            castMember={state.todayTransmission.castMember}
            streak={persona.streak}
            title={state.todayTransmission.title}
          />
        </View>
      ) : null}

      <BottomNav />
    </View>
  );
}

function getDivergenceLabel(score: number): string {
  if (score >= 5) return "shadow close";
  if (score >= 3) return "flickering";
  if (score >= 1) return "slight drift";
  return "steady line";
}

function getNextUnlock(
  persona: PersonaState,
  constellation: Array<ConstellationStar>,
) {
  const candidate = constellation.find(
    (star) => star.state === "locked" || star.state === "quiet",
  );
  if (!candidate) return null;

  const requirement =
    candidate.castMember === "shadow" && persona.timelineDivergenceScore < 4
      ? "Let the line drift a little more before this voice appears."
      : candidate.unlockHint;

  return {
    label: candidate.label,
    requirement,
    emotionalRegister: candidate.emotionalRegister,
    castMember: candidate.castMember,
  };
}

/**
 * Build the LLM generation context for the local QVAC path.
 * Mirrors the shape used by `packages/backend/convex/game.transmission.ts`
 * but reads from the React `GameState` instead of running a Convex query.
 */
function buildLocalGenerationContext(state: GameState) {
  const persona = state.persona!;
  const checkInWord = state.todayCheckIn?.word;
  const checkInNote = state.todayCheckIn?.note;
  return {
    persona: {
      name: persona.name,
      city: persona.city,
      currentChapter: persona.currentChapter,
      primaryArc: persona.primaryArc,
      miraculousYear: persona.miraculousYear,
      avoiding: persona.avoiding,
      afraidWontHappen: persona.afraidWontHappen,
      draining: persona.draining,
      streak: persona.streak,
      timelineDivergenceScore: persona.timelineDivergenceScore,
      towardCount: persona.towardCount,
      steadyCount: persona.steadyCount,
      releaseCount: persona.releaseCount,
      repairCount: persona.repairCount,
      selectedVoiceName: persona.selectedVoiceName,
      selectedVoiceDescription: persona.selectedVoiceDescription,
    },
    checkIn:
      checkInWord !== undefined ? { word: checkInWord, note: checkInNote } : null,
    recentTransmissions: state.recentTransmissions.slice(0, 5).map((t) => ({
      dateKey: t.dateKey,
      title: t.title,
      cliffhanger: t.cliffhanger,
    })),
    recentChoices: ((state as unknown as { recentChoices?: Array<{ choice: Choice }> }).recentChoices ?? [])
      .slice(0, 10)
      .map((c) => ({
        dateKey: tDateKeyFallback(c),
        choice: c.choice,
        prompt: "",
      })),
    recentResponses: state.recentTransmissions.slice(0, 5).map((t) => ({
      reaction: t.response?.reaction,
      replyNote: t.response?.replyNote,
    })),
    openThreads: state.openThreads.map((th) => ({
      title: th.title,
      seed: th.seed,
      castMember: th.castMember,
    })),
  };
}

function tDateKeyFallback(_c: { choice: string }): string {
  // The lightweight `state.recentChoices` shape only carries the
  // choice, not the date. Use today as a stable fallback for prompt
  // accounting purposes — the LLM doesn't strictly need the per-day
  // date to produce a coherent accountability block.
  return new Date().toISOString().split("T")[0]!;
}
