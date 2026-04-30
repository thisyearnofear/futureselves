import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
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
                    <Text style={styles.liveText}>transmission</Text>
                </View>
            </View>

            {transmission.audioUrl ? <AudioPlayer audioUrl={transmission.audioUrl} title={transmission.title} /> : <PendingAudio />}

            <Text style={styles.body}>{transmission.text}</Text>
            <View style={styles.cliffhangerCard}>
                <Ionicons name="moon" size={17} color="#F7D38B" />
                <Text style={styles.cliffhanger}>{transmission.cliffhanger}</Text>
            </View>
        </View>
    );
}

interface NativeAudioPlayerProps {
    audioUrl: string;
    title: string;
}

function AudioPlayer({ audioUrl, title }: NativeAudioPlayerProps) {
    if (Platform.OS === "web") return <WebAudioFallback audioUrl={audioUrl} title={title} />;
    return <NativeAudioPlayer audioUrl={audioUrl} title={title} />;
}

function WebAudioFallback({ audioUrl, title }: NativeAudioPlayerProps) {
    return (
        <View style={styles.playerShell}>
            <Pressable onPress={() => Linking.openURL(audioUrl)} style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
                <Ionicons name="play" size={22} color="#101320" />
            </Pressable>
            <View style={styles.progressColumn}>
                <Text style={styles.pendingTitle}>{title}</Text>
                <Text style={styles.pendingText}>Open the voice transmission in a new tab.</Text>
            </View>
        </View>
    );
}

function NativeAudioPlayer({ audioUrl, title }: NativeAudioPlayerProps) {
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>body{margin:0;background:transparent;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}audio{width:100%;height:44px;accent-color:#F7D38B;} .label{color:#8F96B4;font-size:12px;margin-top:8px;}</style></head><body><audio controls preload="metadata" src="${audioUrl}" title="${title.replace(/"/g, "&quot;")}"></audio><div class="label">ElevenLabs voice transmission</div></body></html>`;

    return (
        <View style={styles.webPlayerShell}>
            <WebView
                originWhitelist={["*"]}
                source={{ html }}
                style={styles.webPlayer}
                scrollEnabled={false}
            />
        </View>
    );
}

function PendingAudio() {
    return (
        <View style={styles.playerShell}>
            <View style={[styles.playButton, styles.playButtonMuted]}>
                <Ionicons name="radio" size={22} color="#F7D38B" />
            </View>
            <View style={styles.progressColumn}>
                <Text style={styles.pendingTitle}>Audio is being woven.</Text>
                <Text style={styles.pendingText}>When ElevenLabs returns the voice, playback appears here.</Text>
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
    webPlayerShell: {
        minHeight: 78,
        overflow: "hidden",
        borderRadius: 24,
        borderCurve: "continuous",
        backgroundColor: "rgba(9,11,24,0.62)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        padding: 12,
    },
    webPlayer: {
        flex: 1,
        minHeight: 54,
        backgroundColor: "transparent",
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
    waveRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        minHeight: 32,
    },
    waveBar: {
        flex: 1,
        maxWidth: 5,
        borderRadius: 3,
        backgroundColor: "rgba(247,240,222,0.18)",
    },
    waveBarActive: {
        backgroundColor: "#F7D38B",
    },
    duration: {
        color: "#8F96B4",
        fontSize: 12,
        fontVariant: ["tabular-nums"],
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
