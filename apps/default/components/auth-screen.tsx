import { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { useOAuthSignIn } from "@/hooks/use-oauth-sign-in";

export function AuthScreen() {
    const { signIn } = useAuthActions();
    const { signInWith, isLoading: isOAuthLoading } = useOAuthSignIn();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState<"signIn" | "signUp">("signUp");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isBusy = isSubmitting || isOAuthLoading;

    async function handlePasswordAuth() {
        if (!email.trim() || !password) {
            setError("Enter an email and password to continue.");
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            await signIn("password", {
                email: email.trim(),
                password,
                flow: mode,
            });
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Could not authenticate.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleStartPrologue() {
        setIsSubmitting(true);
        setError(null);
        try {
            await signIn("anonymous");
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Could not open the prologue.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleGoogle() {
        setError(null);
        try {
            await signInWith("google");
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Google sign-in failed.");
        }
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.heroCard}>
                    <View style={styles.orbitShell}>
                        <View style={styles.orbitRing} />
                        <View style={styles.orb}>
                            <Ionicons name="radio" size={28} color="#F7D38B" />
                        </View>
                    </View>

                    <Text style={styles.eyebrow}>future self / interactive fiction</Text>
                    <Text style={styles.title}>A voice note from the person you are becoming.</Text>
                    <Text style={styles.subtitle}>
                        Begin with a few intimate prompts in about a minute. Then receive a daily transmission — spoken when audio is available, always readable when it is not.
                    </Text>

                    <View style={styles.promiseStack}>
                        <PromiseRow icon="book-outline" text="A novel-like onboarding sequence, not a login wall." />
                        <PromiseRow icon="mic-outline" text="Your first signal respects the voice you choose in the prologue." />
                        <PromiseRow icon="sparkles-outline" text="Daily choices and streaks decide which future voices unlock next." />
                    </View>

                    <Pressable disabled={isBusy} onPress={handleStartPrologue} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                        {isSubmitting ? <ActivityIndicator color="#101320" /> : <Text style={styles.primaryText}>Start the prologue</Text>}
                    </Pressable>

                    <Pressable disabled={isBusy} onPress={() => setIsAccountPanelOpen((current) => !current)} style={styles.accountToggle}>
                        <Text style={styles.accountToggleText}>{isAccountPanelOpen ? "Hide account options" : "Save progress or return"}</Text>
                        <Ionicons name={isAccountPanelOpen ? "chevron-up" : "chevron-down"} size={16} color="#AEB6D4" />
                    </Pressable>
                </View>

                {isAccountPanelOpen ? (
                    <View style={styles.accountCard}>
                        <Text style={styles.accountTitle}>Optional account</Text>
                        <Text style={styles.accountCopy}>
                            You can play first. Add an account when you want cross-session persistence and a safer long-running timeline.
                        </Text>

                        <View style={styles.modeRow}>
                            <Pressable onPress={() => setMode("signUp")} style={[styles.modeButton, mode === "signUp" && styles.modeActive]}>
                                <Text style={[styles.modeText, mode === "signUp" && styles.modeTextActive]}>Create</Text>
                            </Pressable>
                            <Pressable onPress={() => setMode("signIn")} style={[styles.modeButton, mode === "signIn" && styles.modeActive]}>
                                <Text style={[styles.modeText, mode === "signIn" && styles.modeTextActive]}>Return</Text>
                            </Pressable>
                        </View>

                        <TextInput
                            autoCapitalize="none"
                            autoComplete="email"
                            keyboardType="email-address"
                            onChangeText={setEmail}
                            placeholder="email"
                            placeholderTextColor="#767B96"
                            style={styles.input}
                            value={email}
                        />
                        <TextInput
                            onChangeText={setPassword}
                            placeholder="password"
                            placeholderTextColor="#767B96"
                            secureTextEntry
                            style={styles.input}
                            value={password}
                        />

                        <Pressable disabled={isBusy} onPress={handlePasswordAuth} style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}>
                            {isBusy ? <ActivityIndicator color="#101320" /> : <Text style={styles.accountButtonText}>{mode === "signUp" ? "Create account" : "Return to story"}</Text>}
                        </Pressable>

                        <Pressable disabled={isBusy} onPress={handleGoogle} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}>
                            <Ionicons name="logo-google" size={17} color="#F7F0DF" />
                            <Text style={styles.googleText}>Continue with Google</Text>
                        </Pressable>
                    </View>
                ) : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

interface PromiseRowProps {
    icon: keyof typeof Ionicons.glyphMap;
    text: string;
}

function PromiseRow({ icon, text }: PromiseRowProps) {
    return (
        <View style={styles.promiseRow}>
            <View style={styles.promiseIcon}>
                <Ionicons name={icon} size={16} color="#F7D38B" />
            </View>
            <Text style={styles.promiseText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        justifyContent: "center",
        padding: 20,
        paddingBottom: 34,
        gap: 14,
    },
    heroCard: {
        gap: 16,
        borderRadius: 36,
        borderCurve: "continuous",
        backgroundColor: "rgba(14,17,34,0.82)",
        borderWidth: 1,
        borderColor: "rgba(247,211,139,0.22)",
        padding: 24,
        boxShadow: "0 24px 70px rgba(0,0,0,0.38)",
    },
    orbitShell: {
        width: 92,
        height: 92,
        alignItems: "center",
        justifyContent: "center",
    },
    orbitRing: {
        position: "absolute",
        width: 92,
        height: 92,
        borderRadius: 46,
        borderWidth: 1,
        borderColor: "rgba(247,211,139,0.24)",
        transform: [{ scaleX: 1.18 }, { rotate: "-18deg" }],
    },
    orb: {
        width: 62,
        height: 62,
        borderRadius: 31,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(247,211,139,0.12)",
        borderWidth: 1,
        borderColor: "rgba(247,211,139,0.32)",
    },
    eyebrow: {
        color: "#F7D38B",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 2.1,
        textTransform: "uppercase",
    },
    title: {
        color: "#F7F0DF",
        fontSize: 39,
        fontWeight: "900",
        letterSpacing: -1.45,
        lineHeight: 42,
    },
    subtitle: {
        color: "#BCC2DA",
        fontSize: 16,
        lineHeight: 24,
    },
    promiseStack: {
        gap: 10,
        paddingVertical: 2,
    },
    promiseRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    promiseIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(247,211,139,0.1)",
    },
    promiseText: {
        flex: 1,
        color: "#DAD4C9",
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "700",
    },
    primaryButton: {
        minHeight: 58,
        borderRadius: 21,
        borderCurve: "continuous",
        backgroundColor: "#F7D38B",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
    },
    primaryText: {
        color: "#101320",
        fontSize: 17,
        fontWeight: "900",
    },
    accountToggle: {
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    accountToggleText: {
        color: "#AEB6D4",
        fontSize: 14,
        fontWeight: "800",
    },
    accountCard: {
        gap: 12,
        padding: 18,
        borderRadius: 28,
        borderCurve: "continuous",
        backgroundColor: "rgba(14,17,34,0.66)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    accountTitle: {
        color: "#F7F0DF",
        fontSize: 19,
        fontWeight: "900",
        letterSpacing: -0.3,
    },
    accountCopy: {
        color: "#9CA4C3",
        fontSize: 13,
        lineHeight: 19,
    },
    modeRow: {
        flexDirection: "row",
        gap: 8,
    },
    modeButton: {
        flex: 1,
        borderRadius: 16,
        borderCurve: "continuous",
        paddingVertical: 11,
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    modeActive: {
        backgroundColor: "rgba(247,211,139,0.16)",
    },
    modeText: {
        color: "#9CA4C3",
        fontSize: 13,
        fontWeight: "800",
    },
    modeTextActive: {
        color: "#F7D38B",
    },
    input: {
        minHeight: 52,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.11)",
        color: "#F7F0DF",
        paddingHorizontal: 16,
        fontSize: 16,
    },
    accountButton: {
        minHeight: 52,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: "#F7D38B",
        alignItems: "center",
        justifyContent: "center",
    },
    accountButtonText: {
        color: "#101320",
        fontSize: 15,
        fontWeight: "900",
    },
    googleButton: {
        minHeight: 46,
        borderRadius: 16,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    googleText: {
        color: "#F7F0DF",
        fontWeight: "800",
        fontSize: 14,
    },
    error: {
        color: "#FF9A9A",
        fontSize: 13,
        lineHeight: 18,
        paddingHorizontal: 4,
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.99 }],
    },
});
