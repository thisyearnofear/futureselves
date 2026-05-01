import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
    unsavedChangesWarning: false,
});

const secureStorage = {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
};

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export default function RootLayout() {
    return (
        <ConvexAuthProvider client={convex} storage={isNative ? secureStorage : undefined}>
            <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
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
