import { Fragment, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp, FadeOut, ZoomIn, SlideInDown, useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing, withRepeat, withSequence } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  CastMember,
  Choice,
  ChoiceOutcome,
  ConstellationStar,
  PersonaState,
  StateSignals,
  SynthesisState,
  ThreadState,
  TransmissionState,
} from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";
import { AvatarReveal } from "@/components/avatar-reveal";
import { ConstellationMap } from "@/components/constellation-map";
import { DivergenceGauge } from "@/components/divergence-gauge";
import { TransmissionPlayer } from "@/components/transmission-player";
import { styles } from "@/components/futureself-home.styles";

type IconName = keyof typeof Ionicons.glyphMap;

export function HoldToCommitButton({
  onCommit,
  isProcessing,
  defaultText,
  style,
  textStyle,
}: {
  onCommit: () => void;
  isProcessing: boolean;
  defaultText: string;
  style?: any;
  textStyle?: any;
}) {
  const progress = useSharedValue(0);
  const isHeld = useSharedValue(false);

  const handlePressIn = () => {
    if (isProcessing) return;
    isHeld.value = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    progress.value = withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }, (finished) => {
      if (finished && isHeld.value) {
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
        runOnJS(onCommit)();
      }
    });
  };

  const handlePressOut = () => {
    isHeld.value = false;
    if (progress.value < 1) {
      progress.value = withTiming(0, { duration: 300 });
    }
  };

  const animatedFillStyle = useAnimatedStyle(() => {
    return {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: `${progress.value * 100}%`,
      backgroundColor: "rgba(255,255,255,0.25)",
    };
  });

  const animatedScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 1 - progress.value * 0.03 }],
    };
  });

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isProcessing}
    >
      <Animated.View style={[style, animatedScaleStyle, { overflow: "hidden" }]}>
        <Animated.View style={animatedFillStyle} />
        {isProcessing ? (
          <ActivityIndicator color="#101320" />
        ) : (
          <Text style={textStyle}>{defaultText}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Session Arc (today's three beats) ───────────────────────────────────────

const ARC_BEATS: Array<{ key: string; label: string; icon: IconName }> = [
  { key: "pull", label: "The word", icon: "key" },
  { key: "voice", label: "The voice", icon: "radio-outline" },
  { key: "answer", label: "The answer", icon: "git-branch-outline" },
];

interface SessionArcProps {
  hasCheckIn: boolean;
  hasTransmission: boolean;
  hasChoice: boolean;
}

/**
 * Makes the daily ritual legible as a three-beat arc (word → voice → answer)
 * instead of a stack of sections. Completed beats stay lit; the next one
 * glows so there is always exactly one obvious next action.
 */
export function SessionArc({ hasCheckIn, hasTransmission, hasChoice }: SessionArcProps) {
  const done = [hasCheckIn, hasTransmission, hasChoice];
  const allDone = done.every(Boolean);

  // Celebration glow when the full arc is complete — a quiet "you did the
  // thing" beat that fades in after the last beat fills.
  const glowOpacity = useSharedValue(0);
  useEffect(() => {
    if (allDone) {
 glowOpacity.value = withSequence(
 withTiming(0, { duration: 100 }),
 withTiming(0.6, { duration: 600, easing: Easing.out(Easing.quad) }),
 withTiming(0.35, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
 );
 } else {
 glowOpacity.value = withTiming(0, { duration: 300 });
 }
  }, [allDone, glowOpacity]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <Animated.View entering={FadeInUp.duration(240)} style={styles.arcCard}>
      {/* Completion glow — a warm halo behind the row when all beats are done */}
      {allDone ? (
 <Animated.View
 pointerEvents="none"
 style={[styles.arcCompletionGlow, glowStyle]}
 />
 ) : null}
      <Text style={[styles.arcEyebrow, allDone && styles.arcEyebrowDone]}>
 {allDone ? "The line is complete" : "Today&apos;s line"}
      </Text>
      <View style={styles.arcRow}>
        {ARC_BEATS.map((beat, index) => {
          const isDone = done[index]!;
          const isNext = !isDone && (index === 0 || done[index - 1]!);
          return (
            <Fragment key={beat.key}>
              {index > 0 ? (
                <View
                  style={[
                    styles.arcLine,
                    isDone && done[index - 1] && styles.arcLineDone,
                  ]}
                />
              ) : null}
              <View style={styles.arcNodeWrap}>
                <View
                  style={[
                    styles.arcNode,
                    isDone && styles.arcNodeDone,
                    isNext && styles.arcNodeNext,
                  ]}
                >
                  {isDone ? (
                    <Animated.View entering={ZoomIn.duration(300).springify().damping(12)}>
                      <Ionicons name="checkmark" size={14} color="#101320" />
                    </Animated.View>
                  ) : isNext ? (
                    <Animated.View entering={FadeIn.duration(300)}>
                      <Ionicons name={beat.icon} size={16} color="#F7D38B" />
                    </Animated.View>
                  ) : (
                    <Ionicons name={beat.icon} size={16} color="#6F7591" />
                  )}
                </View>
                <Text
                  style={[
                    styles.arcLabel,
                    (isDone || isNext) && styles.arcLabelActive,
                  ]}
                >
                  {beat.label}
                </Text>
              </View>
            </Fragment>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ─── Evening urgency (streak health) ───────────────────────────────────────

/**
 * A gentle loss-aversion nudge after 6pm when today's beat is still open:
 * "one word before midnight" makes the cost of missing explicit at the exact
 * moment the user is most likely to abandon the day.
 */
export function EveningUrgencyBanner() {
  const hour = new Date().getHours();
  if (hour < 18) return null;
  return (
    <View style={styles.urgencyBanner}>
      <Ionicons name="time-outline" size={15} color="#F7D38B" />
      <Text style={styles.urgencyText}>
        Your line is holding — one word before midnight keeps it.
      </Text>
    </View>
  );
}

interface ActionNudge {
  label: string;
  choice: Choice;
  icon: IconName;
}

interface NextUnlock {
  label: string;
  requirement: string;
  emotionalRegister: string;
  /** Populated for Unchosen Selves (the_* cast) so they get the dark treatment. */
  castMember?: string;
}

interface HeroSectionProps {
  hasTransmissionToday: boolean;
  shouldShowSystemDepth: boolean;
  persona: PersonaState | null;
  isDebugMode: boolean;
  forcedCastMember: CastMember | null;
  divergenceLabel: string;
  /** 0-6 divergence score; drives the hero's line-state tint. */
  divergenceScore: number;
  onDebugTap: () => void;
  onOpenSettings: () => void;
  onOpenVoicemail: () => void;
}

/** Divergence band colors — steady gold → drift amber → flicker bronze → shadow violet. */
const HERO_BAND_COLORS = ["#F7D38B", "#F7D38B", "#E8C87A", "#B8860B", "#B8860B", "#7850A0", "#5A3A7A"];

export function getDivergenceBand(score: number): number {
  if (score >= 5) return 3;
  if (score >= 3) return 2;
  if (score >= 1) return 1;
  return 0;
}

export function HeroSection({
  hasTransmissionToday,
  shouldShowSystemDepth,
  persona,
  isDebugMode,
  forcedCastMember,
  divergenceLabel,
  divergenceScore,
  onDebugTap,
  onOpenSettings,
  onOpenVoicemail,
}: HeroSectionProps) {
  const bandColor = HERO_BAND_COLORS[Math.min(divergenceScore, HERO_BAND_COLORS.length - 1)]!;
  const band = getDivergenceBand(divergenceScore);

  return (
    <Animated.View
      entering={Platform.OS === "web" ? undefined : FadeInUp.duration(260)}
      style={[styles.hero, band > 0 && { borderColor: `${bandColor}55` }]}
    >
      {/* The hero's top edge is the timeline itself — it tints with the band. */}
      <View
        style={[
          styles.heroBandTint,
          { backgroundColor: band > 0 ? bandColor : "rgba(247,211,138,0.5)" },
        ]}
      />
      <View style={styles.heroTopStack}>
        <View style={styles.heroTopStackLeft}>
          <Pressable disabled={!isDebugMode} onPress={onDebugTap}>
            <View style={styles.signalBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.signalBadgeText}>daily</Text>
            </View>
          </Pressable>
          <Pressable 
            onPress={onOpenVoicemail} 
            style={[styles.signalBadge, { marginLeft: 8, backgroundColor: "rgba(247, 211, 139, 0.15)" }]}
          >
            <Ionicons name="mic-outline" size={12} color="#F7D38B" />
            <Text style={[styles.signalBadgeText, { color: "#F7D38B" }]}>voicemail</Text>
          </Pressable>
        </View>
        <Pressable onPress={onOpenSettings} style={styles.settingsEntry}>
          <Ionicons name="settings-outline" size={16} color="#F8F0DE" />
          <Text style={styles.settingsEntryText}>Ritual settings</Text>
        </Pressable>
      </View>

      {persona?.miraculousYear ? (
        <View style={styles.northStarBadge}>
          <Ionicons name="compass-outline" size={14} color="#F7D38B" />
          <Text style={styles.northStarText} numberOfLines={1}>
            {persona.miraculousYear}
          </Text>
        </View>
      ) : persona?.currentChapter ? (
        <View style={styles.northStarBadge}>
          <Ionicons name="compass-outline" size={14} color="#F7D38B" />
          <Text style={styles.northStarText} numberOfLines={1}>
            {persona.currentChapter}
          </Text>
        </View>
      ) : null}

      <Text style={styles.heroTitle}>
        {hasTransmissionToday ? "The voice has arrived." : "One word is enough."}
      </Text>
      <Text style={styles.heroCopy}>
        {hasTransmissionToday
          ? "Make one small choice."
          : "Your future self does the rest."}
      </Text>

      {isDebugMode && forcedCastMember ? (
        <View style={styles.demoLockPill}>
          <Ionicons name="radio-outline" size={14} color="#F7D38B" />
          <Text style={styles.demoLockText}>
            Demo voice locked: {formatCastMember(forcedCastMember)}
          </Text>
        </View>
      ) : null}

      {shouldShowSystemDepth && persona ? (
        <View style={styles.heroStatsGrid}>
          <HeroStat
            icon="flame-outline"
            label="streak"
            value={`${persona.streak} day${persona.streak === 1 ? "" : "s"}`}
          />
          <HeroStat
            icon="git-branch-outline"
            label="divergence"
            value={divergenceLabel}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

interface TransmissionSectionProps {
  transmission: TransmissionState;
  yesterdayAccountability: {
    actionPrompt: string;
    reaction?: "landed" | "not_quite" | "did_it" | "keep_close";
    followedThrough: boolean;
  } | null;
  showTransmissionArrival: boolean;
  transmissionArrivalSweepStyle: any;
  transmissionArrivalGlowStyle: any;
  transmissionArrivalCoreStyle: any;
  shareStatus: string | null;
  onShare: () => void;
  isSavingResponse: boolean;
  onSaveResponse: (payload: {
    reaction?: "landed" | "not_quite" | "did_it" | "keep_close";
    replyNote?: string;
  }) => Promise<void>;
}

export function TransmissionSection({
  transmission,
  yesterdayAccountability,
  showTransmissionArrival,
  transmissionArrivalSweepStyle,
  transmissionArrivalGlowStyle,
  transmissionArrivalCoreStyle,
  shareStatus,
  onShare,
  isSavingResponse,
  onSaveResponse,
}: TransmissionSectionProps) {
  return (
    <>
      {yesterdayAccountability ? (
        <Animated.View entering={FadeInUp.duration(260)} style={styles.accountabilityBanner}>
          <Ionicons
            name={yesterdayAccountability.followedThrough ? "checkmark-circle-outline" : "time-outline"}
            size={15}
            color={yesterdayAccountability.followedThrough ? "#A9F7B5" : "#8F96B4"}
          />
          <Text style={styles.accountabilityText}>
            {yesterdayAccountability.followedThrough
              ? "Yesterday you followed through. The line remembers."
              : "Yesterday's transmission is still waiting for a response."}
          </Text>
        </Animated.View>
      ) : null}
      <Animated.View
        entering={ZoomIn.duration(400).springify().damping(15)}
        style={styles.transmissionShell}
      >
        <TransmissionPlayer
          isSavingResponse={isSavingResponse}
          onSaveResponse={onSaveResponse}
          transmission={transmission}
        />
        {showTransmissionArrival ? (
          <Animated.View
            entering={FadeIn.duration(240)}
            exiting={FadeOut.duration(520)}
            pointerEvents="none"
            style={styles.transmissionArrivalOverlay}
          >
            <Animated.View
              style={[styles.transmissionArrivalSweep, transmissionArrivalSweepStyle]}
            />
            <Animated.View
              style={[styles.transmissionArrivalGlow, transmissionArrivalGlowStyle]}
            />
            <Animated.View
              style={[styles.transmissionArrivalCore, transmissionArrivalCoreStyle]}
            />
            <View style={styles.transmissionArrivalStars}>
              <Animated.View
                entering={FadeInUp.delay(70).duration(260)}
                style={[
                  styles.transmissionArrivalStar,
                  styles.transmissionArrivalStarSmall,
                ]}
              />
              <Animated.View
                entering={FadeInUp.delay(130).duration(280)}
                style={styles.transmissionArrivalStar}
              />
              <Animated.View
                entering={FadeInUp.delay(210).duration(300)}
                style={[
                  styles.transmissionArrivalStar,
                  styles.transmissionArrivalStarSmall,
                ]}
              />
            </View>
            <Animated.View entering={FadeInUp.delay(110).duration(260)}>
              <View style={styles.transmissionArrivalBadge}>
                <View style={styles.transmissionArrivalDot} />
                <Text style={styles.transmissionArrivalEyebrow}>
                  Transmission received
                </Text>
              </View>
            </Animated.View>
            <Animated.Text
              entering={FadeInUp.delay(180).duration(320)}
              style={styles.transmissionArrivalTitle}
            >
              {transmission.audioUrl ? "The voice has arrived." : "The transmission has arrived."}
            </Animated.Text>
            <Animated.Text
              entering={FadeInUp.delay(260).duration(340)}
              style={styles.transmissionArrivalCopy}
            >
              {transmission.audioUrl
                ? "Pause for a breath, then press play."
                : "Read slowly. The next choice still changes tomorrow."}
            </Animated.Text>
          </Animated.View>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200)} style={styles.shareRow}>
        <Pressable
          onPress={onShare}
          style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={18} color="#F7D38B" />
          <Text style={styles.shareButtonText}>{shareStatus ?? "Share this moment"}</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

// ─── Yesterday Moment ────────────────────────────────────────────────────────

interface YesterdayMomentProps {
  actionPrompt: string;
  onRespond: (reaction: "did_it" | "not_quite" | "keep_close") => void;
  onDismiss: () => void;
  isResponding: boolean;
}

export function YesterdayMoment({
  actionPrompt,
  onRespond,
  onDismiss,
  isResponding,
}: YesterdayMomentProps) {
  return (
    <Animated.View
      entering={Platform.OS === "web" ? undefined : FadeInUp.duration(320)}
      style={styles.yesterdayCard}
    >
      <View style={styles.yesterdayHeader}>
        <Ionicons name="arrow-back-circle-outline" size={18} color="#F7D38B" />
        <Text style={styles.yesterdayEyebrow}>Yesterday</Text>
      </View>
      <Text style={styles.yesterdayAction}>{actionPrompt}</Text>
      <Text style={styles.yesterdayQuestion}>Did you follow through?</Text>
      <View style={styles.yesterdayButtons}>
        <Pressable
          disabled={isResponding}
          onPress={() => onRespond("did_it")}
          style={({ pressed }) => [
            styles.yesterdayButton,
            styles.yesterdayButtonPrimary,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#101320" />
          <Text style={styles.yesterdayButtonTextPrimary}>I did it</Text>
        </Pressable>
        <Pressable
          disabled={isResponding}
          onPress={() => onRespond("not_quite")}
          style={({ pressed }) => [
            styles.yesterdayButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.yesterdayButtonText}>Not quite</Text>
        </Pressable>
        <Pressable
          disabled={isResponding}
          onPress={() => onRespond("keep_close")}
          style={({ pressed }) => [
            styles.yesterdayButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.yesterdayButtonText}>Keeping it close</Text>
        </Pressable>
      </View>
      <Pressable onPress={onDismiss} style={styles.yesterdayDismiss}>
        <Text style={styles.yesterdayDismissText}>Skip for now</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Receive Signal Section ──────────────────────────────────────────────────

interface ReceiveSignalSectionProps {
  isReceiving: boolean;
  word: string;
  note: string;
  showDetailInput: boolean;
  wordNudges: Array<string>;
  noteNudges: Array<string>;
  yesterdayCliffhanger?: string;
  /** When non-null, the mic button appears. `onSpeakWord` fires with the recognized word. */
  onSpeakWord?: (word: string) => void;
  /** `true` while the microphone is capturing or STT is transcribing. */
  isSpeaking?: boolean;
  /** Start recording. Only used when `onSpeakWord` is set. */
  onStartSpeak?: () => void;
  /** Stop recording and begin STT. Only used when `onSpeakWord` is set. */
  onStopSpeak?: () => void;
  /** Duration in seconds of the current recording. */
  speakDuration?: number;
  onWordChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onToggleDetail: () => void;
  onReceive: () => void;
}

export function ReceiveSignalSection({
  isReceiving,
  word,
  note,
  showDetailInput,
  wordNudges,
  noteNudges,
  yesterdayCliffhanger,
  onSpeakWord,
  isSpeaking = false,
  onStartSpeak,
  onStopSpeak,
  speakDuration = 0,
  onWordChange,
  onNoteChange,
  onToggleDetail,
  onReceive,
}: ReceiveSignalSectionProps) {
  const hasSpeechInput = Boolean(onSpeakWord && onStartSpeak && onStopSpeak);

  // Pulsing halo around the mic when idle so the user's eye lands on it instead
  // of the text input. Slows when actively listening.
  const micPulse = useSharedValue(1);
  useEffect(() => {
    micPulse.value = withRepeat(
      withSequence(
        withTiming(isSpeaking ? 1.04 : 1.12, {
          duration: isSpeaking ? 1100 : 1600,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(1, {
          duration: isSpeaking ? 1100 : 1600,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
  }, [isSpeaking, micPulse]);
  const micHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micPulse.value }],
  }));

  return (
    <Animated.View
      entering={Platform.OS === "web" ? undefined : FadeInUp.delay(80).duration(260)}
      style={styles.receiveCard}
    >
      <View style={styles.receiveHeader}>
        <View style={styles.receiveIcon}>
          <Ionicons name={hasSpeechInput ? "mic" : "key"} size={22} color="#F7D38B" />
        </View>
        <View style={styles.receiveHeaderCopy}>
          <Text style={styles.sectionTitle}>
            {hasSpeechInput ? "Say one word." : "One word."}
          </Text>
          <Text style={styles.sectionCopy}>
            Future-you does the rest.
          </Text>
        </View>
      </View>

      {yesterdayCliffhanger ? (
        <View style={styles.cliffhangerTeaser}>
          <Ionicons name="moon" size={13} color="#AEB6D4" />
          <Text style={styles.cliffhangerTeaserText}>
            Yesterday&apos;s voice left something unfinished: &ldquo;{yesterdayCliffhanger}&rdquo;
          </Text>
        </View>
      ) : null}

      {hasSpeechInput ? (
        <View style={styles.speechFirstWrap}>
          <View style={styles.micStage}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.micHalo,
                isSpeaking && styles.micHaloActive,
                micHaloStyle,
              ]}
            />
            <Pressable
              accessibilityLabel={isSpeaking ? "Stop listening" : "Tap to speak one word"}
              onPress={isSpeaking ? onStopSpeak : onStartSpeak}
              style={({ pressed }) => [
                styles.micButtonPrimary,
                isSpeaking && styles.micButtonPrimaryActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={isSpeaking ? "stop" : "mic"}
                size={44}
                color={isSpeaking ? "#FF6B6B" : "#101320"}
              />
            </Pressable>
          </View>
          <Text style={styles.speechHint}>
            {isSpeaking
              ? `Listening… ${Math.round(speakDuration)}s`
              : word
                ? `Heard: "${word}"`
                : "Tap and say one word."}
          </Text>
          <View style={styles.speechFallbackRow}>
            <View style={styles.speechFallbackDivider} />
            <Text style={styles.speechFallbackLabel}>or type</Text>
            <View style={styles.speechFallbackDivider} />
          </View>
          <TextInput
            onChangeText={onWordChange}
            placeholder="threshold"
            placeholderTextColor="#6F7591"
            style={styles.speechFallbackInput}
            value={word}
          />
        </View>
      ) : (
        <View style={styles.wordInputRow}>
          <TextInput
            onChangeText={onWordChange}
            placeholder="threshold"
            placeholderTextColor="#6F7591"
            style={styles.wordInput}
            value={word}
          />
        </View>
      )}
      {!hasSpeechInput && word.trim() ? (
        <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.wordEchoWrap}>
          <Text style={styles.wordEcho}>
            Future-you heard: &ldquo;{word.trim()}&rdquo;.
          </Text>
        </Animated.View>
      ) : null}
      <NudgeRow
        label="Suggested words"
        options={wordNudges}
        onSelect={onWordChange}
        selected={word}
      />

      <Pressable
        onPress={onToggleDetail}
        style={({ pressed }) => [styles.detailToggle, pressed && styles.pressed]}
      >
        <Ionicons
          name={showDetailInput ? "remove-outline" : "add-outline"}
          size={16}
          color="#F7D38B"
        />
        <Text style={styles.detailToggleText}>
          {showDetailInput ? "Hide detail" : "Add detail"}
        </Text>
      </Pressable>

      {showDetailInput ? (
        <View style={styles.detailWrap}>
          <TextInput
            multiline
            onChangeText={onNoteChange}
            placeholder="Optional: one detail future-you should remember."
            placeholderTextColor="#6F7591"
            style={styles.noteInput}
            textAlignVertical="top"
            value={note}
          />
          <NudgeRow
            label="Detail starters"
            options={noteNudges}
            onSelect={onNoteChange}
            selected={note}
          />
        </View>
      ) : null}

      <HoldToCommitButton
        isProcessing={isReceiving}
        onCommit={onReceive}
        defaultText="Hold to receive today's voice"
        style={styles.receiveButton}
        textStyle={styles.receiveText}
      />
    </Animated.View>
  );
}

interface ChoiceSectionProps {
  transmission: TransmissionState;
  openThreads: Array<ThreadState>;
  selectedThreadId: Id<"narrativeThreads"> | null;
  selectedChoice: Choice | null;
  choiceOutcome: ChoiceOutcome | null;
  /** 0-6 divergence score before the move, for the line-delta readout. */
  divergenceScore: number;
  shouldShowStoryDepth: boolean;
  shouldShowSystemDepth: boolean;
  choiceCopy: Record<Choice, string>;
  actionNudges: Array<ActionNudge>;
  onSelectThread: (id: Id<"narrativeThreads">) => void;
  onChoice: (choice: Choice) => void;
}

export function ChoiceSection({
  transmission,
  openThreads,
  selectedThreadId,
  selectedChoice,
  choiceOutcome,
  divergenceScore,
  shouldShowStoryDepth,
  shouldShowSystemDepth,
  choiceCopy,
  actionNudges,
  onSelectThread,
  onChoice,
}: ChoiceSectionProps) {
  const [hoveredChoice, setHoveredChoice] = useState<Choice | null>(null);

  return (
    <Animated.View entering={SlideInDown.delay(300).duration(400)} style={styles.choiceCard}>
      <View style={styles.choiceHeaderRow}>
        <View style={styles.choiceHeaderIcon}>
          <Ionicons name="git-branch-outline" size={20} color="#F7D38B" />
        </View>
        <View style={styles.choiceHeaderCopy}>
          {/* The choice is a reply to the voice, not a menu — surface the ask. */}
          <Text style={styles.sectionTitle}>How do you answer?</Text>
          <Text style={[styles.sectionCopy, styles.choicePrompt]}>
            &ldquo;{transmission.actionPrompt}&rdquo;
          </Text>
        </View>
      </View>

      {openThreads.length > 0 && (hoveredChoice === "repair" || hoveredChoice === "release") ? (
        <View style={styles.threadTargetSection}>
          <Text style={styles.nudgeLabel}>Choose which thread to aim this at</Text>
          <View style={styles.threadTargetGrid}>
            {openThreads.map((thread) => (
              <Pressable
                key={thread.id}
                onPress={() => onSelectThread(thread.id)}
                style={[
                  styles.threadTargetChip,
                  selectedThreadId === thread.id && styles.threadTargetChipActive,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.threadTargetEyebrow,
                    selectedThreadId === thread.id && styles.threadTargetEyebrowActive,
                  ]}
                >
                  {formatCastMember(thread.castMember)}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.threadTargetTitle,
                    selectedThreadId === thread.id && styles.threadTargetTitleActive,
                  ]}
                >
                  {thread.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Visual choice grid */}
      <View style={styles.choiceGrid}>
        {/* Hero choice: Toward */}
        <VisualChoiceCard
          choice="toward"
          label={choiceCopy.toward}
          icon="arrow-forward-circle"
          color="#F7D38B"
          isSelected={selectedChoice === "toward"}
          isHovered={hoveredChoice === "toward"}
          onHover={setHoveredChoice}
          onChoice={onChoice}
          isHero
        />

        {/* Secondary choices */}
        <View style={styles.choiceSecondaryRow}>
          <VisualChoiceCard
            choice="steady"
            label={choiceCopy.steady}
            icon="pause-circle"
            color="#AEB6D4"
            isSelected={selectedChoice === "steady"}
            isHovered={hoveredChoice === "steady"}
            onHover={setHoveredChoice}
            onChoice={onChoice}
          />
          <VisualChoiceCard
            choice="release"
            label={choiceCopy.release}
            icon="close-circle"
            color="#FF9A9A"
            isSelected={selectedChoice === "release"}
            isHovered={hoveredChoice === "release"}
            onHover={setHoveredChoice}
            onChoice={onChoice}
          />
          <VisualChoiceCard
            choice="repair"
            label={choiceCopy.repair}
            icon="build-circle"
            color="#A9F7B5"
            isSelected={selectedChoice === "repair"}
            isHovered={hoveredChoice === "repair"}
            onHover={setHoveredChoice}
            onChoice={onChoice}
          />
        </View>
      </View>

      {/* Choice outcome */}
      {choiceOutcome ? (
        <Animated.View entering={ZoomIn.duration(300).springify().damping(14)} style={styles.choiceOutcomeCard}>
          <View style={styles.choiceOutcomeHeader}>
            <Ionicons name="sparkles" size={16} color="#F7D38B" />
            <Text style={styles.choiceOutcomeTitle}>{choiceOutcome.summary}</Text>
          </View>
          <Text style={styles.choiceOutcomeBody}>{choiceOutcome.detail}</Text>
          <Text style={styles.choiceOutcomeMeta}>{choiceOutcome.voiceShift}</Text>
          {selectedChoice ? (
            <ChoiceLineDelta choice={selectedChoice} score={divergenceScore} />
          ) : null}
        </Animated.View>
      ) : null}

      {/* Action nudges */}
      {shouldShowStoryDepth ? (
        <>
          <Text style={styles.nudgeLabel}>Borrow a tiny move</Text>
          <View style={styles.actionNudgeGrid}>
            {actionNudges.map((nudge) => (
              <Pressable
                key={nudge.label}
                onPress={() => onChoice(nudge.choice)}
                style={({ pressed }) => [styles.actionNudge, pressed && styles.pressed]}
              >
                <Ionicons name={nudge.icon} size={16} color="#F7D38B" />
                <Text style={styles.actionNudgeText}>{nudge.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Animated.View>
  );
}

// The divergence effect of each move, shown as a felt consequence after picking.
const CHOICE_DELTA: Record<Choice, { delta: number; note: string }> = {
  toward: { delta: -2, note: "The timeline settles ahead of you." },
  steady: { delta: 0, note: "The line holds where it is." },
  release: { delta: -1, note: "The field softens, grows stranger." },
  repair: { delta: -1, note: "A thread resolves." },
};

const LINE_BAND_COLORS = [
  "#F7D38B", // 0
  "#F7D38B", // 1
  "#E8C87A", // 2
  "#D4A017", // 3
  "#B8860B", // 4
  "#7850A0", // 5
  "#5A3A7A", // 6
];

/**
 * The "world reacts" moment: after a choice, show the line's before/after
 * state as seven segments so the divergence system is felt, not just read.
 */
function ChoiceLineDelta({ choice, score }: { choice: Choice; score: number }) {
  const { delta, note } = CHOICE_DELTA[choice];
  const next = Math.max(0, Math.min(6, score + delta));

  return (
    <View style={styles.lineDeltaRow}>
      <View style={styles.lineDeltaSegments}>
        {Array.from({ length: 7 }, (_, index) => {
          const isSettled = index < next;
          const isFading = !isSettled && index < score;
          const color = LINE_BAND_COLORS[index] ?? "#F7D38B";
          return (
            <View
              key={index}
              style={[
                styles.lineDeltaSegment,
                isSettled && { backgroundColor: color },
                isFading && { backgroundColor: `${color}55`, borderColor: `${color}66` },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.lineDeltaText}>
        {delta < 0 ? `Divergence ${delta}` : "Divergence 0"} · {note}
      </Text>
    </View>
  );
}

interface VisualChoiceCardProps {
  choice: Choice;
  label: string;
  icon: string;
  color: string;
  isSelected: boolean;
  isHovered: boolean;
  onHover: (choice: Choice | null) => void;
  onChoice: (choice: Choice) => void;
  isHero?: boolean;
}

function VisualChoiceCard({
  choice,
  label,
  icon,
  color,
  isSelected,
  isHovered,
  onHover,
  onChoice,
  isHero,
}: VisualChoiceCardProps) {
  // Subtle hover glow animation
  const glowValue = useSharedValue(0);
  useEffect(() => {
    glowValue.value = withTiming(isHovered ? 0.3 : 0, { duration: 200 });
  }, [isHovered, glowValue]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowValue.value }));

  // Celebratory spring bounce when the hero card is selected
  const bounceValue = useSharedValue(0);
  useEffect(() => {
    if (isSelected) {
      bounceValue.value = withSequence(withTiming(1.04, { duration: 120 }), withTiming(1, { duration: 180 }));
    }
  }, [isSelected, bounceValue]);
  const bounceStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounceValue.value || 1 }] }));

  if (isHero) {
    return (
      <Animated.View style={bounceStyle}>
        <Pressable
          onPressIn={() => onHover(choice)}
          onPressOut={() => onHover(null)}
          onPress={() => {
            if (Platform.OS !== "web") void Haptics.selectionAsync();
            onChoice(choice);
          }}
          style={({ pressed }) => [
            styles.choiceButtonHero,
            isSelected && styles.choiceButtonHeroActive,
            { borderColor: isSelected ? color : "rgba(247,211,139,0.35)" },
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
          ]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, glowStyle, { backgroundColor: color, borderRadius: 20 }]} pointerEvents="none" />
          <View style={styles.choiceIconWrap}>
            <Ionicons name={icon as any} size={28} color={isSelected ? "#101320" : color} />
          </View>
          <Text style={[styles.choiceTextHero, isSelected && { color: "#101320" }]}>
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Pressable
      onPressIn={() => onHover(choice)}
      onPressOut={() => onHover(null)}
      onPress={() => {
        if (Platform.OS !== "web") void Haptics.selectionAsync();
        onChoice(choice);
      }}
      style={({ pressed }) => [
        styles.choiceButtonSecondary,
        isSelected && { backgroundColor: `${color}22`, borderColor: `${color}66` },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle, { backgroundColor: color, borderRadius: 16 }]} pointerEvents="none" />
      <Ionicons name={icon as any} size={18} color={isSelected ? color : "#8F96B4"} />
      <Text style={[styles.choiceTextSecondary, isSelected && { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface WeeklyReflectionProps {
  transmissions: Array<TransmissionState>;
  persona: { streak: number; name: string } | null;
  currentSynthesis?: SynthesisState | null;
  isGeneratingSynthesis?: boolean;
  onGenerateSynthesis?: () => void;
}

export function WeeklyReflectionSection({
  transmissions,
  persona,
  currentSynthesis,
  isGeneratingSynthesis,
  onGenerateSynthesis,
}: WeeklyReflectionProps) {
  if (transmissions.length < 7) return null;

  const last7 = transmissions.slice(0, 7);
  const reactions = last7.filter((t) => t.response?.reaction);
  const didIts = reactions.filter((t) => t.response?.reaction === "did_it").length;
  const keepCloses = reactions.filter((t) => t.response?.reaction === "keep_close").length;
  const landed = reactions.filter((t) => t.response?.reaction === "landed").length;
  const voiceCounts = new Map<string, number>();
  for (const t of last7) {
    voiceCounts.set(t.castMember, (voiceCounts.get(t.castMember) ?? 0) + 1);
  }
  const topVoice = [...voiceCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const weekLabel = didIts >= 3
    ? "You moved the line forward most days this week."
    : keepCloses >= 3
      ? "You kept the important transmissions close."
      : landed >= 3
        ? "The transmissions are landing. The line is learning your frequency."
        : "The line is still finding your rhythm.";

  return (
    <Animated.View entering={FadeInUp.delay(200)} style={styles.weeklyCard}>
      <View style={styles.weeklyHeader}>
        <Ionicons name="calendar-outline" size={16} color="#F7D38B" />
        <Text style={styles.sectionTitle}>This week</Text>
      </View>
      <Text style={styles.weeklySummary}>{weekLabel}</Text>
      <View style={styles.weeklyStatsRow}>
        <View style={styles.weeklyStat}>
          <Text style={styles.weeklyStatValue}>{didIts}</Text>
          <Text style={styles.weeklyStatLabel}>followed through</Text>
        </View>
        <View style={styles.weeklyStat}>
          <Text style={styles.weeklyStatValue}>{keepCloses}</Text>
          <Text style={styles.weeklyStatLabel}>kept close</Text>
        </View>
        <View style={styles.weeklyStat}>
          <Text style={styles.weeklyStatValue}>{landed}</Text>
          <Text style={styles.weeklyStatLabel}>landed</Text>
        </View>
      </View>
      {topVoice ? (
        <Text style={styles.weeklyVoice}>
          {formatCastMember(topVoice[0] as CastMember)} spoke {topVoice[1]} time{topVoice[1] > 1 ? "s" : ""} this week.
        </Text>
      ) : null}

      {currentSynthesis ? (
        <View style={styles.synthesisContainer}>
          <Text style={styles.synthesisSummary}>{currentSynthesis.summary}</Text>
          <Text style={styles.synthesisActionHeader}>Action Items:</Text>
          {currentSynthesis.actionItems.map((item, idx) => (
            <View key={idx} style={styles.synthesisActionItem}>
              <Ionicons name="ellipse" size={6} color="#F7D38B" style={{ marginTop: 6 }} />
              <Text style={styles.synthesisActionText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : onGenerateSynthesis ? (
        <HoldToCommitButton
          isProcessing={Boolean(isGeneratingSynthesis)}
          onCommit={onGenerateSynthesis}
          defaultText="Synthesize this week"
          style={styles.synthesizeButton}
          textStyle={styles.synthesizeButtonText}
        />
      ) : null}
    </Animated.View>
  );
}

interface ProgressionSectionProps {
  shouldShowStoryDepth: boolean;
  shouldShowSystemDepth: boolean;
  nextUnlock: NextUnlock | null;
  systemSignals: StateSignals;
  constellation: Array<ConstellationStar>;
}

export function ProgressionSection({
  shouldShowStoryDepth,
  shouldShowSystemDepth,
  nextUnlock,
  systemSignals,
  constellation,
  divergenceScore,
}: ProgressionSectionProps & { divergenceScore?: number }) {
  if (!shouldShowStoryDepth) return null;

  const isDarkVoice = Boolean(nextUnlock?.castMember?.startsWith("the_"));

  return (
    <View style={styles.unlockCard}>
      <View style={styles.unlockHeader}>
        <Text style={styles.sectionTitle}>The constellation</Text>
        <Text style={styles.sectionCopy}>
          Each voice is a node. Your choices shape which ones draw close.
        </Text>
      </View>

      {/* Constellation star map */}
      {shouldShowSystemDepth ? (
        <Animated.View entering={ZoomIn.duration(600).springify().damping(14)} style={styles.constellationWrap}>
          <ConstellationMap
            stars={constellation}
            divergenceScore={divergenceScore ?? 0}
            size={280}
            nextUnlockLabel={nextUnlock?.label}
          />
        </Animated.View>
      ) : null}

      {/* Divergence gauge */}
      {shouldShowSystemDepth ? (
        <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.gaugeWrap}>
          <DivergenceGauge score={divergenceScore ?? 0} label="timeline" />
        </Animated.View>
      ) : null}

      {/* Next unlock */}
      {nextUnlock ? (
        <View style={styles.nextUnlockWrap}>
          <Animated.View
            entering={FadeInUp.delay(200).duration(300)}
            style={[
              styles.nextUnlockCard,
              isDarkVoice && styles.nextUnlockCardDark,
            ]}
          >
            <View style={styles.nextUnlockHeader}>
              <View
                style={[
                  styles.nextUnlockBadge,
                  isDarkVoice && styles.nextUnlockBadgeDark,
                ]}
              >
                <Ionicons
                  name={isDarkVoice ? "moon" : "sparkles"}
                  size={15}
                  color={isDarkVoice ? "#CBB6F2" : "#101320"}
                />
              </View>
              <View style={styles.nextUnlockCopy}>
                {isDarkVoice ? (
                  <Text style={styles.darkVoiceTag}>An Unchosen Self</Text>
                ) : null}
                <Text style={styles.nextUnlockTitle}>
                  {isDarkVoice
                    ? `Approaching: ${nextUnlock.label}`
                    : `Nearing: ${nextUnlock.label}`}
                </Text>
                <Text style={styles.nextUnlockText}>{nextUnlock.requirement}</Text>
              </View>
            </View>
            <Text
              style={[
                styles.nextUnlockMood,
                isDarkVoice && styles.nextUnlockMoodDark,
              ]}
            >
              {nextUnlock.emotionalRegister}
            </Text>
          </Animated.View>
          {isDarkVoice ? (
            <Animated.Text
              entering={FadeIn.delay(300).duration(300)}
              style={styles.darkVoiceTease}
            >
              A version of you on a road you didn&apos;t take. It hasn&apos;t arrived —
              but it&apos;s drawing closer.
            </Animated.Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

interface StorySectionProps {
  title: string;
  description: string;
  items: Array<{
    id: string;
    castMember: CastMember;
    title: string;
    body: string;
  }>;
}

export function StorySection({ title, description, items }: StorySectionProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.storyCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCopy}>{description}</Text>
      <View style={styles.storyList}>
        {items.map((item) => (
          <View key={item.id} style={styles.storyItem}>
            <Text style={styles.storyEyebrow}>{formatCastMember(item.castMember)}</Text>
            <Text style={styles.storyTitle}>{item.title}</Text>
            <Text style={styles.storyBody}>{item.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface RitualRefinementPromptProps {
  title?: string;
  body?: string;
  buttonLabel?: string;
  onOpenSettings: () => void;
}

export function RitualRefinementPrompt({
  title = "Your first transmission is in motion.",
  body = "Refine voice tone, timeline depth, and rare-voice consent in settings.",
  buttonLabel = "Refine ritual",
  onOpenSettings,
}: RitualRefinementPromptProps) {
  return (
    <View style={styles.refinementCard}>
      <View style={styles.refinementHeader}>
        <View style={styles.refinementBadge}>
          <Ionicons name="sparkles-outline" size={15} color="#F7D38B" />
        </View>
        <View style={styles.refinementCopy}>
          <Text style={styles.refinementTitle}>{title}</Text>
          <Text style={styles.refinementBody}>{body}</Text>
        </View>
      </View>
      <Pressable
        onPress={onOpenSettings}
        style={({ pressed }) => [styles.refinementButton, pressed && styles.pressed]}
      >
        <Ionicons name="settings-outline" size={16} color="#101320" />
        <Text style={styles.refinementButtonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  const date = new Date(`${year}-${month}-${day}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getMemoryExcerpt(text: string) {
  if (text.length <= 220) return text;
  return `${text.slice(0, 217).trimEnd()}...`;
}

interface MilestoneOverlayProps {
  visible: boolean;
  currentStreak: number;
  onDismiss: () => void;
  onShare: () => void;
}

export function MilestoneOverlay({
  visible,
  currentStreak,
  onDismiss,
  onShare,
}: MilestoneOverlayProps) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(600)}
      style={styles.milestoneOverlay}
    >
      <Pressable style={styles.milestoneBackdrop} onPress={onDismiss} />
      <Animated.View
        entering={ZoomIn.duration(400).springify().damping(14)}
        style={styles.milestoneCard}
      >
        <Text style={styles.milestoneEmoji}>🔮</Text>
        <Text style={styles.milestoneTitle}>{currentStreak}-day streak</Text>
        <Text style={styles.milestoneCopy}>
          You&apos;ve kept this ritual going for {currentStreak} days straight. The
          timeline remembers.
        </Text>
        <View style={styles.milestoneActions}>
          <Pressable
            onPress={onShare}
            style={({ pressed }) => [styles.milestoneShareButton, pressed && styles.pressed]}
          >
            <Ionicons name="share-outline" size={16} color="#101320" />
            <Text style={styles.milestoneShareText}>Share achievement</Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.milestoneDismiss, pressed && styles.pressed]}
          >
            <Text style={styles.milestoneDismissText}>Continue</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

interface VoiceUnlockOverlayProps {
  voice: { label: string; emotionalRegister: string; castMember: string } | null;
  onDismiss: () => void;
  onShare: (voiceLabel: string) => void;
}

export function VoiceUnlockOverlay({ voice, onDismiss, onShare }: VoiceUnlockOverlayProps) {
  if (!voice) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(600)}
      style={styles.milestoneOverlay}
    >
      <Pressable style={styles.milestoneBackdrop} onPress={onDismiss} />
      <Animated.View
        entering={ZoomIn.duration(500).springify().damping(12)}
        style={styles.milestoneCard}
      >
        <Animated.View entering={FadeInUp.delay(200).duration(300)}>
          <AvatarReveal castMember={voice.castMember as CastMember} size={140} />
        </Animated.View>
        <Animated.Text entering={FadeInUp.delay(300).duration(300)} style={styles.milestoneTitle}>
          {voice.label} has arrived
        </Animated.Text>
        <Animated.Text entering={FadeInUp.delay(400).duration(300)} style={styles.milestoneCopy}>
          A new voice is available on the line. {voice.emotionalRegister}.
        </Animated.Text>
        <View style={styles.milestoneActions}>
          <Pressable
            onPress={() => onShare(voice.label)}
            style={({ pressed }) => [styles.milestoneShareButton, pressed && styles.pressed]}
          >
            <Ionicons name="share-outline" size={16} color="#101320" />
            <Text style={styles.milestoneShareText}>Share unlock</Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.milestoneDismiss, pressed && styles.pressed]}
          >
            <Text style={styles.milestoneDismissText}>Continue</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

interface FlareOverlayProps {
  visible: boolean;
  flareColor: string;
}

export function FlareOverlay({ visible, flareColor }: FlareOverlayProps) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(1000)}
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: flareColor, opacity: 0.15, zIndex: 999 },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.flareGlow, { borderColor: flareColor }]} />
    </Animated.View>
  );
}

interface HeroStatProps {
  icon: IconName;
  label: string;
  value: string;
}

function HeroStat({ icon, label, value }: HeroStatProps) {
  return (
    <View style={styles.heroStatCard}>
      <View style={styles.heroStatLabelRow}>
        <Ionicons name={icon} size={14} color="#F7D38B" />
        <Text style={styles.heroStatLabel}>{label}</Text>
      </View>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

interface NudgeRowProps {
  label: string;
  options: Array<string>;
  selected: string;
  onSelect: (value: string) => void;
}

function NudgeRow({ label, options, selected, onSelect }: NudgeRowProps) {
  return (
    <View style={styles.nudgeWrap}>
      <Text style={styles.nudgeLabel}>{label}</Text>
      <View style={styles.nudgeGrid}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => {
              onSelect(option);
              if (Platform.OS !== "web") void Haptics.selectionAsync();
            }}
            style={[
              styles.nudgeChip,
              selected === option && styles.nudgeChipActive,
            ]}
          >
            <Text
              style={[
                styles.nudgeText,
                selected === option && styles.nudgeTextActive,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SignalItem({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.systemSignalItem}>
      <Text style={styles.systemSignalEyebrow}>{eyebrow}</Text>
      <Text style={styles.systemSignalHeading}>{title}</Text>
      <Text style={styles.systemSignalBody}>{body}</Text>
    </View>
  );
}

interface VoiceOrbProps {
  star: ConstellationStar;
}

function VoiceOrb({ star }: VoiceOrbProps) {
  const isUnlocked = star.state === "lit" || star.state === "dim";

  return (
    <View style={styles.voiceOrbWrap}>
      {isUnlocked ? (
        <AvatarReveal castMember={star.castMember} size={48} />
      ) : (
        <View
          style={[
            styles.voiceOrb,
            star.state === "quiet" && styles.voiceOrbQuiet,
          ]}
        >
          <Ionicons
            name={star.state === "quiet" ? "moon" : "lock-closed"}
            size={16}
            color="#F7D38B"
          />
        </View>
      )}
      <Text numberOfLines={2} style={styles.voiceLabel}>
        {star.label}
      </Text>
      <Text numberOfLines={2} style={styles.voiceHint}>
        {star.unlockHint}
      </Text>
    </View>
  );
}
