import { ConvexReactClient, Authenticated, useQuery } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { useAvatarPreloading } from "@/hooks/use-avatar-preloading";
import { useQVACPrewarm } from "@/hooks/use-qvac-prewarm";
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

function AvatarPreloader() {
    useAvatarPreloading();
    return null;
}

/**
 * Pre-warms the on-device QVAC models (LLM + TTS) so the first
 * transmission arrives without a cold-start wait. Only active on
 * native when `EXPO_PUBLIC_AI_PROVIDER === "local"`.
 * The QVAC SDK is loaded lazily inside the hook body.
 */
function QVACPrewarmer() {
    const persona = useQuery(api.game.getState, { dateKey: new Date().toISOString().split("T")[0]! });
    useQVACPrewarm({ personaId: persona?.persona?.id ?? null });
    return null;
}

export default function RootLayout() {
    return (
        <ConvexAuthProvider client={convex} storage={isNative ? secureStorage : undefined}>
            <Authenticated>
                <AvatarPreloader />
                <QVACPrewarmer />
            </Authenticated>
            <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="landing" options={{ headerShown: false }} />
                <Stack.Screen
                    name="archive"
                    options={{
                        title: "Archive",
                        headerShown: true,
                        headerTransparent: true,
                        headerShadowVisible: false,
                        headerTintColor: "#F8F0DE",
                        headerBackButtonDisplayMode: "minimal",
                    }}
                />
            </Stack>
        </ConvexAuthProvider>
    );
}
