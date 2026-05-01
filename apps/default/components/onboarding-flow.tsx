import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, LinearTransition } from "react-native-reanimated";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type {
  Arc,
  Archetype,
  FirstVoiceCastMember,
  OnboardingDraft,
  Timeline,
} from "@/lib/futureself";
import {
  archetypeLabels,
  archetypeValues,
  arcLabels,
  arcValues,
  firstVoiceCastMembers,
  firstVoiceLabels,
  timelineLabels,
  timelineValues,
} from "@/lib/futureself";

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
};

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
  afraidWontHappen: [
    "A life that feels spacious instead of constantly defended.",
    "Being chosen without having to perform for it.",
    "Building something that makes me proud and free.",
  ],
};

interface OnboardingFlowProps {
  onCompleted?: () => void;
}

export function OnboardingFlow({ onCompleted }: OnboardingFlowProps) {
  const completeOnboarding = useMutation(api.game.completeOnboarding);
  const [chapter, setChapter] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chapters = useMemo(
    () => ["The knock", "The pull", "The shadow", "The timeline", "The voice"],
    [],
  );

  const canGoBack = chapter > 0 && !isSubmitting;

  const moveBack = useCallback(async () => {
    if (!canGoBack) return;
    setError(null);
    if (Platform.OS !== "web") await Haptics.selectionAsync();
    setChapter((current) => Math.max(0, current - 1));
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!canGoBack) return false;
        setError(null);
        setChapter((current) => Math.max(0, current - 1));
        return true;
      },
    );
    return () => subscription.remove();
  }, [canGoBack]);

  function updateDraft<K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function canContinue(): boolean {
    if (chapter === 0) {
      return Boolean(
        draft.name.trim() && draft.city.trim() && draft.currentChapter.trim(),
      );
    }
    if (chapter === 1) return Boolean(draft.miraculousYear.trim());
    if (chapter === 2)
      return Boolean(draft.avoiding.trim() && draft.afraidWontHappen.trim());
    return true;
  }

  async function moveNext() {
    setError(null);
    if (!canContinue()) {
      setError(
        "The scene needs one more honest line before you turn the page.",
      );
      return;
    }
    if (Platform.OS !== "web") await Haptics.selectionAsync();
    if (chapter < chapters.length - 1) {
      setChapter((current) => current + 1);
      return;
    }
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        ...draft,
        age: draft.age.trim() || undefined,
        significantDates: draft.significantDates.filter(Boolean),
      });
      onCompleted?.();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save onboarding.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressRow}>
          {chapters.map((label, index) => (
            <View
              key={label}
              style={[
                styles.progressDot,
                index <= chapter && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        <Text style={styles.eyebrow}>
          Prologue {chapter + 1} / {chapters.length} — {chapters[chapter]}
        </Text>
        <Text style={styles.title}>{getChapterTitle(chapter)}</Text>
        <Text style={styles.subtitle}>{getChapterSubtitle(chapter)}</Text>

        <View style={styles.panelHint}>
          <Text style={styles.panelHintText}>
            One question at a time. Keep it honest, not polished.
          </Text>
        </View>

        <Animated.View
          key={chapter}
          entering={Platform.OS === "web" ? undefined : FadeInUp.duration(220)}
          layout={
            Platform.OS === "web"
              ? undefined
              : LinearTransition.springify().damping(18)
          }
          style={styles.panel}
        >
          {renderChapter(chapter, draft, updateDraft)}
        </Animated.View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            disabled={!canGoBack}
            onPress={moveBack}
            style={({ pressed }) => [
              styles.secondaryButton,
              !canGoBack && styles.secondaryButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={17}
              color={canGoBack ? "#C5CCE6" : "#626A83"}
            />
            <Text
              style={[
                styles.secondaryText,
                !canGoBack && styles.secondaryTextDisabled,
              ]}
            >
              Back
            </Text>
          </Pressable>
          <Pressable
            disabled={isSubmitting}
            onPress={moveNext}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#101320" />
            ) : (
              <Text style={styles.primaryText}>
                {chapter === chapters.length - 1
                  ? "Receive first signal"
                  : "Turn the page"}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function renderChapter(
  chapter: number,
  draft: OnboardingDraft,
  updateDraft: <K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K],
  ) => void,
) {
  if (chapter === 0) {
    return (
      <View style={styles.formStack}>
        <Field
          label="What name should the voice use?"
          value={draft.name}
          onChangeText={(value) => updateDraft("name", value)}
          placeholder="Your name"
        />
        <Field
          label="Where is the signal finding you?"
          value={draft.city}
          onChangeText={(value) => updateDraft("city", value)}
          placeholder="City"
        />
        <Field
          label="What scene are you living through right now?"
          multiline
          value={draft.currentChapter}
          onChangeText={(value) => updateDraft("currentChapter", value)}
          placeholder="A transition, a rebuild, a quiet beginning..."
          suggestions={chapterNudges.currentChapter}
        />
      </View>
    );
  }
  if (chapter === 1) {
    return (
      <View style={styles.formStack}>
        <Text style={styles.optionLabel}>The gravitational pull</Text>
        <ChipGrid
          values={arcValues}
          selected={draft.primaryArc}
          labels={arcLabels}
          onSelect={(value) => updateDraft("primaryArc", value)}
        />
        <Field
          label="If a year from now worked, what would be different?"
          multiline
          value={draft.miraculousYear}
          onChangeText={(value) => updateDraft("miraculousYear", value)}
          placeholder="The sentence your future self would be proud to say."
          suggestions={chapterNudges.miraculousYear}
        />
      </View>
    );
  }
  if (chapter === 2) {
    return (
      <View style={styles.formStack}>
        <Field
          label="What door are you not opening?"
          multiline
          value={draft.avoiding}
          onChangeText={(value) => updateDraft("avoiding", value)}
          placeholder="Name it gently. No confession booth energy."
          suggestions={chapterNudges.avoiding}
        />
        <Field
          label="What future do you almost not let yourself want?"
          multiline
          value={draft.afraidWontHappen}
          onChangeText={(value) => updateDraft("afraidWontHappen", value)}
          placeholder="The hope under the practical answers."
          suggestions={chapterNudges.afraidWontHappen}
        />
      </View>
    );
  }
  if (chapter === 3) {
    return (
      <View style={styles.formStack}>
        <Text style={styles.optionLabel}>Choose your timeline</Text>
        <ChipGrid
          values={timelineValues}
          selected={draft.timeline}
          labels={timelineLabels}
          onSelect={(value) => updateDraft("timeline", value)}
        />
        <Text style={styles.optionLabel}>Choose your archetype</Text>
        <ChipGrid
          values={archetypeValues}
          selected={draft.archetype}
          labels={archetypeLabels}
          onSelect={(value) => updateDraft("archetype", value)}
        />
        <Text style={styles.optionLabel}>First voice</Text>
        <ChipGrid
          values={firstVoiceCastMembers}
          selected={draft.firstVoice}
          labels={firstVoiceLabels}
          onSelect={(value) => updateDraft("firstVoice", value)}
        />
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>
              Let Future Child exist someday
            </Text>
            <Text style={styles.switchText}>
              Rare, opt-in, and never used casually.
            </Text>
          </View>
          <Switch
            value={draft.futureChildOptIn}
            onValueChange={(value) => updateDraft("futureChildOptIn", value)}
          />
        </View>
      </View>
    );
  }
  if (chapter === 4) {
    return (
      <View style={styles.formStack}>
        <Text style={styles.optionLabel}>Choose the voice that returns</Text>
        <View style={styles.voiceSelectionRow}>
          <VoiceChoice
            active={draft.voicePreset === "ember"}
            description="Warm, close, certain. The voice that sounds like a hand on your shoulder."
            name="Ember"
            onPress={() => updateDraft("voicePreset", "ember")}
          />
          <VoiceChoice
            active={draft.voicePreset === "atlas"}
            description="Grounded and older. Slow enough that the room changes around each sentence."
            name="Atlas"
            onPress={() => updateDraft("voicePreset", "atlas")}
          />
          <VoiceChoice
            active={draft.voicePreset === "sol"}
            description="Soft, bright, quietly prophetic. The signal before dawn."
            name="Sol"
            onPress={() => updateDraft("voicePreset", "sol")}
          />
        </View>
      </View>
    );
  }
  return null;
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  suggestions?: Array<string>;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  suggestions = [],
}: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6F7591"
        style={[styles.input, multiline && styles.inputMultiline]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
      {suggestions.length > 0 ? (
        <SuggestionRow suggestions={suggestions} onSelect={onChangeText} />
      ) : null}
    </View>
  );
}

interface SuggestionRowProps {
  suggestions: Array<string>;
  onSelect: (value: string) => void;
}

function SuggestionRow({ suggestions, onSelect }: SuggestionRowProps) {
  return (
    <View style={styles.suggestionRow}>
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPress={() => {
            onSelect(suggestion);
            if (Platform.OS !== "web") void Haptics.selectionAsync();
          }}
          style={({ pressed }) => [
            styles.suggestionChip,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.suggestionText}>{suggestion}</Text>
        </Pressable>
      ))}
    </View>
  );
}

interface ChipGridProps<T extends string> {
  values: ReadonlyArray<T>;
  selected: T;
  labels: Record<T, string>;
  onSelect: (value: T) => void;
}

function ChipGrid<T extends string>({
  values,
  selected,
  labels,
  onSelect,
}: ChipGridProps<T>) {
  return (
    <View style={styles.chipGrid}>
      {values.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          style={[styles.chip, selected === value && styles.chipActive]}
        >
          <Text
            style={[
              styles.chipText,
              selected === value && styles.chipTextActive,
            ]}
          >
            {labels[value]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

interface VoiceChoiceProps {
  name: string;
  description: string;
  active: boolean;
  onPress: () => void;
}

function VoiceChoice({ name, description, active, onPress }: VoiceChoiceProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.voiceCard, active && styles.voiceCardActive]}
    >
      <View style={styles.voiceIcon}>
        <Ionicons
          name="radio"
          size={18}
          color={active ? "#101320" : "#F7D38B"}
        />
      </View>
      <View style={styles.voiceCopy}>
        <Text style={styles.voiceName}>{name}</Text>
        <Text style={styles.voiceDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

function getChapterTitle(chapter: number): string {
  const titles = [
    "Someone has been trying to reach you.",
    "Tell the signal what you're pulling toward.",
    "Every good story has a locked room.",
    "Set the distance of the echo.",
    "Choose the voice that returns.",
  ];
  return titles[chapter];
}

function getChapterSubtitle(chapter: number): string {
  const subtitles = [
    "A transmission cannot find a stranger. Give it just enough texture to recognize you.",
    "Name the life-force the signal should organize itself around.",
    "The shadow is not punishment. It is the part of the story that makes the voice feel real.",
    "Your future self can stand close enough to be practical or far enough to feel mythic.",
    "This becomes the voice of your first transmission. If audio is configured, ElevenLabs speaks it. If not, the signal still arrives in text.",
  ];
  return subtitles[chapter];
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  progressRow: {
    width: "100%",
    maxWidth: 680,
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  progressDotActive: {
    backgroundColor: "#F7D38B",
  },
  eyebrow: {
    width: "100%",
    maxWidth: 680,
    color: "#F7D38B",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  title: {
    width: "100%",
    maxWidth: 680,
    color: "#F8F0DE",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.3,
    textAlign: "center",
  },
  subtitle: {
    width: "100%",
    maxWidth: 680,
    color: "#AEB6D4",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  panelHint: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(247,211,139,0.1)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.16)",
  },
  panelHintText: {
    color: "#F6DDA9",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  panel: {
    width: "100%",
    maxWidth: 680,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: "rgba(14,17,34,0.78)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.16)",
    padding: 18,
  },
  formStack: {
    gap: 16,
  },
  fieldWrap: {
    gap: 8,
  },
  label: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "800",
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    color: "#F8F0DE",
    fontSize: 16,
    paddingHorizontal: 15,
  },
  inputMultiline: {
    minHeight: 104,
    paddingTop: 14,
    lineHeight: 22,
  },
  optionLabel: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "900",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipActive: {
    backgroundColor: "rgba(247,211,139,0.18)",
    borderColor: "rgba(247,211,139,0.45)",
  },
  chipText: {
    color: "#AEB6D4",
    fontWeight: "800",
  },
  chipTextActive: {
    color: "#F7D38B",
  },
  suggestionRow: {
    gap: 8,
  },
  suggestionChip: {
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 11,
    backgroundColor: "rgba(247,211,139,0.1)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.16)",
  },
  suggestionText: {
    color: "#F6DDA9",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 14,
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    color: "#F8F0DE",
    fontWeight: "900",
  },
  switchText: {
    color: "#8F96B4",
    marginTop: 3,
  },
  voiceSelectionRow: {
    gap: 10,
  },
  voiceCard: {
    flexDirection: "row",
    gap: 13,
    padding: 14,
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  voiceCardActive: {
    borderColor: "rgba(247,211,139,0.52)",
    backgroundColor: "rgba(247,211,139,0.14)",
  },
  voiceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,211,139,0.14)",
  },
  voiceCopy: {
    flex: 1,
    gap: 4,
  },
  voiceName: {
    color: "#F8F0DE",
    fontSize: 16,
    fontWeight: "900",
  },
  voiceDescription: {
    color: "#AEB6D4",
    fontSize: 13,
    lineHeight: 18,
  },
  footerRow: {
    width: "100%",
    maxWidth: 680,
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    width: 92,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryButtonDisabled: {
    opacity: 0.48,
  },
  secondaryText: {
    color: "#C5CCE6",
    fontWeight: "900",
  },
  secondaryTextDisabled: {
    color: "#626A83",
  },
  primaryButton: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "#F7D38B",
  },
  primaryText: {
    color: "#101320",
    fontSize: 16,
    fontWeight: "900",
  },
  error: {
    width: "100%",
    maxWidth: 680,
    color: "#FF9A9A",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
