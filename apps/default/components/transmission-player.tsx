import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { TransmissionState } from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";

interface TransmissionPlayerProps {
    transmission: TransmissionState;
}

export function TransmissionPlayer({ transmission }: TransmissionPlayerProps) {
    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.cast}>{formatCastMember(transmission.castMember)}</Text>
                    <Text style={styles.title}>{transmission.title}</Text>
                </View>
                <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>{transmission.audioUrl ? "transmission" : "text signal"}</Text>
                </View>
            </View>

            {transmission.audioUrl ? (
                <AudioPlayer 
                    audioUrl={transmission.audioUrl} 
                    title={transmission.title} 
                    castMember={transmission.castMember} 
                />
            ) : (
                <TransmissionFallback status={transmission.status} />
            )}

            <Text style={styles.body}>{transmission.text}</Text>
            <View style={styles.cliffhangerCard}>
                <Ionicons name="moon" size={17} color="#F7D38B" />
                <Text style={styles.cliffhanger}>{transmission.cliffhanger}</Text>
            </View>
        </View>
    );
}

interface AudioPlayerProps {
    audioUrl: string;
    title: string;
    castMember: string;
}

function AudioPlayer({ audioUrl, title, castMember }: AudioPlayerProps) {
    if (Platform.OS === "web") return <WebAudioPlayer audioUrl={audioUrl} title={title} />;
    return <NativeAudioPlayer audioUrl={audioUrl} castMember={castMember} />;
}

function WebAudioPlayer({ audioUrl, title }: AudioPlayerProps) {
    return (
        <View style={styles.playerShell}>
            <Pressable
                onPress={() => Linking.openURL(audioUrl)}
                style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
            >
                <Ionicons name="play" size={22} color="#101320" />
            </Pressable>
            <View style={styles.progressColumn}>
                <Text style={styles.pendingTitle}>{title}</Text>
                <Text style={styles.pendingText}>Open the spoken transmission in a new tab.</Text>
            </View>
        </View>
    );
}

function NativeAudioPlayer({ audioUrl, castMember }: { audioUrl: string; castMember: string }) {
    const player = useAudioPlayer(audioUrl);
    const status = useAudioPlayerStatus(player);
    const [hasStarted, setHasStarted] = useState(false);

    // Dynamic ambient loop based on cast member
    const ambientUrl = getAmbientUrl(castMember);
    const ambientPlayer = useAudioPlayer(ambientUrl);
    
    useEffect(() => {
        if (ambientPlayer) {
            ambientPlayer.loop = true;
            ambientPlayer.volume = 0.15; // Subtle background
        }
    }, [ambientPlayer]);

    useEffect(() => {
        if (status.playbackState === "playing") {
            setHasStarted(true);
            ambientPlayer?.play();
        } else {
            ambientPlayer?.pause();
        }
    }, [status.playbackState, ambientPlayer]);

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
        <View style={styles.nativePlayerShell}>
            <Pressable onPress={togglePlayback} style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
                <Ionicons name={status.playbackState === "playing" ? "pause" : "play"} size={24} color="#101320" />
            </Pressable>

            <View style={styles.playerControls}>
                <View style={styles.playerStatusRow}>
                    <Text style={styles.playerStatusText}>
                        {status.playbackState === "playing" ? "Listening to the future..." : hasStarted ? "Transmission paused" : "Signal ready"}
                    </Text>
                    <Text style={styles.timeText}>{formatTime(status.currentTime)} / {formatTime(status.duration)}</Text>
                </View>

                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                </View>
            </View>
        </View>
    );
}

function getAmbientUrl(castMember: string): string {
    // These should be replaced with actual assets in /assets/audio/
    const baseUrl = "https://your-deployment.convex.site/ambient/";
    const mapping: Record<string, string> = {
        future_self: "room-tone.mp3",
        future_partner: "tender-pads.mp3",
        future_mentor: "spacious-hum.mp3",
        shadow: "shadow-wind.mp3",
        alternate_self: "uncanny-resonance.mp3",
    };
    return baseUrl + (mapping[castMember] || "room-tone.mp3");
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function TransmissionFallback({ status }: { status: TransmissionState["status"] }) {
    if (status === "generating") {
        return (
            <View style={styles.playerShell}>
                <View style={[styles.playButton, styles.playButtonMuted]}>
                    <ActivityIndicator color="#F7D38B" />
                </View>
                <View style={styles.progressColumn}>
                    <Text style={styles.pendingTitle}>The voice is being woven...</Text>
                    <Text style={styles.pendingText}>ElevenLabs is synthesizing your transmission. It will appear here in a moment.</Text>
                </View>
            </View>
        );
    }

    const isFailed = status === "failed";
    return (
        <View style={styles.playerShell}>
            <View style={[styles.playButton, styles.playButtonMuted]}>
                <Ionicons name={isFailed ? "alert-circle-outline" : "document-text-outline"} size={22} color="#F7D38B" />
            </View>
            <View style={styles.progressColumn}>
                <Text style={styles.pendingTitle}>{isFailed ? "Voice rendering stalled." : "Text-only signal."}</Text>
                <Text style={styles.pendingText}>
                    {isFailed ? "The written transmission still landed." : "Spoken playback appears if ElevenLabs is configured."}
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
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 14,
    },
    cast: {
        color: "#F7D38B",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 1.3,
        textTransform: "uppercase",
    },
    title: {
        color: "#F8F0DE",
        fontSize: 24,
        fontWeight: "900",
        letterSpacing: -0.6,
        marginTop: 4,
        maxWidth: 220,
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
    },
    nativePlayerShell: {
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
    playerStatusRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    playerStatusText: {
        color: "#F8F0DE",
        fontSize: 13,
        fontWeight: "800",
    },
    timeText: {
        color: "#8F96B4",
        fontSize: 11,
        fontWeight: "700",
        fontVariant: ["tabular-nums"],
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
    playerShell: {
        flexDirection: "row",
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
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F7D38B",
    },
    playButtonMuted: {
        backgroundColor: "rgba(247,211,139,0.12)",
    },
    progressColumn: {
        flex: 1,
        gap: 8,
    },
    pendingTitle: {
        color: "#F8F0DE",
        fontWeight: "800",
    },
    pendingText: {
        color: "#8F96B4",
        fontSize: 12,
        lineHeight: 17,
    },
    body: {
        color: "#E8E1D3",
        fontSize: 17,
        lineHeight: 27,
    },
    cliffhangerCard: {
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
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.98 }],
    },
});