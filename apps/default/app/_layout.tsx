import { useEffect, useState } from "react";
import { ConvexReactClient, Authenticated, useQuery, useMutation, useConvexAuth } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { useAvatarPreloading } from "@/hooks/use-avatar-preloading";
import { useQVACPrewarm } from "@/hooks/use-qvac-prewarm";
import { QVACPrewarmProvider, type QVACPrewarmState } from "@/lib/qvac-prewarm-context";
import { configureRevenueCat, identifyRevenueCatUser, useCustomerInfo } from "@/lib/revenuecat";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
    unsavedChangesWarning: false,
});

const secureStorage = {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
};

const isNative = Platform.OS === "ios" || Platform.OS === "android";

if (isNative) {
    // Configured at module scope (not inside a component effect) so it's
    // guaranteed to finish before any hook that depends on it — notably
    // useCustomerInfo() in RevenueCatIdentifier below, which would silently
    // skip its first fetch if `configured` were still false when its effect
    // runs. See lib/revenuecat.ts.
    configureRevenueCat();
}

const IDLE_PREWARM: QVACPrewarmState = {
    llm: { status: "idle" },
    tts: { status: "idle" },
    stt: { status: "idle" },
    isReady: false,
};

function AvatarPreloader() {
    useAvatarPreloading();
    return null;
}

function RevenueCatIdentifier() {
    const { isAuthenticated } = useConvexAuth();
    const userId = useQuery(api.users.getCurrentUserId, isAuthenticated ? {} : "skip");
    const { isAwakened, isLoading } = useCustomerInfo();
    const syncEntitlement = useMutation(api.revenuecat.syncEntitlementFromClient);

    useEffect(() => {
        if (Platform.OS === "web" || !userId) return;
        void identifyRevenueCatUser(userId);
    }, [userId]);

    // Closes a gap where a RevenueCat webhook arrives before this user's
    // persona exists yet (e.g. purchased before finishing onboarding) — the
    // webhook handler no-ops in that case (see revenuecat.ts
    // applyEntitlementState), so re-apply once we have both a persona and
    // RevenueCat's live entitlement state. See docs/shipaton-2026.md.
    useEffect(() => {
        if (Platform.OS === "web" || !userId || isLoading) return;
        void syncEntitlement({ hasAwakenedEntitlement: isAwakened });
    }, [userId, isAwakened, isLoading, syncEntitlement]);

    return null;
}

function QVACPrewarmUpdater({ onState }: { onState: (state: QVACPrewarmState) => void }) {
    const persona = useQuery(api.game.getState, { dateKey: new Date().toISOString().split("T")[0]! });
    const prewarm = useQVACPrewarm({ personaId: persona?.persona?.id ?? null });
    // Bug fix: calling onState (a parent setState) during render caused an
    // infinite render loop because each render constructed a new object
    // reference. Push the publish into an effect, keyed on primitive status
    // values so a fresh object reference from useQVACPrewarm doesn't refire.
    useEffect(() => {
        onState({
            llm: prewarm.llm,
            tts: prewarm.tts,
            stt: prewarm.stt,
            isReady: prewarm.isReady,
        });
    }, [prewarm.llm.status, prewarm.tts.status, prewarm.stt.status, prewarm.isReady, onState]);
    return null;
}

export default function RootLayout() {
    const [prewarmState, setPrewarmState] = useState<QVACPrewarmState>(IDLE_PREWARM);

    return (
        <ConvexAuthProvider client={convex} storage={isNative ? secureStorage : undefined}>
            <QVACPrewarmProvider value={prewarmState}>
                <RevenueCatIdentifier />
                <Authenticated>
                    <AvatarPreloader />
                    <QVACPrewarmUpdater onState={setPrewarmState} />
                </Authenticated>
                <Stack>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="landing" options={{ headerShown: false }} />
                    <Stack.Screen
                        name="constellation"
                        options={{
                            title: "Constellation",
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="archive"
                        options={{
                            title: "Archive",
                            headerShown: false,
                            headerTransparent: true,
                            headerShadowVisible: false,
                            headerTintColor: "#F8F0DE",
                            headerBackButtonDisplayMode: "minimal",
                        }}
                    />
                    <Stack.Screen
                        name="football"
                        options={{
                            title: "Football Path",
                            headerShown: false,
                            headerTransparent: true,
                            headerShadowVisible: false,
                            headerTintColor: "#F8F0DE",
                            headerBackButtonDisplayMode: "minimal",
                        }}
                    />
                    <Stack.Screen
                        name="football-drill"
                        options={{
                            title: "Drill",
                            headerShown: false,
                            headerTransparent: true,
                            headerShadowVisible: false,
                            headerTintColor: "#F8F0DE",
                            headerBackButtonDisplayMode: "minimal",
                        }}
                    />
                </Stack>
            </QVACPrewarmProvider>
        </ConvexAuthProvider>
    );
}
