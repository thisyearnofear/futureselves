import { useState } from "react";
import {
    ActivityIndicator,
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
import Animated, { FadeInUp } from "react-native-reanimated";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import type { Choice, ConstellationStar, GameState } from "@/lib/futureself";
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

const wordNudges = ["threshold", "brave", "lighter", "repair", "momentum", "honest"];
const noteNudges = [
    "I almost did the hard thing today.",
    "There is one conversation I keep replaying.",
    "I want the next version of me to feel less defended.",
];

const actionNudges: Array<{ label: string; choice: Choice; icon: keyof typeof Ionicons.glyphMap }> = [
    { label: "Send one honest text", choice: "repair", icon: "chatbubble-ellipses-outline" },
    { label: "Open the thing for five minutes", choice: "toward", icon: "arrow-forward-circle-outline" },
    { label: "Remove one small drain", choice: "release", icon: "close-circle-outline" },
];

export function FutureselfHome({ state, dateKey }: FutureselfHomeProps) {
    const { signOut } = useAuthActions();
    const saveCheckIn = useMutation(api.game.saveCheckIn);
    const recordChoice = useMutation(api.game.recordChoice);
    const generateTransmission = useAction(api.game.generateDailyTransmission);
    const [word, setWord] = useState(state.todayCheckIn?.word ?? "");
    const [note, setNote] = useState(state.todayCheckIn?.note ?? "");
    const [isReceiving, setIsReceiving] = useState(false);
    const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
    const [error, setError] = useState<string | null>(null);

    const persona = state.persona;
    const litVoices = state.constellation.filter((star) => star.state === "lit" || star.state === "dim");

    async function handleReceive() {
        setError(null);
        const trimmedWord = word.trim();
        if (!trimmedWord) {
            setError("Give today one word first. It becomes the key in the signal.");
            return;
        }
        setIsReceiving(true);
        try {
            await saveCheckIn({ dateKey, word: trimmedWord, note: note.trim() || undefined });
            await generateTransmission({ dateKey, localNow: new Date().toLocaleString() });
            if (Platform.OS !== "web") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Could not receive today's signal.");
        } finally {
            setIsReceiving(false);
        }
    }

    async function handleChoice(choice: Choice) {
        if (!state.todayTransmission) return;
        setSelectedChoice(choice);
        setError(null);
        try {
            await recordChoice({
                dateKey,
                choice,
                prompt: state.todayTransmission.actionPrompt,
            });
            if (Platform.OS !== "web") await Haptics.selectionAsync();
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Could not log choice.");
        }
    }

    return (
        <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
            <Animated.View entering={Platform.OS === "web" ? undefined : FadeInUp.duration(260)} style={styles.hero}>
                <View style={styles.heroTopRow}>
                    <View style={styles.signalBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.signalBadgeText}>daily signal</Text>
                    </View>
                    <Pressable onPress={() => signOut()} style={styles.signOutButton}>
                        <Ionicons name="log-out-outline" size={18} color="#C5CCE6" />
                    </Pressable>
                </View>

                <Text style={styles.heroTitle}>Your future self has one message for today.</Text>
                <Text style={styles.heroCopy}>
                    {persona?.name ? `${persona.name}, ` : ""}open the transmission, hear the voice, make one small choice. Tomorrow remembers.
                </Text>

                <View style={styles.heroPromiseRow}>
                    <MiniPromise icon="mic" label="spoken" />
                    <MiniPromise icon="book" label="serial" />
                    <MiniPromise icon="sparkles" label="personal" />
                </View>
            </Animated.View>

            {state.todayTransmission ? (
                <TransmissionPlayer transmission={state.todayTransmission} />
            ) : (
                <Animated.View entering={Platform.OS === "web" ? undefined : FadeInUp.delay(80).duration(260)} style={styles.receiveCard}>
                    <View style={styles.receiveHeader}>
                        <View style={styles.receiveIcon}>
                            <Ionicons name="key-outline" size={22} color="#F7D38B" />
                        </View>
                        <View style={styles.receiveHeaderCopy}>
                            <Text style={styles.sectionTitle}>First, a key word.</Text>
                            <Text style={styles.sectionCopy}>Not journaling. Just one word that colors the voice.</Text>
                        </View>
                    </View>

                    <TextInput
                        onChangeText={setWord}
                        placeholder="threshold"
                        placeholderTextColor="#6F7591"
                        style={styles.wordInput}
                        value={word}
                    />
                    <NudgeRow label="Borrow a word" options={wordNudges} onSelect={setWord} selected={word} />
                    <TextInput
                        multiline
                        onChangeText={setNote}
                        placeholder="Optional: one detail future-you should remember."
                        placeholderTextColor="#6F7591"
                        style={styles.noteInput}
                        textAlignVertical="top"
                        value={note}
                    />
                    <NudgeRow label="Or start with a detail" options={noteNudges} onSelect={setNote} selected={note} />
                    <View style={styles.payoffRow}>
                        <PayoffPill icon="mic-outline" label="voice adapts" />
                        <PayoffPill icon="sparkles-outline" label="story sharpens" />
                        <PayoffPill icon="trail-sign-outline" label="tomorrow changes" />
                    </View>

                    <Pressable disabled={isReceiving} onPress={handleReceive} style={({ pressed }) => [styles.receiveButton, pressed && styles.pressed]}>
                        {isReceiving ? <ActivityIndicator color="#101320" /> : <Text style={styles.receiveText}>Receive today's voice</Text>}
                    </Pressable>
                </Animated.View>
            )}

            {state.todayTransmission ? (
                <View style={styles.choiceCard}>
                    <Text style={styles.sectionTitle}>Choose the timeline lean.</Text>
                    <Text style={styles.sectionCopy}>{state.todayTransmission.actionPrompt}</Text>
                    <View style={styles.choiceGrid}>
                        {(Object.keys(choiceCopy) as Array<Choice>).map((choice) => (
                            <Pressable key={choice} onPress={() => handleChoice(choice)} style={[styles.choiceButton, selectedChoice === choice && styles.choiceButtonActive]}>
                                <Text style={[styles.choiceText, selectedChoice === choice && styles.choiceTextActive]}>{choiceCopy[choice]}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <Text style={styles.nudgeLabel}>If you're blank, borrow a tiny move:</Text>
                    <View style={styles.actionNudgeGrid}>
                        {actionNudges.map((nudge) => (
                            <Pressable key={nudge.label} onPress={() => handleChoice(nudge.choice)} style={({ pressed }) => [styles.actionNudge, pressed && styles.pressed]}>
                                <Ionicons name={nudge.icon} size={16} color="#F7D38B" />
                                <Text style={styles.actionNudgeText}>{nudge.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            ) : null}

            <View style={styles.unlockCard}>
                <View style={styles.unlockHeader}>
                    <Text style={styles.sectionTitle}>The cast will arrive slowly.</Text>
                    <Text style={styles.sectionCopy}>Future voices unlock as the ritual earns more context.</Text>
                </View>
                <View style={styles.voiceRow}>
                    {state.constellation.slice(0, 4).map((star) => (
                        <VoiceOrb key={star.castMember} star={star} />
                    ))}
                </View>
                <View style={styles.contextNote}>
                    <Ionicons name="calendar-outline" size={16} color="#AEB6D4" />
                    <Text style={styles.contextNoteText}>More context can unlock later. For now, today's signal only needs one honest word.</Text>
                </View>
            </View>

            {litVoices.length > 1 ? (
                <Text style={styles.footnote}>{litVoices.length} voices are close enough to hear you.</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
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
                        style={[styles.nudgeChip, selected === option && styles.nudgeChipActive]}
                    >
                        <Text style={[styles.nudgeText, selected === option && styles.nudgeTextActive]}>{option}</Text>
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
    return (
        <View style={styles.voiceOrbWrap}>
            <View style={[styles.voiceOrb, isUnlocked && styles.voiceOrbUnlocked]}>
                <Ionicons name={isUnlocked ? "radio" : "lock-closed"} size={16} color={isUnlocked ? "#101320" : "#F7D38B"} />
            </View>
            <Text numberOfLines={2} style={styles.voiceLabel}>{star.label}</Text>
        </View>
    );
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
    choiceGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
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
    voiceRow: {
        flexDirection: "row",
        gap: 10,
    },
    voiceOrbWrap: {
        flex: 1,
        alignItems: "center",
        gap: 7,
    },
    voiceOrb: {
        width: 44,
        height: 44,
        borderRadius: 22,
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
    voiceLabel: {
        color: "#AEB6D4",
        fontSize: 11,
        lineHeight: 14,
        textAlign: "center",
        fontWeight: "800",
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
});
