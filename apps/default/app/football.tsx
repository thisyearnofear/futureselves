import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { api } from "@/convex/_generated/api";
import { FootballAmbitionDeclaration } from "@/components/football-ambition-declaration";
import { FootballHome } from "@/components/football-home";
import { BottomNav } from "@/components/bottom-nav";
import { useQVACPrewarmContext } from "@/lib/qvac-prewarm-context";
import { isLocalMode } from "@/lib/ai";

export default function FootballScreen() {
    const router = useRouter();
    const prewarm = useQVACPrewarmContext();
    const ambition = useQuery(api.football.getActiveAmbition, {});
    const state = useQuery(api.game.getState, {
        dateKey: new Date().toISOString().split("T")[0]!,
    });

    const llmModelId = isLocalMode() ? prewarm?.llm.modelId ?? null : null;
    const sttModelId = isLocalMode() ? prewarm?.stt.modelId ?? null : null;
    const ttsModelId = isLocalMode() ? prewarm?.tts.modelId ?? null : null;

    const handleDeclared = useCallback(() => {
        // The ambition query will refetch and show the FootballHome
    }, []);

    const handleOpenDrill = useCallback((drillType: "reaction_time" | "juggling" | "sprint") => {
        router.push({ pathname: "/football-drill", params: { type: drillType } } as any);
    }, [router]);

    return (
        <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
            <StatusBar style="light" />
            <Stack.Screen
                options={{
                    title: "Football Path",
                    headerShown: false,
                }}
            />
            <SafeAreaView style={styles.safeArea}>
                {ambition === undefined || state === undefined ? (
                    <View style={styles.loadingContainer} />
                ) : !ambition ? (
                    <FootballAmbitionDeclaration
                        llmModelId={llmModelId}
                        sttModelId={sttModelId}
                        onDeclared={handleDeclared}
                    />
                ) : (
                    <FootballHome
                        llmModelId={llmModelId}
                        ttsModelId={ttsModelId}
                        playerName={state.persona?.name ?? "Player"}
                        streak={state.persona?.streak ?? 0}
                        onOpenDrill={handleOpenDrill}
                    />
                )}
                <BottomNav />
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1 },
});
