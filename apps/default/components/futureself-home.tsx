import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useMutation } from "convex/react";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  CastMember,
  Choice,
  ChoiceOutcome,
  ConstellationStar,
  GameState,
  PersonaState,
} from "@/lib/futureself";
import {
  formatCastMember,
  futureSelfPlusPreview,
  isFutureSelfPlusCastMember,
} from "@/lib/futureself";
import { TransmissionPlayer } from "@/components/transmission-player";

interface FutureselfHomeProps {
  state: GameState;
  dateKey: string;
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

const wordNudges = [
  "threshold",
  "brave",
  "lighter",
  "repair",
  "momentum",
  "honest",
];
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

export function FutureselfHome({ state, dateKey }: FutureselfHomeProps) {
  const { signOut } = useAuthActions();
  const saveCheckIn = useMutation(api.game.saveCheckIn);
  const recordChoice = useMutation(api.game.recordChoice);
  const generateTransmission = useAction(api.game.generateDailyTransmission);

  // Debug mutations
  const debugReset = useMutation(api.game.debugResetPersona);
  const debugSetState = useMutation(api.game.debugSetGameState);

  const [word, setWord] = useState(state.todayCheckIn?.word ?? "");
  const [note, setNote] = useState(state.todayCheckIn?.note ?? "");
  const [isReceiving, setIsReceiving] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFlare, setShowFlare] = useState(false);
  const [flareColor, setFlareColor] = useState("#F7D38B");
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [celebrateNextTransmission, setCelebrateNextTransmission] =
    useState(false);
  const [showTransmissionArrival, setShowTransmissionArrival] = useState(false);
  const [forcedCastMember, setForcedCastMember] = useState<CastMember | null>(
    null,
  );
  const [selectedThreadId, setSelectedThreadId] =
    useState<Id<"narrativeThreads"> | null>(null);
  const [choiceOutcome, setChoiceOutcome] = useState<ChoiceOutcome | null>(
    null,
  );
  const arrivalPulse = useSharedValue(0);
  const arrivalSweep = useSharedValue(-280);

  const persona = state.persona;
  const litVoices = state.constellation.filter(
    (star) => star.state === "lit" || star.state === "dim",
  );
  const nextUnlock = useMemo(
    () => (persona ? getNextUnlock(persona, state.constellation) : null),
    [persona, state.constellation],
  );
  const previousTransmissions = useMemo(
    () =>
      state.recentTransmissions
        .filter(
          (transmission) => transmission.id !== state.todayTransmission?.id,
        )
        .slice(0, 3),
    [state.recentTransmissions, state.todayTransmission],
  );

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
      setError("Give today one word first. It becomes the key in the signal.");
      return;
    }
    setChoiceOutcome(null);
    setCelebrateNextTransmission(true);
    setIsReceiving(true);
    try {
      await saveCheckIn({
        dateKey,
        word: trimmedWord,
        note: note.trim() || undefined,
      });
      await generateTransmission({
        dateKey,
        localNow: new Date().toLocaleString(),
        forcedCastMember: forcedCastMember ?? undefined,
      });
      setForcedCastMember(null);
    } catch (caughtError) {
      setCelebrateNextTransmission(false);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not receive today's signal.",
      );
    } finally {
      setIsReceiving(false);
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
    setError(null);
    setForcedCastMember(castMember);
    await debugSetState({ clearToday: true });
    if (Platform.OS === "web") {
      window.alert(
        `Demo voice locked: ${formatCastMember(castMember)}. Today's signal was cleared so you can receive it now.`,
      );
    }
  }

  function openDemoVoiceMenu() {
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
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          entering={Platform.OS === "web" ? undefined : FadeInUp.duration(260)}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <Pressable onPress={handleDebugTap}>
              <View style={styles.signalBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.signalBadgeText}>daily signal</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => signOut()} style={styles.signOutButton}>
              <Ionicons name="log-out-outline" size={18} color="#C5CCE6" />
            </Pressable>
          </View>

          <Text style={styles.heroTitle}>
            Your future self has one message for today.
          </Text>
          <Text style={styles.heroCopy}>
            {persona?.name ? `${persona.name}, ` : ""}open the transmission,
            hear the voice when it arrives, make one small choice, and let
            tomorrow respond.
          </Text>

          {forcedCastMember ? (
            <View style={styles.demoLockPill}>
              <Ionicons name="radio-outline" size={14} color="#F7D38B" />
              <Text style={styles.demoLockText}>
                Demo voice locked: {formatCastMember(forcedCastMember)}
              </Text>
            </View>
          ) : null}

          <View style={styles.heroPromiseRow}>
            <MiniPromise icon="mic" label="spoken" />
            <MiniPromise icon="book" label="serial" />
            <MiniPromise icon="sparkles" label="personal" />
          </View>

          {persona ? (
            <View style={styles.heroStatsGrid}>
              <HeroStat
                icon="flame-outline"
                label="streak"
                value={`${persona.streak} day${persona.streak === 1 ? "" : "s"}`}
              />
              <HeroStat
                icon="git-branch-outline"
                label="divergence"
                value={getDivergenceLabel(persona.timelineDivergenceScore)}
              />
            </View>
          ) : null}
        </Animated.View>

        {state.todayTransmission ? (
          <Animated.View
            entering={ZoomIn.duration(400).springify().damping(15)}
            style={styles.transmissionShell}
          >
            <TransmissionPlayer transmission={state.todayTransmission} />
            {showTransmissionArrival ? (
              <Animated.View
                entering={FadeIn.duration(240)}
                exiting={FadeOut.duration(520)}
                pointerEvents="none"
                style={styles.transmissionArrivalOverlay}
              >
                <Animated.View
                  style={[
                    styles.transmissionArrivalSweep,
                    transmissionArrivalSweep,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.transmissionArrivalGlow,
                    transmissionArrivalGlow,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.transmissionArrivalCore,
                    transmissionArrivalCore,
                  ]}
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
                  {state.todayTransmission.audioUrl
                    ? "The voice has arrived."
                    : "The signal has landed."}
                </Animated.Text>
                <Animated.Text
                  entering={FadeInUp.delay(260).duration(340)}
                  style={styles.transmissionArrivalCopy}
                >
                  {state.todayTransmission.audioUrl
                    ? "Pause for a breath, then press play."
                    : "Read slowly. The next choice still changes tomorrow."}
                </Animated.Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View
            entering={
              Platform.OS === "web"
                ? undefined
                : FadeInUp.delay(80).duration(260)
            }
            style={styles.receiveCard}
          >
            <View style={styles.receiveHeader}>
              <View style={styles.receiveIcon}>
                <Ionicons name="key-outline" size={22} color="#F7D38B" />
              </View>
              <View style={styles.receiveHeaderCopy}>
                <Text style={styles.sectionTitle}>First, a key word.</Text>
                <Text style={styles.sectionCopy}>
                  Not journaling. Just one word that colors the voice and
                  sharpens the next transmission.
                </Text>
              </View>
            </View>

            <TextInput
              onChangeText={setWord}
              placeholder="threshold"
              placeholderTextColor="#6F7591"
              style={styles.wordInput}
              value={word}
            />
            <NudgeRow
              label="Borrow a word"
              options={wordNudges}
              onSelect={setWord}
              selected={word}
            />
            <TextInput
              multiline
              onChangeText={setNote}
              placeholder="Optional: one detail future-you should remember."
              placeholderTextColor="#6F7591"
              style={styles.noteInput}
              textAlignVertical="top"
              value={note}
            />
            <NudgeRow
              label="Or start with a detail"
              options={noteNudges}
              onSelect={setNote}
              selected={note}
            />
            <View style={styles.payoffRow}>
              <PayoffPill icon="mic-outline" label="voice adapts" />
              <PayoffPill icon="sparkles-outline" label="story sharpens" />
              <PayoffPill icon="trail-sign-outline" label="tomorrow changes" />
            </View>
            <View style={styles.contextNote}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#AEB6D4"
              />
              <Text style={styles.contextNoteText}>
                If audio keys are missing, the game still delivers a full
                written transmission so the ritual never stalls.
              </Text>
            </View>

            <Pressable
              disabled={isReceiving}
              onPress={handleReceive}
              style={({ pressed }) => [
                styles.receiveButton,
                pressed && styles.pressed,
              ]}
            >
              {isReceiving ? (
                <ActivityIndicator color="#101320" />
              ) : (
                <Text style={styles.receiveText}>Receive today's voice</Text>
              )}
            </Pressable>
          </Animated.View>
        )}

        {state.todayTransmission ? (
          <Animated.View
            entering={FadeInUp.delay(300)}
            style={styles.choiceCard}
          >
            <Text style={styles.sectionTitle}>Choose the timeline lean.</Text>
            <Text style={styles.sectionCopy}>
              {state.todayTransmission.actionPrompt}
            </Text>
            {state.openThreads.length > 0 ? (
              <View style={styles.threadTargetSection}>
                <Text style={styles.nudgeLabel}>Aim the move at a thread</Text>
                <View style={styles.threadTargetGrid}>
                  {state.openThreads.map((thread) => (
                    <Pressable
                      key={thread.id}
                      onPress={() => setSelectedThreadId(thread.id)}
                      style={[
                        styles.threadTargetChip,
                        selectedThreadId === thread.id &&
                          styles.threadTargetChipActive,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.threadTargetEyebrow,
                          selectedThreadId === thread.id &&
                            styles.threadTargetEyebrowActive,
                        ]}
                      >
                        {formatCastMember(thread.castMember)}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.threadTargetTitle,
                          selectedThreadId === thread.id &&
                            styles.threadTargetTitleActive,
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
                  onPress={() => handleChoice(choice)}
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
                  <Text style={styles.choiceOutcomeTitle}>
                    {choiceOutcome.summary}
                  </Text>
                </View>
                <Text style={styles.choiceOutcomeBody}>
                  {choiceOutcome.detail}
                </Text>
                {choiceOutcome.threadImpact ? (
                  <Text style={styles.choiceOutcomeMeta}>
                    {choiceOutcome.threadImpact}
                  </Text>
                ) : null}
                <Text style={styles.choiceOutcomeMeta}>
                  {choiceOutcome.stabilityImpact}
                </Text>
                <Text style={styles.choiceOutcomeMeta}>
                  {choiceOutcome.voiceShift}
                </Text>
              </View>
            ) : null}
            <Text style={styles.nudgeLabel}>
              If you're blank, borrow a tiny move:
            </Text>
            <View style={styles.actionNudgeGrid}>
              {actionNudges.map((nudge) => (
                <Pressable
                  key={nudge.label}
                  onPress={() => handleChoice(nudge.choice)}
                  style={({ pressed }) => [
                    styles.actionNudge,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name={nudge.icon} size={16} color="#F7D38B" />
                  <Text style={styles.actionNudgeText}>{nudge.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.contextNote}>
              <Ionicons name="git-compare-outline" size={16} color="#AEB6D4" />
              <Text style={styles.contextNoteText}>
                Toward, repair, and release help the timeline settle. Skipping
                the lean leaves more room for the shadow later.
              </Text>
            </View>
          </Animated.View>
        ) : null}

        <View style={styles.unlockCard}>
          <View style={styles.unlockHeader}>
            <Text style={styles.sectionTitle}>The cast is gathering.</Text>
            <Text style={styles.sectionCopy}>
              Every check-in and choice changes who can speak next.
            </Text>
          </View>

          {nextUnlock ? (
            <View style={styles.nextUnlockCard}>
              <View style={styles.nextUnlockHeader}>
                <View style={styles.nextUnlockBadge}>
                  <Ionicons name="sparkles-outline" size={15} color="#101320" />
                </View>
                <View style={styles.nextUnlockCopy}>
                  <Text style={styles.nextUnlockTitle}>
                    Next likely voice: {nextUnlock.label}
                  </Text>
                  <Text style={styles.nextUnlockText}>
                    {nextUnlock.requirement}
                  </Text>
                </View>
              </View>
              <Text style={styles.nextUnlockMood}>
                {nextUnlock.emotionalRegister}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.systemSignalsCard,
              state.systemSignals.approachingEventTone === "warning"
                ? styles.systemSignalsCardWarning
                : state.systemSignals.approachingEventTone === "rare"
                  ? styles.systemSignalsCardRare
                  : null,
            ]}
          >
            <Text style={styles.systemSignalsTitle}>What the system sees</Text>
            <View style={styles.systemSignalsEventCard}>
              <Text style={styles.systemSignalEyebrow}>Approaching event</Text>
              <Text style={styles.systemSignalsEventTitle}>
                {state.systemSignals.approachingEventTitle}
              </Text>
              <Text style={styles.systemSignalsEventBody}>
                {state.systemSignals.approachingEventNote}
              </Text>
            </View>
            <View style={styles.systemSignalsList}>
              <View style={styles.systemSignalItem}>
                <Text style={styles.systemSignalEyebrow}>Stability</Text>
                <Text style={styles.systemSignalHeading}>
                  {state.systemSignals.stabilityTitle}
                </Text>
                <Text style={styles.systemSignalBody}>
                  {state.systemSignals.stabilityNote}
                </Text>
              </View>
              <View style={styles.systemSignalItem}>
                <Text style={styles.systemSignalEyebrow}>Voice pressure</Text>
                <Text style={styles.systemSignalHeading}>
                  {state.systemSignals.voicePressureTitle}
                </Text>
                <Text style={styles.systemSignalBody}>
                  {state.systemSignals.voicePressureNote}
                </Text>
              </View>
              <View style={styles.systemSignalItem}>
                <Text style={styles.systemSignalEyebrow}>Threads</Text>
                <Text style={styles.systemSignalHeading}>
                  {state.systemSignals.threadPressureTitle}
                </Text>
                <Text style={styles.systemSignalBody}>
                  {state.systemSignals.threadPressureNote}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.voiceGrid}>
            {state.constellation.map((star) => (
              <VoiceOrb key={star.castMember} star={star} />
            ))}
          </View>

          <View style={styles.futureSelfPlusCard}>
            <View style={styles.futureSelfPlusHeader}>
              <View style={styles.futureSelfPlusBadge}>
                <Text style={styles.futureSelfPlusBadgeText}>FutureSelf+</Text>
              </View>
              <Text style={styles.futureSelfPlusTitle}>
                The wider constellation
              </Text>
            </View>
            <Text style={styles.futureSelfPlusCopy}>
              The core ritual stays clean and free. FutureSelf+ is where the
              wider mythology can expand later: rarer voices, stranger
              timelines, and richer atmospheres that deepen the world without
              interrupting the daily practice.
            </Text>
            <View style={styles.futureSelfPlusList}>
              {futureSelfPlusPreview.constellation.map((item) => (
                <View key={item} style={styles.futureSelfPlusItem}>
                  <Ionicons name="sparkles-outline" size={14} color="#F7D38B" />
                  <Text style={styles.futureSelfPlusItemText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {state.openThreads.length > 0 ? (
          <View style={styles.storyCard}>
            <Text style={styles.sectionTitle}>Open threads</Text>
            <Text style={styles.sectionCopy}>
              These are the lines your next transmissions can tug on.
            </Text>
            <View style={styles.storyList}>
              {state.openThreads.map((thread) => (
                <View key={thread.id} style={styles.storyItem}>
                  <Text style={styles.storyEyebrow}>
                    {formatCastMember(thread.castMember)}
                  </Text>
                  <Text style={styles.storyTitle}>{thread.title}</Text>
                  <Text style={styles.storyBody}>{thread.seed}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {previousTransmissions.length > 0 ? (
          <View style={styles.storyCard}>
            <Text style={styles.sectionTitle}>Previously in your timeline</Text>
            <Text style={styles.sectionCopy}>
              A quick memory trail so the story feels serial, not disposable.
            </Text>
            <View style={styles.storyList}>
              {previousTransmissions.map((transmission) => (
                <View key={transmission.id} style={styles.storyItem}>
                  <Text style={styles.storyEyebrow}>
                    {formatCastMember(transmission.castMember)}
                  </Text>
                  <Text style={styles.storyTitle}>{transmission.title}</Text>
                  <Text style={styles.storyBody}>
                    {transmission.cliffhanger}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.archivePreviewCard}>
              <View style={styles.futureSelfPlusHeader}>
                <View style={styles.futureSelfPlusBadge}>
                  <Text style={styles.futureSelfPlusBadgeText}>
                    FutureSelf+
                  </Text>
                </View>
                <Text style={styles.futureSelfPlusTitle}>Archive depth</Text>
              </View>
              <Text style={styles.futureSelfPlusCopy}>
                The premium logic is depth, not interruption: a full archive,
                persistent memory across threads, and replayable transmissions
                that make the relationship feel cumulative over time.
              </Text>
              <View style={styles.futureSelfPlusList}>
                {futureSelfPlusPreview.archive.map((item) => (
                  <View key={item} style={styles.futureSelfPlusItem}>
                    <Ionicons name="time-outline" size={14} color="#F7D38B" />
                    <Text style={styles.futureSelfPlusItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {litVoices.length > 1 ? (
          <Text style={styles.footnote}>
            {litVoices.length} voices are close enough to hear you right now.
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {/* Timeline Flare Overlay */}
      {showFlare && (
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
      )}
    </View>
  );
}

interface MiniPromiseProps {
  icon: keyof typeof Ionicons.glyphMap;
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
  icon: keyof typeof Ionicons.glyphMap;
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

interface PayoffPillProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

function PayoffPill({ icon, label }: PayoffPillProps) {
  return (
    <View style={styles.payoffPill}>
      <Ionicons name={icon} size={14} color="#101320" />
      <Text style={styles.payoffText}>{label}</Text>
    </View>
  );
}

interface VoiceOrbProps {
  star: ConstellationStar;
}

function VoiceOrb({ star }: VoiceOrbProps) {
  const isUnlocked = star.state === "lit" || star.state === "dim";
  const isFutureSelfPlus = isFutureSelfPlusCastMember(star.castMember);
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
            isUnlocked
              ? "radio"
              : star.state === "quiet"
                ? "moon"
                : "lock-closed"
          }
          size={16}
          color={isUnlocked ? "#101320" : "#F7D38B"}
        />
        {isFutureSelfPlus ? (
          <View style={styles.voicePlusBadge}>
            <Text style={styles.voicePlusBadgeText}>+</Text>
          </View>
        ) : null}
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
  };
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 42,
    gap: 16,
  },
  hero: {
    gap: 18,
    padding: 24,
    borderRadius: 36,
    borderCurve: "continuous",
    backgroundColor: "rgba(14,17,34,0.84)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.2)",
    boxShadow: "0 22px 64px rgba(0,0,0,0.32)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  signalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "rgba(247,211,139,0.12)",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F7D38B",
  },
  signalBadgeText: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  signOutButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  heroTitle: {
    color: "#F8F0DE",
    fontSize: 38,
    lineHeight: 41,
    fontWeight: "900",
    letterSpacing: -1.45,
  },
  heroCopy: {
    color: "#BFC6DE",
    fontSize: 16,
    lineHeight: 24,
  },
  heroPromiseRow: {
    flexDirection: "row",
    gap: 9,
    flexWrap: "wrap",
  },
  demoLockPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(247,211,139,0.12)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.22)",
  },
  demoLockText: {
    color: "#F7D38B",
    fontSize: 12,
    fontWeight: "800",
  },
  miniPromise: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  miniPromiseText: {
    color: "#F8F0DE",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroStatsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    gap: 8,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroStatLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroStatLabel: {
    color: "#AEB6D4",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroStatValue: {
    color: "#F8F0DE",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  transmissionShell: {
    position: "relative",
  },
  transmissionArrivalOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: "rgba(8,10,23,0.68)",
    paddingHorizontal: 24,
  },
  transmissionArrivalSweep: {
    position: "absolute",
    width: 120,
    height: "150%",
    backgroundColor: "rgba(247,211,139,0.16)",
    borderRadius: 999,
  },
  transmissionArrivalGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(247,211,139,0.18)",
  },
  transmissionArrivalCore: {
    position: "absolute",
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: "rgba(247,211,139,0.16)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.3)",
  },
  transmissionArrivalStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 2,
  },
  transmissionArrivalStar: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F7D38B",
    shadowColor: "#F7D38B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  transmissionArrivalStarSmall: {
    width: 5,
    height: 5,
    borderRadius: 3,
    opacity: 0.8,
  },
  transmissionArrivalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(247,211,139,0.14)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.24)",
  },
  transmissionArrivalDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F7D38B",
  },
  transmissionArrivalEyebrow: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  transmissionArrivalTitle: {
    color: "#F8F0DE",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  transmissionArrivalCopy: {
    maxWidth: 260,
    color: "#D6DCEF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  receiveCard: {
    gap: 14,
    padding: 18,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: "rgba(246,240,222,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.18)",
  },
  receiveHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  receiveHeaderCopy: {
    flex: 1,
    gap: 5,
  },
  receiveIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,211,139,0.12)",
  },
  sectionTitle: {
    color: "#F8F0DE",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.55,
  },
  sectionCopy: {
    color: "#AEB6D4",
    fontSize: 14,
    lineHeight: 20,
  },
  wordInput: {
    minHeight: 58,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#F8F0DE",
    paddingHorizontal: 17,
    fontSize: 22,
    fontWeight: "900",
  },
  noteInput: {
    minHeight: 82,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#F8F0DE",
    padding: 15,
    fontSize: 15,
    lineHeight: 21,
  },
  nudgeWrap: {
    gap: 8,
  },
  nudgeLabel: {
    color: "#8F96B4",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  nudgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  nudgeChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  nudgeChipActive: {
    backgroundColor: "rgba(247,211,139,0.18)",
    borderColor: "rgba(247,211,139,0.45)",
  },
  nudgeText: {
    color: "#AEB6D4",
    fontSize: 12,
    fontWeight: "800",
  },
  nudgeTextActive: {
    color: "#F7D38B",
  },
  payoffRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  payoffPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F7D38B",
  },
  payoffText: {
    color: "#101320",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  receiveButton: {
    minHeight: 56,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "#F7D38B",
    alignItems: "center",
    justifyContent: "center",
  },
  receiveText: {
    color: "#101320",
    fontSize: 16,
    fontWeight: "900",
  },
  choiceCard: {
    gap: 12,
    padding: 18,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: "rgba(14,17,34,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  threadTargetSection: {
    gap: 8,
  },
  threadTargetGrid: {
    gap: 10,
  },
  threadTargetChip: {
    gap: 5,
    padding: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  threadTargetChipActive: {
    backgroundColor: "rgba(247,211,139,0.14)",
    borderColor: "rgba(247,211,139,0.3)",
  },
  threadTargetEyebrow: {
    color: "#8F96B4",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  threadTargetEyebrowActive: {
    color: "#F7D38B",
  },
  threadTargetTitle: {
    color: "#D7DCEE",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  threadTargetTitleActive: {
    color: "#F8F0DE",
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceOutcomeCard: {
    gap: 8,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(247,211,139,0.09)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.18)",
  },
  choiceOutcomeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  choiceOutcomeTitle: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "900",
  },
  choiceOutcomeBody: {
    color: "#D8DDF0",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  choiceOutcomeMeta: {
    color: "#F6DDA9",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  actionNudgeGrid: {
    gap: 8,
  },
  actionNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(247,211,139,0.1)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.16)",
  },
  actionNudgeText: {
    color: "#F6DDA9",
    fontSize: 13,
    fontWeight: "800",
  },
  choiceButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  choiceButtonActive: {
    backgroundColor: "rgba(247,211,139,0.18)",
    borderColor: "rgba(247,211,139,0.45)",
  },
  choiceText: {
    color: "#AEB6D4",
    fontWeight: "800",
  },
  choiceTextActive: {
    color: "#F7D38B",
  },
  unlockCard: {
    gap: 14,
    padding: 18,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  unlockHeader: {
    gap: 5,
  },
  nextUnlockCard: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(247,211,139,0.1)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.18)",
  },
  nextUnlockHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  nextUnlockBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F7D38B",
    alignItems: "center",
    justifyContent: "center",
  },
  nextUnlockCopy: {
    flex: 1,
    gap: 4,
  },
  nextUnlockTitle: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "900",
  },
  nextUnlockText: {
    color: "#D2D8EE",
    fontSize: 13,
    lineHeight: 18,
  },
  nextUnlockMood: {
    color: "#F7D38B",
    fontSize: 12,
    fontWeight: "800",
  },
  systemSignalsCard: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  systemSignalsCardWarning: {
    borderColor: "rgba(255,154,154,0.2)",
    backgroundColor: "rgba(255,154,154,0.05)",
  },
  systemSignalsCardRare: {
    borderColor: "rgba(247,211,139,0.22)",
    backgroundColor: "rgba(247,211,139,0.06)",
  },
  systemSignalsEventCard: {
    gap: 5,
    padding: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(14,17,34,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  systemSignalsEventTitle: {
    color: "#F8F0DE",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  systemSignalsEventBody: {
    color: "#D7DCEE",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  systemSignalsTitle: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "900",
  },
  systemSignalsList: {
    gap: 10,
  },
  systemSignalItem: {
    gap: 4,
  },
  systemSignalEyebrow: {
    color: "#8F96B4",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  systemSignalHeading: {
    color: "#F6DDA9",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  systemSignalBody: {
    color: "#D2D8EE",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  voiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  voiceOrbWrap: {
    width: "30%",
    minWidth: 92,
    flexGrow: 1,
    alignItems: "center",
    gap: 7,
  },
  voiceOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,211,139,0.11)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.18)",
  },
  voiceOrbUnlocked: {
    backgroundColor: "#F7D38B",
    borderColor: "#F7D38B",
  },
  voiceOrbQuiet: {
    backgroundColor: "rgba(247,211,139,0.08)",
    borderColor: "rgba(247,211,139,0.26)",
  },
  voicePlusBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#101320",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  voicePlusBadgeText: {
    color: "#F7D38B",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 10,
  },
  voiceLabel: {
    color: "#F8F0DE",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "800",
  },
  voiceHint: {
    color: "#8F96B4",
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
    fontWeight: "700",
  },
  storyCard: {
    gap: 12,
    padding: 18,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: "rgba(14,17,34,0.66)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  futureSelfPlusCard: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.14)",
  },
  archivePreviewCard: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.12)",
  },
  futureSelfPlusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  futureSelfPlusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(247,211,139,0.14)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.22)",
  },
  futureSelfPlusBadgeText: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  futureSelfPlusTitle: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "900",
  },
  futureSelfPlusCopy: {
    color: "#BFC6DE",
    fontSize: 13,
    lineHeight: 19,
  },
  futureSelfPlusList: {
    gap: 8,
  },
  futureSelfPlusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  futureSelfPlusItemText: {
    color: "#D7DCEE",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  storyList: {
    gap: 10,
  },
  storyItem: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  storyEyebrow: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  storyTitle: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "900",
  },
  storyBody: {
    color: "#BFC6DE",
    fontSize: 13,
    lineHeight: 19,
  },
  contextNote: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.055)",
  },
  contextNoteText: {
    flex: 1,
    color: "#AEB6D4",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  footnote: {
    color: "#8F96B4",
    fontSize: 12,
    textAlign: "center",
  },
  error: {
    color: "#FF9A9A",
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  flareGlow: {
    position: "absolute",
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    borderWidth: 40,
    borderRadius: 999,
    opacity: 0.3,
  },
});
