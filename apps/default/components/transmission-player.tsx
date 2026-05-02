import { useEffect, useMemo, useState } from "react";
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
import * as Haptics from "expo-haptics";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { TransmissionState } from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";

interface TransmissionPlayerProps {
  transmission: TransmissionState;
  isSavingResponse: boolean;
  onSaveResponse: (payload: {
    reaction?: "landed" | "not_quite" | "did_it" | "keep_close";
    replyNote?: string;
  }) => Promise<void>;
}

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

export function TransmissionPlayer({
  transmission,
  isSavingResponse,
  onSaveResponse,
}: TransmissionPlayerProps) {
  const [isReplyOpen, setIsReplyOpen] = useState(Boolean(transmission.response?.replyNote));
  const [replyNote, setReplyNote] = useState(transmission.response?.replyNote ?? "");

  useEffect(() => {
    setReplyNote(transmission.response?.replyNote ?? "");
    setIsReplyOpen(Boolean(transmission.response?.replyNote));
  }, [transmission.response?.replyNote]);

  const statusLabel = useMemo(() => {
    if (transmission.audioUrl) return "transmission";
    if (transmission.status === "text_ready") return "message delivered";
    if (transmission.status === "generating") return "signal arriving";
    return "text signal";
  }, [transmission.audioUrl, transmission.status]);

  return (
    <View style={styles.card}>
      <View style={styles.headerWrap}>
        <View style={styles.headerCopy}>
          <Text style={styles.cast}>{formatCastMember(transmission.castMember)}</Text>
          <Text style={styles.title}>{transmission.title}</Text>
        </View>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{statusLabel}</Text>
        </View>
      </View>

      {transmission.audioUrl ? (
        <AudioPlayer
          audioUrl={transmission.audioUrl}
          title={transmission.title}
          castMember={transmission.castMember}
          transmission={transmission}
        />
      ) : (
        <TransmissionFallback status={transmission.status} />
      )}

      <Text style={styles.body}>{transmission.text}</Text>
      <View style={styles.cliffhangerCard}>
        <Ionicons name="moon" size={17} color="#F7D38B" />
        <Text style={styles.cliffhanger}>{transmission.cliffhanger}</Text>
      </View>

      {transmission.continuity?.rewardLabel ? (
        <View style={styles.rewardBadge}>
          <Ionicons name="sparkles" size={12} color="#C8A84B" />
          <Text style={styles.rewardBadgeText}>{transmission.continuity.rewardLabel}</Text>
        </View>
      ) : null}

      {transmission.memory?.resurfacedTitle ? (
        <View style={styles.memoryBanner}>
          <Ionicons name="git-commit-outline" size={13} color="#A0B4D0" />
          <Text style={styles.memoryBannerText}>
            <Text style={styles.memoryBannerTitle}>{transmission.memory.resurfacedTitle}</Text>
            {transmission.memory.resurfacedReason
              ? ` · ${transmission.memory.resurfacedReason}`
              : ""}
          </Text>
        </View>
      ) : null}

      <View style={styles.responseCard}>
        <Text style={styles.responseTitle}>Answer the signal back.</Text>
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
      </View>
    </View>
  );
}

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
  castMember?: string;
  transmission?: TransmissionState;
}

function AudioPlayer({ audioUrl, title, castMember, transmission }: AudioPlayerProps) {
  if (Platform.OS === "web")
    return <WebAudioPlayer audioUrl={audioUrl} title={title} castMember={castMember} />;
  return <NativeAudioPlayer audioUrl={audioUrl} castMember={castMember ?? ""} transmission={transmission} />;
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
            {isPlaying ? "Listening to the future..." : progress > 0 ? "Transmission paused" : "Signal ready"}
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
        if (transmission.status === "text_ready") {
          setShowArrivalNote(true);
          setTimeout(() => setShowArrivalNote(false), 3000);
        }
      }
    } else {
      ambientPlayer?.pause();
    }
  }, [status.playbackState, ambientPlayer, audioArrived, transmission.status]);

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
                  ? "Transmission paused"
                  : "Signal ready"}
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
        <View style={styles.arrivalToast}>
          <Ionicons name="volume-high-outline" size={13} color="#C8D4E8" />
          <Text style={styles.arrivalToastText}>The voice caught up.</Text>
        </View>
      ) : null}
    </>
  );
}

const ambientAssets: Record<string, number> = {
  future_self: require("@/assets/audio/room-tone.mp3"),
  future_partner: require("@/assets/audio/tender-pads.mp3"),
  future_mentor: require("@/assets/audio/spacious-hum.mp3"),
  shadow: require("@/assets/audio/shadow-wind.mp3"),
  alternate_self: require("@/assets/audio/uncanny-resonance.mp3"),
};
const defaultAmbient: number = require("@/assets/audio/room-tone.mp3");

function getAmbientSource(castMember: string): number {
  return ambientAssets[castMember] ?? defaultAmbient;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function TransmissionFallback({ status }: { status: TransmissionState["status"] }) {
  if (status === "generating") {
    return (
      <View style={styles.playerShellCentered}>
        <View style={[styles.playButton, styles.playButtonMuted]}>
          <ActivityIndicator color="#F7D38B" />
        </View>
        <View style={styles.progressColumn}>
          <Text style={styles.pendingTitle}>The signal is being composed...</Text>
          <Text style={styles.pendingText}>
            Your message will land first. If audio is available, the voice will catch up after.
          </Text>
        </View>
      </View>
    );
  }

  if (status === "text_ready") {
    return (
      <View style={styles.playerShellCentered}>
        <View style={[styles.playButton, styles.playButtonMuted]}>
          <Ionicons name="sparkles-outline" size={22} color="#F7D38B" />
        </View>
        <View style={styles.progressColumn}>
          <Text style={styles.pendingTitle}>Message delivered.</Text>
          <Text style={styles.pendingText}>
            Read now. The voice can still arrive in a moment if audio finishes rendering.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.playerShellCentered}>
      <View style={[styles.playButton, styles.playButtonMuted]}>
        <Ionicons name="document-text-outline" size={22} color="#F7D38B" />
      </View>
      <View style={styles.progressColumn}>
        <Text style={styles.pendingTitle}>Text signal only.</Text>
        <Text style={styles.pendingText}>
          The written transmission landed. Audio was unavailable for this one.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 18,
    padding: 20,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: "rgba(246,240,222,0.08)",
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
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
