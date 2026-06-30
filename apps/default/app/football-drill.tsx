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
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { api } from "@/convex/_generated/api";
import { ReactionTimeDrill } from "@/components/drill-reaction-time";
import { JugglingDrill } from "@/components/drill-juggling";
import { SprintDrill } from "@/components/drill-sprint";
import { useQVACPrewarmContext } from "@/lib/qvac-prewarm-context";
import { interpretTrajectory, type FootballPosition } from "@/lib/football-llm";
import { isLocalMode } from "@/lib/ai";
import type { DrillType } from "@/lib/drill-utils";

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

                // 6. Navigate back to football home
                router.replace("/football" as any);
            } catch (e) {
                setSaveError(e instanceof Error ? e.message : "Could not save drill result.");
                setIsSaving(false);
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
});
