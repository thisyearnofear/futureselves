import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAudioPlayer } from "expo-audio";
import Animated, {
  FadeInUp,
  SlideInRight,
  SlideOutLeft,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { OnboardingDraft } from "@/lib/futureself";
import {
  arcLabels,
  arcValues,
  firstVoiceCastMembers,
  firstVoiceLabels,
} from "@/lib/futureself";

const bgAudio = require("@/assets/audio/spacious-hum.mp3");

// Fallback avatars for the voice-picker morph (bundled, no Convex needed)
const VOICE_AVATARS: Record<string, number> = {
  future_self: require("@/assets/images/avatars/future_self.webp"),
  future_partner: require("@/assets/images/avatars/future_partner.webp"),
  future_mentor: require("@/assets/images/avatars/future_mentor.webp"),
};

const initialDraft: OnboardingDraft = {
  name: "",
  age: "",
  city: "",
  currentChapter: "",
  primaryArc: "purpose",
  miraculousYear: "",
  avoiding: "",
  afraidWontHappen: "",
  draining: "",
  timeline: "5_years",
  archetype: "wise",
  firstVoice: "future_self",
  voicePreset: "ember",
  futureChildOptIn: false,
  significantDates: [],
  skinTone: "",
  hairStyle: "",
  distinguishing: "",
};

// Suggestion prompts — tapping one fills the field and auto-advances,
// making suggestions the primary path (not typing).
const chapterNudges = {
  currentChapter: [
    "I'm rebuilding after a change.",
    "I'm circling a decision I keep postponing.",
    "I'm ready for a bigger life, but moving carefully.",
  ],
  miraculousYear: [
    "I trust myself again and my days feel lighter.",
    "My work has more meaning, more momentum, and more room to breathe.",
    "The relationship I want feels honest, mutual, and safe.",
  ],
  avoiding: [
    "The conversation I know would change the room.",
    "The first public step because it makes the dream real.",
    "Admitting what I actually want before I know how to get it.",
  ],
};

// ── Step definitions: each step is one field, one screen ──
interface Step {
  id: string;
  title: string;
  subtitle: string;
  field?: keyof OnboardingDraft;
  type: "text" | "tap" | "voice";
  placeholder?: string;
  multiline?: boolean;
  suggestions?: string[];
}

const STEPS: Step[] = [
  {
    id: "name",
    title: "Someone is trying to reach you.",
    subtitle: "Give it just enough to recognize you.",
    field: "name",
    type: "text",
    placeholder: "Your name",
  },
  {
    id: "city",
    title: "Where are you right now?",
    subtitle: "A city is enough. The voice works with coordinates.",
    field: "city",
    type: "text",
    placeholder: "City",
  },
  {
    id: "chapter",
    title: "What scene are you living through?",
    subtitle: "Tap one, or write your own.",
    field: "currentChapter",
    type: "tap",
    multiline: true,
    placeholder: "A transition, a rebuild, a quiet beginning...",
    suggestions: chapterNudges.currentChapter,
  },
  {
    id: "arc",
    title: "What's the gravitational pull?",
    subtitle: "The direction that matters most right now.",
    type: "tap",
  },
  {
    id: "miraculous",
    title: "If a year from now worked, what would be different?",
    subtitle: "Tap one, or write your own.",
    field: "miraculousYear",
    type: "tap",
    multiline: true,
    placeholder: "The sentence your future would be proud to say.",
    suggestions: chapterNudges.miraculousYear,
  },
  {
    id: "avoiding",
    title: "What door are you not opening?",
    subtitle: "Name it gently.",
    field: "avoiding",
    type: "tap",
    multiline: true,
    placeholder: "The thing you keep sidestepping.",
    suggestions: chapterNudges.avoiding,
  },
  {
    id: "voice",
    title: "Choose your first voice.",
    subtitle: "Start simple. Refine after your first transmission.",
    type: "voice",
  },
];

interface OnboardingFlowProps {
  onCompleted?: () => void;
}

export function OnboardingFlow({ onCompleted }: OnboardingFlowProps) {
  const completeOnboarding = useMutation(api.game.completeOnboarding);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Background atmospheric audio
  const player = useAudioPlayer(bgAudio);
  useEffect(() => {
    player.loop = true;
    player.play();
    return () => player.pause();
  }, [player]);

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;
  const canGoBack = stepIndex > 0 && !isSubmitting;

  const moveBack = useCallback(async () => {
    if (!canGoBack) return;
    setError(null);
    if (Platform.OS !== "web") await Haptics.selectionAsync();
    setStepIndex((c) => Math.max(0, c - 1));
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      setError(null);
      setStepIndex((c) => Math.max(0, c - 1));
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  function updateDraft<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) {
    setDraft((c) => ({ ...c, [key]: value }));
  }

  function canContinue(): boolean {
    if (!step.field) return true;
    const val = draft[step.field];
    return Boolean(typeof val === "string" && val.trim());
  }

  async function moveNext() {
    setError(null);
    if (!canContinue()) {
      setError("One more line before you turn the page.");
      return;
    }
    Keyboard.dismiss();
    if (Platform.OS !== "web") await Haptics.selectionAsync();
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((c) => c + 1);
      return;
    }
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        ...draft,
        age: draft.age.trim() || undefined,
        afraidWontHappen: "",
        draining: "",
        significantDates: draft.significantDates.filter(Boolean),
        skinTone: undefined,
        hairStyle: undefined,
        distinguishing: undefined,
      });
      onCompleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Progress orb: morphs color as you advance ──
  const orbColors = ["#F7D38B", "#F7D38B", "#E8C87A", "#D4A017", "#D4A017", "#B8860B", "#7850A0"];
  const orbColor = orbColors[Math.min(stepIndex, orbColors.length - 1)]!;
  const progress = useSharedValue(stepIndex / (STEPS.length - 1));
  useEffect(() => {
    progress.value = withTiming(stepIndex / (STEPS.length - 1), { duration: 600, easing: Easing.out(Easing.quad) });
  }, [stepIndex]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [12, 100], Extrapolation.CLAMP)}%`,
    backgroundColor: orbColor,
  }));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      {/* ── Progress bar (morphing orb) ── */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
        <Text style={styles.progressCount}>{stepIndex + 1} / {STEPS.length}</Text>
      </View>

      {/* ── Step content with sliding transition ── */}
      <View style={styles.contentArea}>
        <Animated.View
          key={step.id}
          entering={Platform.OS === "web" ? undefined : SlideInRight.duration(400).springify().damping(22)}
          exiting={Platform.OS === "web" ? undefined : SlideOutLeft.duration(300)}
          layout={Platform.OS === "web" ? undefined : LinearTransition.springify().damping(18)}
          style={styles.stepContainer}
        >
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.subtitle}>{step.subtitle}</Text>

          {step.type === "text" && step.field ? (
            <TextInput
              style={styles.input}
              placeholder={step.placeholder}
              placeholderTextColor="#6F7591"
              value={draft[step.field] as string}
              onChangeText={(v) => updateDraft(step.field!, v)}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={moveNext}
            />
          ) : null}

          {step.type === "tap" && step.id === "arc" ? (
            <View style={styles.arcGrid}>
              {arcValues.map((arc) => (
                <Pressable
                  key={arc}
                  onPress={() => {
                    updateDraft("primaryArc", arc);
                    if (Platform.OS !== "web") void Haptics.selectionAsync();
                  }}
                  style={[styles.arcCard, draft.primaryArc === arc && styles.arcCardActive]}
                >
                  <Ionicons
                    name={arc === "money" ? "cash-outline" : arc === "love" ? "heart-outline" : arc === "purpose" ? "compass-outline" : "fitness-outline"}
                    size={22}
                    color={draft.primaryArc === arc ? "#101320" : "#F7D38B"}
                  />
                  <Text style={[styles.arcLabel, draft.primaryArc === arc && styles.arcLabelActive]}>
                    {arcLabels[arc]}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step.type === "tap" && step.field && step.suggestions ? (
            <View style={styles.suggestionStack}>
              {step.suggestions.map((sug, i) => {
                const isSelected = draft[step.field!] === sug;
                return (
                  <Pressable
                    key={sug}
                    onPress={() => {
                      updateDraft(step.field!, sug);
                      if (Platform.OS !== "web") void Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      styles.suggestionCard,
                      isSelected && styles.suggestionCardActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>
                      {sug}
                    </Text>
                  </Pressable>
                );
              })}
              <View style={styles.ownRow}>
                <TextInput
                  style={styles.ownInput}
                  placeholder="Or write your own…"
                  placeholderTextColor="#6F7591"
                  value={(draft[step.field!] as string) || ""}
                  onChangeText={(v) => updateDraft(step.field!, v)}
                  multiline={step.multiline}
                />
              </View>
            </View>
          ) : null}

          {step.type === "voice" ? (
            <VoicePicker
              selected={draft.firstVoice}
              onSelect={(v) => {
                updateDraft("firstVoice", v);
                if (Platform.OS !== "web") void Haptics.selectionAsync();
              }}
            />
          ) : null}
        </Animated.View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* ── Footer ── */}
      <View style={styles.footerRow}>
        <Pressable
          disabled={!canGoBack}
          onPress={moveBack}
          style={({ pressed }) => [styles.backButton, !canGoBack && styles.backDisabled, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={18} color={canGoBack ? "#C5CCE6" : "#626A83"} />
          <Text style={[styles.backText, !canGoBack && styles.backTextDisabled]}>Back</Text>
        </Pressable>
        <Pressable
          disabled={isSubmitting}
          onPress={moveNext}
          style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#101320" />
          ) : (
            <Text style={styles.nextText}>
              {isLast ? "Receive first transmission" : "Continue"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Voice picker: morphing avatar crossfade between the 3 first voices ──

interface VoicePickerProps {
  selected: string;
  onSelect: (voice: string) => void;
}

function VoicePicker({ selected, onSelect }: VoicePickerProps) {
  const selectedIndex = firstVoiceCastMembers.indexOf(selected as any);
  const morphProgress = useSharedValue(selectedIndex);

  useEffect(() => {
    morphProgress.value = withTiming(selectedIndex, { duration: 600, easing: Easing.out(Easing.quad) });
  }, [selectedIndex]);

  return (
    <View style={styles.voicePickerWrap}>
      {/* Morphing avatar preview */}
      <View style={styles.voiceAvatarWrap}>
        {firstVoiceCastMembers.map((voice, index) => {
          const animatedStyle = useAnimatedStyle(() => {
            const distance = Math.abs(morphProgress.value - index);
            const opacity = interpolate(distance, [0, 0.8], [1, 0], Extrapolation.CLAMP);
            const scale = interpolate(distance, [0, 0.8], [1, 0.92], Extrapolation.CLAMP);
            return { opacity, transform: [{ scale }] };
          });
          const src = VOICE_AVATARS[voice];
          return (
            <Animated.View key={voice} style={[styles.voiceAvatarLayer, animatedStyle]}>
              <Image source={src} style={styles.voiceAvatar} contentFit="cover" />
            </Animated.View>
          );
        })}
      </View>

      {/* Voice selection cards */}
      <View style={styles.voiceGrid}>
        {firstVoiceCastMembers.map((voice) => (
          <Pressable
            key={voice}
            onPress={() => onSelect(voice)}
            style={({ pressed }) => [
              styles.voiceCard,
              selected === voice && styles.voiceCardActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.voiceLabel, selected === voice && styles.voiceLabelActive]}>
              {firstVoiceLabels[voice]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 16,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressCount: {
    color: "#8F96B4",
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  contentArea: {
    flex: 1,
    justifyContent: "center",
  },
  stepContainer: {
    alignItems: "center",
    gap: 14,
  },
  title: {
    color: "#F8F0DE",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 34,
    textAlign: "center",
  },
  subtitle: {
    color: "#AEB6D4",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    maxWidth: 440,
    minHeight: 52,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    color: "#F8F0DE",
    fontSize: 16,
    paddingHorizontal: 16,
  },
  arcGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    maxWidth: 440,
    justifyContent: "center",
  },
  arcCard: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  arcCardActive: {
    backgroundColor: "rgba(247,211,139,0.18)",
    borderColor: "rgba(247,211,139,0.45)",
  },
  arcLabel: {
    color: "#AEB6D4",
    fontSize: 13,
    fontWeight: "800",
  },
  arcLabelActive: {
    color: "#F7D38B",
  },
  suggestionStack: {
    width: "100%",
    maxWidth: 440,
    gap: 10,
  },
  suggestionCard: {
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(247,211,139,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.14)",
  },
  suggestionCardActive: {
    backgroundColor: "rgba(247,211,139,0.2)",
    borderColor: "rgba(247,211,139,0.5)",
  },
  suggestionText: {
    color: "#D7DCEE",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  suggestionTextActive: {
    color: "#F7D38B",
    fontWeight: "800",
  },
  ownRow: {
    marginTop: 4,
  },
  ownInput: {
    minHeight: 48,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#F8F0DE",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  voicePickerWrap: {
    alignItems: "center",
    gap: 20,
  },
  voiceAvatarWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceAvatarLayer: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: "hidden",
  },
  voiceAvatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  voiceGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  voiceCard: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  voiceCardActive: {
    backgroundColor: "rgba(247,211,139,0.18)",
    borderColor: "rgba(247,211,139,0.45)",
  },
  voiceLabel: {
    color: "#AEB6D4",
    fontSize: 13,
    fontWeight: "800",
  },
  voiceLabelActive: {
    color: "#F7D38B",
  },
  footerRow: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 4,
  },
  backButton: {
    width: 88,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  backDisabled: {
    opacity: 0.4,
  },
  backText: {
    color: "#C5CCE6",
    fontWeight: "900",
  },
  backTextDisabled: {
    color: "#626A83",
  },
  nextButton: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "#F7D38B",
  },
  nextText: {
    color: "#101320",
    fontSize: 16,
    fontWeight: "900",
  },
  error: {
    color: "#FF9A9A",
    fontSize: 13,
    textAlign: "center",
    paddingBottom: 4,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
