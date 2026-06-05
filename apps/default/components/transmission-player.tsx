import { useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeInUp,
  FadeIn,
} from "react-native-reanimated";
import type { CastMember, TransmissionState } from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";
import { AvatarReveal } from "@/components/avatar-reveal";
import { isLocalMode } from "@/lib/ai";
import { loadQvacSdk } from "@/lib/qvac-sdk-loader";
import { useLocalTTS } from "@/lib/qvac";
import { getCachedAudio, setCachedAudio } from "@/lib/audio-cache";

// ─── Constants ───────────────────────────────────────────────────────────────

const reactionOptions: Array<{
  key: "landed" | "not_quite" | "did_it" | "keep_close";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "landed", label: "This landed", icon: "heart-outline" },
  { key: "not_quite", label: "Not quite", icon: "remove-circle-outline" },
  { key: "did_it", label: "I did it", icon: "checkmark-circle-outline" },
  { key: "keep_close", label: "Keep close", icon: "bookmark-outline" },
];

const AURA_COLORS: Partial<Record<CastMember, string>> = {
  future_self: "rgba(247,211,139,0.25)",
  future_partner: "rgba(244,164,170,0.25)",
  future_mentor: "rgba(160,180,210,0.25)",
  future_best_friend: "rgba(210,180,140,0.25)",
  shadow: "rgba(120,80,160,0.3)",
  alternate_self: "rgba(180,160,220,0.25)",
  future_employee: "rgba(220,220,240,0.2)",
  future_child: "rgba(200,180,220,0.2)",
  the_ceiling: "rgba(180,180,170,0.2)",
  the_ghost: "rgba(220,220,220,0.15)",
  the_dissolver: "rgba(200,200,220,0.15)",
};

const DEFAULT_AURA = "rgba(247,211,139,0.2)";

const ambientAssets: Record<string, number> = {
  future_self: require("@/assets/audio/room-tone.mp3"),
  future_partner: require("@/assets/audio/tender-pads.mp3"),
  future_mentor: require("@/assets/audio/spacious-hum.mp3"),
  shadow: require("@/assets/audio/shadow-wind.mp3"),
  alternate_self: require("@/assets/audio/uncanny-resonance.mp3"),
};
const defaultAmbient: number = require("@/assets/audio/room-tone.mp3");

// ─── Arrival Phases ──────────────────────────────────────────────────────────

type ArrivalPhase = "liminal" | "gathering" | "whisper" | "reveal" | "complete";

const PHASE_DURATIONS: Record<Exclude<ArrivalPhase, "complete">, number> = {
  liminal: 2800,
  gathering: 4200,
  whisper: 5000,
  reveal: 0,
};

const PHASE_LINES: Record<Exclude<ArrivalPhase, "complete">, string> = {
  liminal: "Someone is reaching back\u2026",
  gathering: "",
  whisper: "",
  reveal: "",
};

const GATHERING_LINES: Record<string, string> = {
  future_self: "Your future self is composing a thought\u2026",
  future_partner: "Someone close is thinking of you\u2026",
  future_mentor: "A voice of experience is forming\u2026",
  shadow: "Something honest is gathering\u2026",
  alternate_self: "A different version is reaching\u2026",
};

const DEFAULT_GATHERING = "Your future self is composing\u2026";

// ─── TransmissionPlayer ──────────────────────────────────────────────────────

interface TransmissionPlayerProps {
  transmission: TransmissionState;
  isSavingResponse: boolean;
  onSaveResponse: (payload: {
    reaction?: "landed" | "not_quite" | "did_it" | "keep_close";
    replyNote?: string;
  }) => Promise<void>;
}

export function TransmissionPlayer({
  transmission,
  isSavingResponse,
  onSaveResponse,
}: TransmissionPlayerProps) {
  const [isReplyOpen, setIsReplyOpen] = useState(Boolean(transmission.response?.replyNote));
  const [replyNote, setReplyNote] = useState(transmission.response?.replyNote ?? "");
  const router = useRouter();

  useEffect(() => {
    setReplyNote(transmission.response?.replyNote ?? "");
    setIsReplyOpen(Boolean(transmission.response?.replyNote));
  }, [transmission.response?.replyNote]);

  const isInArrival = transmission.status === "generating" || transmission.status === "text_ready";

  const statusLabel = useMemo(() => {
    if (transmission.audioUrl) return "transmission";
    if (transmission.status === "text_ready") return "words ready";
    if (transmission.status === "generating") return "composing";
    return "text only";
  }, [transmission.audioUrl, transmission.status]);

  const driftY = useSharedValue(0);
  useEffect(() => {
    driftY.value = withRepeat(
      withTiming(-3, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);
  const cliffhangerDrift = useAnimatedStyle(() => ({
    transform: [{ translateY: driftY.value }],
  }));

  const dotPulse = useSharedValue(1);
  useEffect(() => {
    dotPulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, []);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotPulse.value }));

  const breatheOpacity = useSharedValue(0);
  useEffect(() => {
    breatheOpacity.value = withRepeat(
      withTiming(0.8, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);
  const breatheStyle = useAnimatedStyle(() => ({ opacity: breatheOpacity.value }));

  return (
    <LinearGradient
      colors={["rgba(246,240,222,0.12)", "rgba(247,211,139,0.04)", "rgba(16,19,32,0.15)"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.card}
    >
      <AnimatedReanimated.View 
        style={[StyleSheet.absoluteFill, breatheStyle, { backgroundColor: AURA_COLORS[transmission.castMember] ?? DEFAULT_AURA, borderRadius: 24 }]} 
        pointerEvents="none" 
      />
      <AnimatedReanimated.View entering={FadeInUp.duration(260)} style={styles.headerWrap}>
        <AvatarReveal castMember={transmission.castMember} size={180} />
        <View style={styles.headerCopy}>
          <Text style={styles.cast}>{formatCastMember(transmission.castMember)}</Text>
          {isInArrival ? null : (
            <Text style={styles.title}>{transmission.title}</Text>
          )}
        </View>
        <View style={styles.livePill}>
          <AnimatedReanimated.View style={[styles.liveDot, dotStyle]} />
          <Text style={styles.liveText}>{statusLabel}</Text>
        </View>
      </AnimatedReanimated.View>

      {isInArrival ? (
        <ArrivalSequence
          status={transmission.status}
          castMember={transmission.castMember}
          title={transmission.title}
          text={transmission.text}
          cliffhanger={transmission.cliffhanger}
          audioUrl={transmission.audioUrl}
        />
      ) : (
        <>
          {transmission.audioUrl ? (
            <AnimatedReanimated.View entering={FadeIn.duration(500)}>
              <AudioPlayer
                audioUrl={transmission.audioUrl}
                title={transmission.title}
                castMember={transmission.castMember}
                transmission={transmission}
              />
            </AnimatedReanimated.View>
          ) : (
            <TextOnlyNotice />
          )}

          <AnimatedReanimated.Text entering={FadeIn.delay(800).duration(2400)} style={styles.body}>
            {transmission.text}
          </AnimatedReanimated.Text>
          <AnimatedReanimated.View
            entering={FadeInUp.delay(1800).duration(1200)}
            style={[styles.cliffhangerCard, cliffhangerDrift]}
          >
            <Ionicons name="moon" size={17} color="#F7D38B" />
            <Text style={styles.cliffhanger}>{transmission.cliffhanger}</Text>
          </AnimatedReanimated.View>
        </>
      )}

      {transmission.continuity?.rewardLabel ? (
        <AnimatedReanimated.View entering={FadeInUp.delay(200).duration(260)} style={styles.rewardBadge}>
          <Ionicons name="sparkles" size={12} color="#C8A84B" />
          <Text style={styles.rewardBadgeText}>{transmission.continuity.rewardLabel}</Text>
        </AnimatedReanimated.View>
      ) : null}

      {transmission.memory?.resurfacedTitle ? (
        <Pressable
          onPress={() => router.push("/archive" as never)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <AnimatedReanimated.View entering={FadeInUp.delay(200).duration(260)} style={styles.memoryBanner}>
            <Ionicons name="git-commit-outline" size={13} color="#A0B4D0" />
            <Text style={styles.memoryBannerText}>
              <Text style={styles.memoryBannerTitle}>{transmission.memory.resurfacedTitle}</Text>
              {transmission.memory.resurfacedReason
                ? ` · ${transmission.memory.resurfacedReason}`
                : ""}
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#7E86A6" />
          </AnimatedReanimated.View>
        </Pressable>
      ) : null}

      <AnimatedReanimated.View entering={FadeInUp.delay(240).duration(280)} style={styles.responseCard}>
        <Text style={styles.responseTitle}>Write back to yourself.</Text>
        <Text style={styles.responseCopy}>
          Let the line become a correspondence, not just a message.
        </Text>
        {transmission.continuity?.callbackLine ? (
          <Text style={styles.continuityHint}>{transmission.continuity.callbackLine}</Text>
        ) : null}
        <View style={styles.reactionGrid}>
          {reactionOptions.map((option) => {
            const active = transmission.response?.reaction === option.key;
            return (
              <Pressable
                key={option.key}
                disabled={isSavingResponse}
                onPress={() => void onSaveResponse({ reaction: option.key, replyNote })}
                style={({ pressed }) => [
                  styles.reactionButton,
                  active && styles.reactionButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={15}
                  color={active ? "#101320" : "#F7D38B"}
                />
                <Text
                  style={[
                    styles.reactionText,
                    active && styles.reactionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setIsReplyOpen((current) => !current)}
          style={({ pressed }) => [styles.replyToggle, pressed && styles.pressed]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={15} color="#F7D38B" />
          <Text style={styles.replyToggleText}>
            {isReplyOpen ? "Hide your note back" : "Write back"}
          </Text>
        </Pressable>

        {isReplyOpen ? (
          <View style={styles.replyComposer}>
            <TextInput
              multiline
              onChangeText={setReplyNote}
              placeholder="What do you want future-you to know back?"
              placeholderTextColor="#7E86A6"
              style={styles.replyInput}
              textAlignVertical="top"
              value={replyNote}
            />
            <Pressable
              disabled={isSavingResponse || replyNote.trim().length === 0}
              onPress={() =>
                void onSaveResponse({
                  reaction: transmission.response?.reaction,
                  replyNote,
                })
              }
              style={({ pressed }) => [
                styles.replySubmit,
                (isSavingResponse || replyNote.trim().length === 0) &&
                  styles.replySubmitDisabled,
                pressed && styles.pressed,
              ]}
            >
              {isSavingResponse ? (
                <ActivityIndicator color="#101320" />
              ) : (
                <>
                  <Text style={styles.replySubmitText}>Send note back</Text>
                  <Ionicons name="arrow-up-outline" size={15} color="#101320" />
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </AnimatedReanimated.View>

      <View style={styles.brandFooter}>
        <Text style={styles.brandText}>futureself</Text>
      </View>
    </LinearGradient>
  );
}

// ─── Arrival Sequence ────────────────────────────────────────────────────────

interface ArrivalSequenceProps {
  status: TransmissionState["status"];
  castMember: CastMember;
  title: string;
  text: string;
  cliffhanger: string;
  audioUrl: string | null;
}

function ArrivalSequence({
  status,
  castMember,
  title,
  text,
  cliffhanger,
}: ArrivalSequenceProps) {
  const [phase, setPhase] = useState<ArrivalPhase>("liminal");
  const [whisperText, setWhisperText] = useState("");
  const [typewriterPos, setTypewriterPos] = useState(0);
  const phaseRef = useRef<ArrivalPhase>("liminal");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whisperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const auraColor = AURA_COLORS[castMember] ?? DEFAULT_AURA;

  // Breathing orb animation
  const orbPulse = useSharedValue(1);
  const orbGlow = useSharedValue(0.3);
  useEffect(() => {
    if (phase === "reveal" || phase === "complete") {
      orbPulse.value = withTiming(1.1, { duration: 400 });
      orbGlow.value = withTiming(0, { duration: 600 });
    } else {
      const speed = phase === "liminal" ? 1400 : 900;
      orbPulse.value = withRepeat(
        withSequence(
          withTiming(0.82, { duration: speed, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: speed, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
      orbGlow.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    }
  }, [phase, orbPulse, orbGlow]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbPulse.value }],
    opacity: orbGlow.value,
  }));

  // Aura glow during gathering
  const auraOpacity = useSharedValue(0);
  useEffect(() => {
    if (phase === "gathering") {
      auraOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      auraOpacity.value = withTiming(0, { duration: 400 });
    }
  }, [phase, auraOpacity]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: auraOpacity.value,
  }));

  // Phase machine — auto-advances through liminal → gathering → whisper
  // Fast-forwards if backend completes early
  useEffect(() => {
    if (phase === "complete") return;

    function advancePhase(next: ArrivalPhase) {
      phaseRef.current = next;
      setPhase(next);
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }

    // Status fast-forward: if text arrives during early phases, jump to reveal
    if (status !== "generating" && (phase === "liminal" || phase === "gathering" || phase === "whisper")) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current);
      advancePhase("reveal");
      return;
    }

    const duration = PHASE_DURATIONS[phase as keyof typeof PHASE_DURATIONS];
    if (!duration) return;

    timerRef.current = setTimeout(() => {
      const next: ArrivalPhase = phase === "liminal" ? "gathering" : phase === "gathering" ? "whisper" : "reveal";
      advancePhase(next);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, status]);

  // Whisper phase: fragments appear and fade
  useEffect(() => {
    if (phase !== "whisper") return;

    const words = cliffhanger.split(/\s+/).slice(0, 3).join(" ");
    const appearDelay = 800;

    whisperTimerRef.current = setTimeout(() => {
      setWhisperText(words);
      const fadeTimer = setTimeout(() => setWhisperText(""), 3000);
      return () => clearTimeout(fadeTimer);
    }, appearDelay);

    return () => {
      if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current);
    };
  }, [phase, cliffhanger]);

  // Reveal phase: typewriter for transmission text
  useEffect(() => {
    if (phase !== "reveal" || !text) return;

    setTypewriterPos(0);
    const interval = setInterval(() => {
      setTypewriterPos((prev) => {
        if (prev >= text.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 18);

    return () => clearInterval(interval);
  }, [phase, text]);

  // Transition to complete when text fully revealed
  useEffect(() => {
    if (phase === "reveal" && typewriterPos >= text.length && text.length > 0) {
      const timeout = setTimeout(() => setPhase("complete"), 600);
      return () => clearTimeout(timeout);
    }
  }, [phase, typewriterPos, text]);

  return (
    <View style={styles.arrivalShell}>
      {/* Breathing orb */}
      <View style={styles.orbContainer}>
        <AnimatedReanimated.View
          style={[
            styles.auraGlow,
            { backgroundColor: auraColor },
            auraStyle,
          ]}
        />
        <AnimatedReanimated.View style={[styles.orbOuter, orbStyle]} />
        <View style={styles.orbCore} />
      </View>

      {/* Phase-specific content */}
      {phase === "liminal" ? (
        <AnimatedReanimated.Text
          entering={FadeIn.duration(800).delay(300)}
          style={styles.arrivalLine}
        >
          {PHASE_LINES.liminal}
        </AnimatedReanimated.Text>
      ) : null}

      {phase === "gathering" ? (
        <AnimatedReanimated.Text
          entering={FadeIn.duration(600)}
          style={styles.arrivalLine}
        >
          {GATHERING_LINES[castMember] ?? DEFAULT_GATHERING}
        </AnimatedReanimated.Text>
      ) : null}

      {phase === "whisper" && whisperText ? (
        <AnimatedReanimated.Text
          entering={FadeIn.duration(400)}
          exiting={FadeIn.duration(400)}
          style={styles.whisperLine}
        >
          {whisperText}
        </AnimatedReanimated.Text>
      ) : null}

      {phase === "reveal" || phase === "complete" ? (
        <View style={styles.revealContainer}>
          <AnimatedReanimated.Text
            entering={FadeIn.duration(400)}
            style={styles.revealTitle}
          >
            {title}
          </AnimatedReanimated.Text>
          <Text style={styles.revealBody}>
            {text.slice(0, typewriterPos)}
            {typewriterPos < text.length ? <Text style={styles.cursor}>|</Text> : null}
          </Text>
        </View>
      ) : null}

      {/* Subtle hint during early phases */}
      {(phase === "liminal" || phase === "gathering") ? (
        <Text style={styles.arrivalHint}>Read first. The voice can catch up.</Text>
      ) : null}
    </View>
  );
}

// ─── Text-only notice ────────────────────────────────────────────────────────

function TextOnlyNotice() {
  return (
    <View style={styles.playerShellCentered}>
      <View style={[styles.playButton, styles.playButtonMuted]}>
        <Ionicons name="document-text-outline" size={22} color="#F7D38B" />
      </View>
      <View style={styles.progressColumn}>
        <Text style={styles.pendingTitle}>Text only.</Text>
        <Text style={styles.pendingText}>
          The written transmission landed. Audio was unavailable for this one.
        </Text>
      </View>
    </View>
  );
}

// ─── Audio Player ────────────────────────────────────────────────────────────

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
  castMember?: string;
  transmission?: TransmissionState;
}

function AudioPlayer({ audioUrl, title, castMember, transmission }: AudioPlayerProps) {
  if (Platform.OS === "web")
    return <WebAudioPlayer audioUrl={audioUrl} title={title} castMember={castMember} />;
  // In local mode, generate the WAV on-device via QVAC. The remote
  // `audioUrl` is not used; we synthesise fresh audio on demand.
  if (isLocalMode() && transmission) {
    return <LocalTTSAudioPlayer transmission={transmission} />;
  }
  return <NativeAudioPlayer audioUrl={audioUrl} castMember={castMember ?? ""} transmission={transmission!} />;
}

function WebAudioPlayer({ audioUrl }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioRef] = useState(() => {
    if (typeof window === "undefined") return null;
    const audio = new Audio(audioUrl);
    audio.preload = "metadata";
    return audio;
  });

  useEffect(() => {
    if (!audioRef) return;
    const onMeta = () => setDuration(audioRef.duration);
    const onTime = () => {
      setCurrentTime(audioRef.currentTime);
      setProgress(audioRef.duration > 0 ? audioRef.currentTime / audioRef.duration : 0);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    audioRef.addEventListener("loadedmetadata", onMeta);
    audioRef.addEventListener("timeupdate", onTime);
    audioRef.addEventListener("ended", onEnded);
    return () => {
      audioRef.removeEventListener("loadedmetadata", onMeta);
      audioRef.removeEventListener("timeupdate", onTime);
      audioRef.removeEventListener("ended", onEnded);
      audioRef.pause();
    };
  }, [audioRef]);

  function togglePlayback() {
    if (!audioRef) return;
    if (isPlaying) {
      audioRef.pause();
      setIsPlaying(false);
    } else {
      audioRef.play();
      setIsPlaying(true);
    }
  }

  return (
    <View style={styles.nativePlayerShell}>
      <Pressable
        onPress={togglePlayback}
        style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
      >
        <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#101320" />
      </Pressable>
      <View style={styles.playerControls}>
        <View style={styles.playerStatusRowCentered}>
          <Text style={styles.playerStatusText}>
            {isPlaying ? "Listening to the future..." : progress > 0 ? "Paused" : "Ready"}
          </Text>
          <Text style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

function NativeAudioPlayer({ audioUrl, castMember, transmission }: { audioUrl: string; castMember: string; transmission?: TransmissionState }) {
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);
  const [hasStarted, setHasStarted] = useState(false);
  const [audioArrived, setAudioArrived] = useState(false);
  const [showArrivalNote, setShowArrivalNote] = useState(false);
  const arrivalOpacity = useRef(new Animated.Value(0)).current;

  const ambientSource = getAmbientSource(castMember);
  const ambientPlayer = useAudioPlayer(ambientSource);

  useEffect(() => {
    if (ambientPlayer) {
      ambientPlayer.loop = true;
      ambientPlayer.volume = 0.15;
    }
  }, [ambientPlayer]);

  useEffect(() => {
    if (status.playbackState === "playing") {
      setHasStarted(true);
      ambientPlayer?.play();
      if (!audioArrived) {
        setAudioArrived(true);
        if (transmission!.status === "text_ready") {
          setShowArrivalNote(true);
          arrivalOpacity.setValue(0);
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.sequence([
            Animated.timing(arrivalOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.delay(2200),
            Animated.timing(arrivalOpacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start(({ finished }) => {
            if (finished) setShowArrivalNote(false);
          });
        }
      }
    } else {
      ambientPlayer?.pause();
    }
  }, [status.playbackState, ambientPlayer, audioArrived, transmission?.status, arrivalOpacity]);

  async function togglePlayback() {
    if (status.playbackState === "playing") {
      player.pause();
    } else {
      if (Platform.OS !== "web") await Haptics.selectionAsync();
      player.play();
    }
  }

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  return (
    <>
      <View style={styles.nativePlayerShell}>
        <Pressable
          onPress={togglePlayback}
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
        >
          <Ionicons
            name={status.playbackState === "playing" ? "pause" : "play"}
            size={28}
            color="#101320"
          />
        </Pressable>

        <View style={styles.playerControls}>
          <View style={styles.playerStatusRowCentered}>
            <Text style={styles.playerStatusText}>
              {status.playbackState === "playing"
                ? "Listening to the future..."
                : hasStarted
                  ? "Paused"
                  : "Ready"}
            </Text>
            <Text style={styles.timeText}>
              {formatTime(status.currentTime)} / {formatTime(status.duration)}
            </Text>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      </View>

      {showArrivalNote ? (
        <Animated.View style={[styles.arrivalToast, { opacity: arrivalOpacity }]}>
          <Ionicons name="volume-high-outline" size={13} color="#C8D4E8" />
          <Text style={styles.arrivalToastText}>The voice caught up.</Text>
        </Animated.View>
      ) : null}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAmbientSource(castMember: string): number {
  return ambientAssets[castMember] ?? defaultAmbient;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ─── Local TTS Player ────────────────────────────────────────────────────────

/**
 * On-device TTS player. Used when `EXPO_PUBLIC_AI_PROVIDER === "local"`.
 * Loads (or generates) the WAV bytes for the transmission text via
 * QVAC's `useLocalTTS` hook, caches them in the persona-scoped store,
 * and plays the audio through `expo-audio` via a data: URI.
 */
function LocalTTSAudioPlayer({ transmission }: { transmission: TransmissionState }) {
  const [modelId, setModelId] = useState<string | null>(null);
  const [wavUri, setWavUri] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const personaId = transmission.id; // Used as cache key scope; refine if a real persona id is available
  const { speak, isReady } = useLocalTTS(modelId ?? undefined);

  // Load the model on mount (native only).
  useEffect(() => {
    if (Platform.OS === "web") return;
    let mounted = true;
    (async () => {
      try {
        const { loadModel } = await loadQvacSdk();
        // `chatterbox` is the model descriptor constant from the registry.
        const id = await loadModel({
          // @ts-expect-error - registry descriptor constant typing varies by version
          modelSrc: "chatterbox",
        });
        if (mounted) setModelId(id);
      } catch (e) {
        if (mounted) setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Generate (or fetch from cache) the WAV bytes on demand.
  async function ensureWav() {
    if (wavUri) return wavUri;
    if (!isReady || !modelId) return null;
    setIsPreparing(true);
    try {
      const cacheKeyText = transmission.text;
      const cached = await getCachedAudio(personaId, cacheKeyText);
      let bytes: Uint8Array | null = null;
      if (cached) {
        // Read the WAV file from disk.
        const FileSystem = await import("expo-file-system/legacy");
        const b64 = await FileSystem.readAsStringAsync(cached.filePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binStr = atob(b64);
        bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      } else {
        bytes = await speak(transmission.text);
        if (bytes) {
          await setCachedAudio(personaId, cacheKeyText, bytes);
        }
      }
      if (!bytes) return null;
      // Build a data URI so expo-audio can play it.
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
      const base64 = globalThis.btoa?.(bin) ?? uint8ToBase64(bytes);
      const uri = `data:audio/wav;base64,${base64}`;
      setWavUri(uri);
      return uri;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setIsPreparing(false);
    }
  }

  if (errorMsg) {
    return (
      <View style={styles.playerShellCentered}>
        <View style={[styles.playButton, styles.playButtonMuted]}>
          <Ionicons name="alert-circle-outline" size={22} color="#FF9A9A" />
        </View>
        <View style={styles.progressColumn}>
          <Text style={styles.pendingTitle}>Local voice unavailable.</Text>
          <Text style={styles.pendingText}>{errorMsg}</Text>
        </View>
      </View>
    );
  }

  if (wavUri) {
    return (
      <NativeAudioPlayer
        audioUrl={wavUri}
        castMember={transmission.castMember}
        transmission={transmission}
      />
    );
  }

  return (
    <View style={styles.nativePlayerShell}>
      <Pressable
        onPress={async () => {
          if (Platform.OS !== "web") await Haptics.selectionAsync();
          setHasStarted(true);
          await ensureWav();
        }}
        style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
      >
        {isPreparing ? (
          <ActivityIndicator color="#101320" />
        ) : (
          <Ionicons name="play" size={28} color="#101320" />
        )}
      </Pressable>
      <View style={styles.playerControls}>
        <View style={styles.playerStatusRowCentered}>
          <Text style={styles.playerStatusText}>
            {isPreparing
              ? "Synthesizing voice locally…"
              : hasStarted
                ? "Loading voice…"
                : "Tap to hear the voice on this device"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    result += chars[(b0 >> 2) & 0x3f];
    result += chars[((b0 & 0x03) << 4) | ((b1 >> 4) & 0x0f)];
    result += i + 1 < bytes.length ? chars[((b1 & 0x0f) << 2) | ((b2 >> 6) & 0x03)] : "=";
    result += i + 2 < bytes.length ? chars[b2 & 0x3f] : "=";
  }
  return result;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    gap: 18,
    padding: 24,
    paddingTop: 28,
    borderRadius: 30,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.18)",
    alignItems: "center",
  },
  headerWrap: {
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  headerCopy: {
    alignItems: "center",
    gap: 2,
  },
  cast: {
    color: "#F7D38B",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    textAlign: "center",
  },
  title: {
    color: "#F8F0DE",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 4,
    maxWidth: 260,
    textAlign: "center",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(247,211,139,0.13)",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F7D38B",
  },
  liveText: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Arrival sequence
  arrivalShell: {
    width: "100%",
    alignItems: "center",
    gap: 18,
    paddingVertical: 12,
    minHeight: 180,
    justifyContent: "center",
  },
  orbContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  auraGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  orbOuter: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F7D38B",
  },
  orbCore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F7D38B",
    shadowColor: "#F7D38B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  arrivalLine: {
    color: "#D7DCEE",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  whisperLine: {
    color: "rgba(246,221,169,0.6)",
    fontSize: 15,
    fontWeight: "600",
    fontStyle: "italic",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  revealContainer: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  revealTitle: {
    color: "#F8F0DE",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  revealBody: {
    color: "#E8E1D3",
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
  },
  cursor: {
    color: "#F7D38B",
    fontWeight: "300",
  },
  arrivalHint: {
    color: "#5A6180",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },

  // Audio player
  nativePlayerShell: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(9,11,24,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  playerControls: {
    flex: 1,
    gap: 10,
  },
  playerStatusRowCentered: {
    gap: 4,
    alignItems: "center",
  },
  playerStatusText: {
    color: "#F8F0DE",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  timeText: {
    color: "#8F96B4",
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#F7D38B",
    borderRadius: 3,
  },
  playerShellCentered: {
    width: "100%",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(9,11,24,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7D38B",
  },
  playButtonMuted: {
    backgroundColor: "rgba(247,211,139,0.12)",
  },
  progressColumn: {
    gap: 8,
    alignItems: "center",
  },
  pendingTitle: {
    color: "#F8F0DE",
    fontWeight: "800",
    textAlign: "center",
  },
  pendingText: {
    color: "#8F96B4",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 280,
  },
  body: {
    color: "#E8E1D3",
    fontSize: 17,
    lineHeight: 27,
    textAlign: "center",
  },
  cliffhangerCard: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(247,211,139,0.1)",
  },
  cliffhanger: {
    flex: 1,
    color: "#F6DDA9",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(247,211,139,0.1)",
    borderWidth: 1,
    borderColor: "rgba(200,168,75,0.28)",
  },
  rewardBadgeText: {
    color: "#C8A84B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  memoryBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "rgba(160,180,208,0.08)",
    borderWidth: 1,
    borderColor: "rgba(160,180,208,0.15)",
  },
  memoryBannerText: {
    flex: 1,
    color: "#8FA4C4",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  memoryBannerTitle: {
    color: "#A0B4D0",
    fontStyle: "italic",
    fontWeight: "700",
  },
  continuityHint: {
    color: "#AEB6D4",
    fontSize: 12,
    lineHeight: 18,
    fontStyle: "italic",
    textAlign: "center",
    maxWidth: 280,
  },
  responseCard: {
    width: "100%",
    gap: 12,
    paddingTop: 4,
    alignItems: "center",
  },
  responseTitle: {
    color: "#F8F0DE",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  responseCopy: {
    color: "#AEB6D4",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 280,
  },
  reactionGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  reactionButtonActive: {
    backgroundColor: "#F7D38B",
    borderColor: "#F7D38B",
  },
  reactionText: {
    color: "#F7D38B",
    fontSize: 12,
    fontWeight: "800",
  },
  reactionTextActive: {
    color: "#101320",
  },
  replyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  replyToggleText: {
    color: "#F7D38B",
    fontSize: 13,
    fontWeight: "800",
  },
  replyComposer: {
    width: "100%",
    gap: 10,
    alignItems: "center",
  },
  replyInput: {
    width: "100%",
    minHeight: 96,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#F8F0DE",
    padding: 15,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  replySubmit: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    backgroundColor: "#F7D38B",
  },
  replySubmitDisabled: {
    opacity: 0.45,
  },
  replySubmitText: {
    color: "#101320",
    fontSize: 13,
    fontWeight: "900",
  },
  arrivalToast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 8,
    width: "100%",
  },
  arrivalToastText: {
    color: "#C8D4E8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  brandFooter: {
    paddingTop: 8,
    alignItems: "center",
  },
  brandText: {
    color: "rgba(247,211,139,0.25)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
