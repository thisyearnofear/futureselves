/**
 * football-drill.tsx — Drill screen route.
 *
 * Hosts the three drill components (reaction_time, juggling, sprint) and
 * handles the full completion flow:
 * 1. Start drill session in Convex (startDrillSession)
 * 2. User completes the drill → get result value + raw data
 * 3. Complete drill session in Convex (completeDrillSession)
 * 4. Recompute trajectory (recomputeTrajectory)
 * 5. Interpret trajectory via QVAC LLM (interpretTrajectory)
 * 6. Save narrative to Convex (updateTrajectoryNarrative)
 * 7. Navigate back to football home
 *
 * All AI interpretation runs on-device through QVAC. The measurement
 * itself uses native sensors (accelerometer) or pure software (tap/timer).
 */

import { useCallback, useState } from "react";
import { StyleSheet, View, Text, ActivityIndicator, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/convex/_generated/api";
import { ReactionTimeDrill } from "@/components/drill-reaction-time";
import { JugglingDrill } from "@/components/drill-juggling";
import { SprintDrill } from "@/components/drill-sprint";
import { useQVACPrewarmContext } from "@/lib/qvac-prewarm-context";
import { interpretTrajectory, type FootballPosition } from "@/lib/football-llm";
import { isLocalMode } from "@/lib/ai";
import {
  type DrillType,
  formatResult,
  getProComparison,
  DRILL_LABELS,
} from "@/lib/drill-utils";

export default function FootballDrillScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ type?: string }>();
    const prewarm = useQVACPrewarmContext();
    const ambition = useQuery(api.football.getActiveAmbition, {});

    const startDrillSession = useMutation(api.football.startDrillSession);
    const completeDrillSession = useMutation(api.football.completeDrillSession);
    const recomputeTrajectory = useMutation(api.football.recomputeTrajectory);
    const updateTrajectoryNarrative = useMutation(api.football.updateTrajectoryNarrative);

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [savedResultValue, setSavedResultValue] = useState<number | null>(null);

    const llmModelId = isLocalMode() ? prewarm?.llm.modelId ?? null : null;

    // Drill type is passed via router params: /football-drill?type=reaction_time
    const validDrillTypes: DrillType[] = ["reaction_time", "juggling", "sprint"];
    const rawType = params.type as DrillType | undefined;
    const drillType: DrillType = rawType && validDrillTypes.includes(rawType)
        ? rawType
        : "reaction_time";

    const handleComplete = useCallback(
        async (resultValue: number, rawData: Array<{ timestamp: number; value: number }>) => {
            if (!ambition) {
                setSaveError("No active ambition.");
                return;
            }
            setIsSaving(true);
            setSaveError(null);
            try {
                // 1. Start drill session
                const sessionId = await startDrillSession({
                    ambitionId: ambition._id as any,
                    drillType: drillType as any,
                });

                // 2. Complete drill session with result
                await completeDrillSession({
                    sessionId: sessionId as any,
                    resultValue,
                    rawData,
                });

                // 3. Recompute trajectory
                await recomputeTrajectory({
                    drillType: drillType as any,
                });

                // 4. Interpret trajectory via QVAC LLM (on-device)
                if (llmModelId && ambition) {
                    try {
                        const interpretation = await interpretTrajectory(llmModelId, {
                            playerName: "Player",
                            targetPosition: (ambition.targetPosition as FootballPosition) ?? "unknown",
                            trajectories: [
                                {
                                    drillType: drillType as any,
                                    sessionCount: 1,
                                    trendPercent: 0,
                                    latestValue: resultValue,
                                    bestValue: resultValue,
                                },
                            ],
                        });

                        // 5. Save narrative
                        await updateTrajectoryNarrative({
                            drillType: drillType as any,
                            narrative: interpretation.narrative,
                            suggestedPosition: interpretation.suggestedPosition as any,
                        });
                    } catch (e) {
                        // Trajectory interpretation is non-critical — the drill
                        // result is already saved. The narrative can be generated
                        // later from the football home screen.
                        console.warn("[FootballDrill] Trajectory interpretation failed:", e);
                    }
                }

                // 6. Show result summary instead of navigating back
                setSavedResultValue(resultValue);
                setShowResult(true);
                setIsSaving(false);
                if (Platform.OS !== "web") {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            } catch (e) {
                setSaveError(e instanceof Error ? e.message : "Could not save drill result.");
                setIsSaving(false);
                // Still show result even if save failed — the drill itself completed
                setSavedResultValue(resultValue);
                setShowResult(true);
            }
        },
        [
            ambition,
            drillType,
            startDrillSession,
            completeDrillSession,
            recomputeTrajectory,
            updateTrajectoryNarrative,
            llmModelId,
            router,
        ],
    );

    const handleCancel = useCallback(() => {
        router.back();
    }, [router]);

    if (isSaving) {
        return (
            <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
                <StatusBar style="light" />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.savingContainer}>
                        <ActivityIndicator color="#F7D38B" size="large" />
                        <Text style={styles.savingText}>Saving your result...</Text>
                        <Text style={styles.savingSub}>
                            Your future self is interpreting your trajectory.
                        </Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    // ─── Result summary phase ──────────────────────────────────────────────

    if (showResult && savedResultValue !== null) {
        const comparison = getProComparison(drillType, savedResultValue, ambition?.targetPosition as any);
        const allDrills: DrillType[] = ["reaction_time", "juggling", "sprint"];
        const otherDrills = allDrills.filter((d) => d !== drillType);

        const handleChallengeFriend = async () => {
            if (Platform.OS === "web") return;
            try {
                const { Share: RNShare } = await import("react-native");
                const link = `futureself://challenge?drill=${drillType}&target=${savedResultValue}&from=Me`;
                await RNShare.share({
                    message: `I scored ${formatResult(drillType, savedResultValue)} on ${DRILL_LABELS[drillType]}. ${comparison?.diffLabel ?? ""}. Think you can beat me? ${link} #FootballPath`,
                    title: "Football Path Challenge",
                });
            } catch { /* cancelled */ }
        };

        const handleNextDrill = (nextType: DrillType) => {
            setShowResult(false);
            setSavedResultValue(null);
            router.setParams({ type: nextType });
        };

        const handleGoHome = () => {
            router.replace("/football" as any);
        };

        return (
            <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
                <StatusBar style="light" />
                <Stack.Screen options={{ headerShown: false }} />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.resultContainer}>
                        {/* Success header */}
                        <View style={styles.resultHeader}>
                            <View style={styles.resultCheckCircle}>
                                <Ionicons name="checkmark" size={28} color="#A9F7B5" />
                            </View>
                            <Text style={styles.resultTitle}>Drill complete</Text>
                            <Text style={styles.resultDrillName}>{DRILL_LABELS[drillType]}</Text>
                        </View>

                        {/* Score */}
                        <Text style={styles.resultScoreLabel}>Your score</Text>
                        <Text style={styles.resultScoreValue}>
                            {formatResult(drillType, savedResultValue)}
                        </Text>

                        {/* Pro comparison */}
                        {comparison && (
                            <View style={styles.resultComparison}>
                                <Text style={styles.resultComparisonMain}>{comparison.diffLabel}</Text>
                                <Text style={styles.resultComparisonSub}>{comparison.percentileLabel}</Text>
                            </View>
                        )}

                        {saveError && (
                            <Text style={styles.resultError}>{saveError}</Text>
                        )}

                        {/* Next actions */}
                        <Text style={styles.resultNextLabel}>Keep training</Text>
                        <View style={styles.resultNextDrills}>
                            {otherDrills.map((dt) => (
                                <Pressable
                                    key={dt}
                                    style={({ pressed }) => [
                                        styles.resultNextDrillCard,
                                        pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                                    ]}
                                    onPress={() => handleNextDrill(dt)}
                                >
                                    <Ionicons
                                        name={dt === "reaction_time" ? "flash" : dt === "juggling" ? "football" : "speedometer"}
                                        size={18}
                                        color="#F7D38B"
                                    />
                                    <Text style={styles.resultNextDrillText}>{DRILL_LABELS[dt]}</Text>
                                    <Ionicons name="chevron-forward" size={14} color="#6B7290" />
                                </Pressable>
                            ))}
                        </View>

                        {/* Bottom actions */}
                        <View style={styles.resultBottomActions}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.resultChallengeBtn,
                                    pressed && { transform: [{ scale: 0.97 }] },
                                ]}
                                onPress={handleChallengeFriend}
                            >
                                <Ionicons name="flash-outline" size={16} color="#F7D38B" />
                                <Text style={styles.resultChallengeText}>Challenge a friend</Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.resultHomeBtn,
                                    pressed && { transform: [{ scale: 0.97 }] },
                                ]}
                                onPress={handleGoHome}
                            >
                                <Text style={styles.resultHomeText}>See my card</Text>
                            </Pressable>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    const effectiveDrillType: DrillType = drillType ?? "reaction_time";

    return (
        <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.safeArea}>
                {saveError && (
                    <View style={styles.errorBar}>
                        <Text style={styles.errorText}>{saveError}</Text>
                    </View>
                )}
                {drillType === "reaction_time" && (
                    <ReactionTimeDrill onComplete={handleComplete} onCancel={handleCancel} />
                )}
                {drillType === "juggling" && (
                    <JugglingDrill onComplete={handleComplete} onCancel={handleCancel} />
                )}
                {drillType === "sprint" && (
                    <SprintDrill onComplete={handleComplete} onCancel={handleCancel} />
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    safeArea: { flex: 1 },
    savingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
    },
    savingText: { color: "#F8F0DE", fontSize: 16, fontWeight: "700" },
    savingSub: { color: "#BFC6DE", fontSize: 14 },
    errorBar: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: "rgba(255,154,154,0.1)",
    },
    errorText: { color: "#FF9A9A", fontSize: 14 },
    // ─── Result summary styles ───────────────────────────────────────────
    resultContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        paddingHorizontal: 24,
    },
    resultHeader: {
        alignItems: "center",
        gap: 8,
    },
    resultCheckCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(169,247,181,0.1)",
        borderWidth: 1,
        borderColor: "rgba(169,247,181,0.3)",
    },
    resultTitle: {
        color: "#F8F0DE",
        fontSize: 22,
        fontWeight: "800",
    },
    resultDrillName: {
        color: "#6B7290",
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 1,
    },
    resultScoreLabel: {
        color: "#6B7290",
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 1,
    },
    resultScoreValue: {
        color: "#F7D38B",
        fontSize: 56,
        fontWeight: "900",
    },
    resultComparison: {
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: "rgba(14,17,34,0.6)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    resultComparisonMain: {
        color: "#F7D38B",
        fontSize: 14,
        fontWeight: "700",
    },
    resultComparisonSub: {
        color: "#6B7290",
        fontSize: 12,
        fontWeight: "600",
    },
    resultError: {
        color: "#FF9A9A",
        fontSize: 13,
    },
    resultNextLabel: {
        color: "#6B7290",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1,
        alignSelf: "flex-start",
        marginLeft: 4,
    },
    resultNextDrills: {
        width: "100%",
        gap: 8,
    },
    resultNextDrillCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderRadius: 20,
        backgroundColor: "rgba(14,17,34,0.6)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    resultNextDrillText: {
        flex: 1,
        color: "#F8F0DE",
        fontSize: 15,
        fontWeight: "700",
    },
    resultBottomActions: {
        flexDirection: "row",
        gap: 10,
        width: "100%",
        marginTop: 4,
    },
    resultChallengeBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 16,
        borderRadius: 24,
        backgroundColor: "rgba(247,211,139,0.12)",
        borderWidth: 1,
        borderColor: "rgba(247,211,139,0.3)",
    },
    resultChallengeText: {
        color: "#F7D38B",
        fontSize: 14,
        fontWeight: "700",
    },
    resultHomeBtn: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 16,
        borderRadius: 24,
        backgroundColor: "#F7D38B",
    },
    resultHomeText: {
        color: "#080A17",
        fontSize: 14,
        fontWeight: "800",
    },
});
