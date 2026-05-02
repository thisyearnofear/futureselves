import { useState } from "react";
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
import Animated, { FadeIn, FadeInUp, FadeOut, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  CastMember,
  Choice,
  ChoiceOutcome,
  ConstellationStar,
  PersonaState,
  StateSignals,
  ThreadState,
  TransmissionState,
} from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";
import { TransmissionPlayer } from "@/components/transmission-player";
import { styles } from "@/components/futureself-home.styles";

type IconName = keyof typeof Ionicons.glyphMap;

interface ActionNudge {
  label: string;
  choice: Choice;
  icon: IconName;
}

interface NextUnlock {
  label: string;
  requirement: string;
  emotionalRegister: string;
}

interface HeroSectionProps {
  hasTransmissionToday: boolean;
  shouldShowSystemDepth: boolean;
  persona: PersonaState | null;
  isDebugMode: boolean;
  forcedCastMember: CastMember | null;
  divergenceLabel: string;
  onDebugTap: () => void;
  onOpenSettings: () => void;
}

export function HeroSection({
  hasTransmissionToday,
  shouldShowSystemDepth,
  persona,
  isDebugMode,
  forcedCastMember,
  divergenceLabel,
  onDebugTap,
  onOpenSettings,
}: HeroSectionProps) {
  return (
    <Animated.View
      entering={Platform.OS === "web" ? undefined : FadeInUp.duration(260)}
      style={styles.hero}
    >
      <View style={styles.heroTopStack}>
        <Pressable disabled={!isDebugMode} onPress={onDebugTap}>
          <View style={styles.signalBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.signalBadgeText}>daily signal</Text>
          </View>
        </Pressable>
        <Pressable onPress={onOpenSettings} style={styles.settingsEntry}>
          <Ionicons name="settings-outline" size={16} color="#F8F0DE" />
          <Text style={styles.settingsEntryText}>Ritual settings</Text>
        </Pressable>
      </View>

      <Text style={styles.heroTitle}>
        {hasTransmissionToday ? "The voice has arrived." : "One word is enough."}
      </Text>
      <Text style={styles.heroCopy}>
        {hasTransmissionToday
          ? "Make one small choice. Tomorrow responds."
          : "Give today one word. The signal will find the rest."}
      </Text>

      {isDebugMode && forcedCastMember ? (
        <View style={styles.demoLockPill}>
          <Ionicons name="radio-outline" size={14} color="#F7D38B" />
          <Text style={styles.demoLockText}>
            Demo voice locked: {formatCastMember(forcedCastMember)}
          </Text>
        </View>
      ) : null}

      {shouldShowSystemDepth ? (
        <View style={styles.heroPromiseRow}>
          <MiniPromise icon="mic" label="spoken" />
          <MiniPromise icon="book" label="serial" />
          <MiniPromise icon="sparkles" label="personal" />
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
              {transmission.audioUrl ? "The voice has arrived." : "The signal has landed."}
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
          <Text style={styles.shareButtonText}>{shareStatus ?? "Share this signal"}</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

interface ReceiveSignalSectionProps {
  isReceiving: boolean;
  word: string;
  note: string;
  showDetailInput: boolean;
  wordNudges: Array<string>;
  noteNudges: Array<string>;
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
  onWordChange,
  onNoteChange,
  onToggleDetail,
  onReceive,
}: ReceiveSignalSectionProps) {
  return (
    <Animated.View
      entering={Platform.OS === "web" ? undefined : FadeInUp.delay(80).duration(260)}
      style={styles.receiveCard}
    >
      <View style={styles.receiveHeader}>
        <View style={styles.receiveIcon}>
          <Ionicons name="key-outline" size={22} color="#F7D38B" />
        </View>
        <View style={styles.receiveHeaderCopy}>
          <Text style={styles.sectionTitle}>Give today one word.</Text>
          <Text style={styles.sectionCopy}>
            One word is enough. Future-you will find the rest.
          </Text>
        </View>
      </View>

      <TextInput
        onChangeText={onWordChange}
        placeholder="threshold"
        placeholderTextColor="#6F7591"
        style={styles.wordInput}
        value={word}
      />
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

      <Pressable
        disabled={isReceiving}
        onPress={onReceive}
        style={({ pressed }) => [styles.receiveButton, pressed && styles.pressed]}
      >
        {isReceiving ? (
          <ActivityIndicator color="#101320" />
        ) : (
          <Text style={styles.receiveText}>Receive today&apos;s voice</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

interface ChoiceSectionProps {
  transmission: TransmissionState;
  openThreads: Array<ThreadState>;
  selectedThreadId: Id<"narrativeThreads"> | null;
  selectedChoice: Choice | null;
  choiceOutcome: ChoiceOutcome | null;
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
  shouldShowStoryDepth,
  shouldShowSystemDepth,
  choiceCopy,
  actionNudges,
  onSelectThread,
  onChoice,
}: ChoiceSectionProps) {
  return (
    <Animated.View entering={FadeInUp.delay(300)} style={styles.choiceCard}>
      <Text style={styles.sectionTitle}>Choose the timeline lean.</Text>
      <Text style={styles.sectionCopy}>{transmission.actionPrompt}</Text>
      {openThreads.length > 0 ? (
        <View style={styles.threadTargetSection}>
          <Text style={styles.nudgeLabel}>Aim the move at a thread</Text>
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
      <View style={styles.choiceGrid}>
        {(Object.keys(choiceCopy) as Array<Choice>).map((choice) => (
          <Pressable
            key={choice}
            onPress={() => onChoice(choice)}
            style={[
              styles.choiceButton,
              selectedChoice === choice && styles.choiceButtonActive,
            ]}
          >
            <Text
              style={[
                styles.choiceText,
                selectedChoice === choice && styles.choiceTextActive,
              ]}
            >
              {choiceCopy[choice]}
            </Text>
          </Pressable>
        ))}
      </View>
      {choiceOutcome ? (
        <View style={styles.choiceOutcomeCard}>
          <View style={styles.choiceOutcomeHeader}>
            <Ionicons name="sparkles-outline" size={16} color="#F7D38B" />
            <Text style={styles.choiceOutcomeTitle}>{choiceOutcome.summary}</Text>
          </View>
          <Text style={styles.choiceOutcomeBody}>{choiceOutcome.detail}</Text>
          {choiceOutcome.threadImpact ? (
            <Text style={styles.choiceOutcomeMeta}>{choiceOutcome.threadImpact}</Text>
          ) : null}
          <Text style={styles.choiceOutcomeMeta}>{choiceOutcome.stabilityImpact}</Text>
          <Text style={styles.choiceOutcomeMeta}>{choiceOutcome.voiceShift}</Text>
        </View>
      ) : null}
      {shouldShowStoryDepth ? (
        <Text style={styles.nudgeLabel}>If you&apos;re blank, borrow a tiny move:</Text>
      ) : null}
      {shouldShowStoryDepth ? (
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
      ) : null}
      {shouldShowSystemDepth ? (
        <View style={styles.contextNote}>
          <Ionicons name="git-compare-outline" size={16} color="#AEB6D4" />
          <Text style={styles.contextNoteText}>
            Toward, repair, and release help the timeline settle. Skipping the lean
            leaves more room for the shadow later.
          </Text>
        </View>
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
}: ProgressionSectionProps) {
  if (!shouldShowStoryDepth) return null;

  return (
    <View style={styles.unlockCard}>
      <View style={styles.unlockHeader}>
        <Text style={styles.sectionTitle}>A voice is moving closer.</Text>
        <Text style={styles.sectionCopy}>
          You do not need the whole map yet. One nearby signal is enough.
        </Text>
      </View>

      {nextUnlock ? (
        <View style={styles.nextUnlockCard}>
          <View style={styles.nextUnlockHeader}>
            <View style={styles.nextUnlockBadge}>
              <Ionicons name="sparkles-outline" size={15} color="#101320" />
            </View>
            <View style={styles.nextUnlockCopy}>
              <Text style={styles.nextUnlockTitle}>Nearing: {nextUnlock.label}</Text>
              <Text style={styles.nextUnlockText}>{nextUnlock.requirement}</Text>
            </View>
          </View>
          <Text style={styles.nextUnlockMood}>{nextUnlock.emotionalRegister}</Text>
        </View>
      ) : null}

      {shouldShowSystemDepth ? (
        <View
          style={[
            styles.systemSignalsCard,
            systemSignals.approachingEventTone === "warning"
              ? styles.systemSignalsCardWarning
              : systemSignals.approachingEventTone === "rare"
                ? styles.systemSignalsCardRare
                : null,
          ]}
        >
          <Text style={styles.systemSignalsTitle}>What the system sees</Text>
          <View style={styles.systemSignalsEventCard}>
            <Text style={styles.systemSignalEyebrow}>Approaching event</Text>
            <Text style={styles.systemSignalsEventTitle}>
              {systemSignals.approachingEventTitle}
            </Text>
            <Text style={styles.systemSignalsEventBody}>
              {systemSignals.approachingEventNote}
            </Text>
          </View>
          <View style={styles.systemSignalsList}>
            <SignalItem
              eyebrow="Stability"
              title={systemSignals.stabilityTitle}
              body={systemSignals.stabilityNote}
            />
            <SignalItem
              eyebrow="Voice pressure"
              title={systemSignals.voicePressureTitle}
              body={systemSignals.voicePressureNote}
            />
            <SignalItem
              eyebrow="Threads"
              title={systemSignals.threadPressureTitle}
              body={systemSignals.threadPressureNote}
            />
          </View>
        </View>
      ) : null}

      {shouldShowSystemDepth ? (
        <View style={styles.voiceGrid}>
          {constellation.map((star) => (
            <VoiceOrb key={star.castMember} star={star} />
          ))}
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
  title = "Your first signal is in motion.",
  body = "Refine the ritual when you’re ready: voice tone, timeline depth, and rare-voice consent now live in settings.",
  buttonLabel = "Refine your ritual",
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

interface MiniPromiseProps {
  icon: IconName;
  label: string;
}

function MiniPromise({ icon, label }: MiniPromiseProps) {
  return (
    <View style={styles.miniPromise}>
      <Ionicons name={icon} size={15} color="#F7D38B" />
      <Text style={styles.miniPromiseText}>{label}</Text>
    </View>
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
      <View
        style={[
          styles.voiceOrb,
          isUnlocked && styles.voiceOrbUnlocked,
          star.state === "quiet" && styles.voiceOrbQuiet,
        ]}
      >
        <Ionicons
          name={
            isUnlocked ? "radio" : star.state === "quiet" ? "moon" : "lock-closed"
          }
          size={16}
          color={isUnlocked ? "#101320" : "#F7D38B"}
        />
      </View>
      <Text numberOfLines={2} style={styles.voiceLabel}>
        {star.label}
      </Text>
      <Text numberOfLines={2} style={styles.voiceHint}>
        {star.unlockHint}
      </Text>
    </View>
  );
}
