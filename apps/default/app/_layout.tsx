import { ConvexReactClient, Authenticated } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { useAvatarPreloading } from "@/hooks/use-avatar-preloading";

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

export default function RootLayout() {
    return (
        <ConvexAuthProvider client={convex} storage={isNative ? secureStorage : undefined}>
            <Authenticated>
                <AvatarPreloader />
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
