import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useQuery } from "convex/react";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/convex/_generated/api";
import { AuthScreen } from "@/components/auth-screen";
import { FutureselfHome } from "@/components/futureself-home";
import { OnboardingFlow } from "@/components/onboarding-flow";
import type { GameState } from "@/lib/futureself";
import { getLocalDateKey } from "@/lib/futureself";
import { useDailyReminder } from "@/lib/use-daily-reminder";

export default function Index() {
    return (
        <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
            <StatusBar style="light" />
            <SafeAreaView style={styles.safeArea}>
                <AuthLoading>
                    <LoadingState label="Opening the signal..." />
                </AuthLoading>
                <Unauthenticated>
                    <AuthScreen />
                </Unauthenticated>
                <Authenticated>
                    <GameShell />
                </Authenticated>
            </SafeAreaView>
        </LinearGradient>
    );
}

function GameShell() {
    const [dateKey] = useState(() => getLocalDateKey());
    const [now] = useState(() => Date.now());
    const state = useQuery(api.game.getState, { dateKey, now });
    useDailyReminder();

    if (state === undefined) return <LoadingState label="Tuning the constellation..." />;

    const gameState = state as GameState;
    if (!gameState.persona) return <OnboardingFlow />;
    return <FutureselfHome state={gameState} dateKey={dateKey} />;
}

interface LoadingStateProps {
    label: string;
}

function LoadingState({ label }: LoadingStateProps) {
    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator color="#F7D38B" size="large" />
            <Text style={styles.loadingText}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
    },
    loadingText: {
        color: "#BFC6DE",
        fontSize: 15,
        fontWeight: "700",
    },
});
