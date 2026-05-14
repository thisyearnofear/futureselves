import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoicemailExperience } from "@/components/voicemail-experience";
import { Stack } from "expo-router";

export default function VoicemailScreen() {
    return (
        <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
            <StatusBar style="light" />
            <Stack.Screen 
                options={{
                    title: "The Last Voicemail",
                    headerShown: true,
                    headerTransparent: true,
                    headerShadowVisible: false,
                    headerTintColor: "#F8F0DE",
                    headerBackButtonDisplayMode: "minimal",
                }}
            />
            <SafeAreaView style={styles.safeArea}>
                <VoicemailExperience />
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
});
