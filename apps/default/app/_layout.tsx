import { useState } from "react";
import { ConvexReactClient, Authenticated, useQuery } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { useAvatarPreloading } from "@/hooks/use-avatar-preloading";
import { useQVACPrewarm } from "@/hooks/use-qvac-prewarm";
import { QVACPrewarmProvider, type QVACPrewarmState } from "@/lib/qvac-prewarm-context";
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

function QVACPrewarmUpdater({ onState }: { onState: (state: QVACPrewarmState) => void }) {
    const persona = useQuery(api.game.getState, { dateKey: new Date().toISOString().split("T")[0]! });
    const prewarm = useQVACPrewarm({ personaId: persona?.persona?.id ?? null });
    onState({ llm: prewarm.llm, tts: prewarm.tts, stt: prewarm.stt, isReady: prewarm.isReady });
    return null;
}

export default function RootLayout() {
    const [prewarmState, setPrewarmState] = useState<QVACPrewarmState>(IDLE_PREWARM);

    return (
        <ConvexAuthProvider client={convex} storage={isNative ? secureStorage : undefined}>
            <QVACPrewarmProvider value={prewarmState}>
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
                </Stack>
            </QVACPrewarmProvider>
        </ConvexAuthProvider>
    );
}
