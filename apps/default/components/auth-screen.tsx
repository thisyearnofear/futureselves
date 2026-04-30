import { useEffect, useState } from "react";
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
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
} from "react-native-reanimated";

const TAGLINE_FULL = "A voice note from the person you are becoming.";

function useTypewriter(text: string, speed = 38, delay = 600) {
    const [displayed, setDisplayed] = useState("");
    useEffect(() => {
        let cancelled = false;
        let i = 0;
        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                i++;
                if (!cancelled) setDisplayed(text.slice(0, i));
                if (i >= text.length) clearInterval(interval);
            }, speed);
        }, delay);
        return () => { cancelled = true; clearTimeout(timeout); };
    }, [text, speed, delay]);
    return displayed;
}

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
    const tagline = useTypewriter(TAGLINE_FULL);

    // Pulsing orb animation
    const orbScale = useSharedValue(1);
    const orbGlow = useSharedValue(0.12);
    const ringRotation = useSharedValue(0);

    useEffect(() => {
        orbScale.value = withRepeat(
            withSequence(
                withTiming(1.08, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
        );
        orbGlow.value = withRepeat(
            withSequence(
                withTiming(0.28, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.12, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
        );
        ringRotation.value = withRepeat(
            withTiming(360, { duration: 18000, easing: Easing.linear }),
            -1,
            false,
        );
    }, []);

    const orbAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: orbScale.value }],
        backgroundColor: `rgba(247,211,139,${orbGlow.value})`,
    }));

    const ringAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${ringRotation.value}deg` }, { scaleX: 1.18 }],
    }));

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

    const isWeb = Platform.OS === "web";

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* ── Cinematic Hero ── */}
                <Animated.View entering={isWeb ? undefined : FadeIn.duration(400)} style={styles.heroCard}>
                    {/* Animated Orb */}
                    <View style={styles.orbContainer}>
                        <View style={styles.orbGlow} />
                        <Animated.View style={[styles.orbitRingOuter, ringAnimatedStyle]} />
                        <Animated.View style={[styles.orbitRingInner, ringAnimatedStyle]} />
                        <Animated.View style={[styles.orb, orbAnimatedStyle]}>
                            <Ionicons name="radio" size={30} color="#F7D38B" />
                        </Animated.View>
                    </View>

                    <Animated.Text entering={isWeb ? undefined : FadeInDown.delay(200).duration(600)} style={styles.eyebrow}>
                        future self
                    </Animated.Text>

                    {/* Typewriter tagline */}
                    <View style={styles.taglineContainer}>
                        <Text style={styles.title}>
                            {tagline}
                            <Text style={styles.cursor}>|</Text>
                        </Text>
                    </View>

                    <Animated.Text entering={isWeb ? undefined : FadeInDown.delay(800).duration(600)} style={styles.subtitle}>
                        One minute to begin. A daily voice transmission from your future — spoken aloud or read in silence. Your choices shape who speaks next.
                    </Animated.Text>

                    {/* Social proof / urgency nudge */}
                    <Animated.View entering={isWeb ? undefined : FadeInDown.delay(1000).duration(500)} style={styles.socialProof}>
                        <View style={styles.liveIndicator}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>Interactive fiction experience</Text>
                        </View>
                        <Text style={styles.durationHint}>~60 seconds to start · free · no account needed</Text>
                    </Animated.View>

                    {/* Promise stack */}
                    <Animated.View entering={isWeb ? undefined : FadeInDown.delay(1200).duration(500)} style={styles.promiseStack}>
                        <PromiseRow icon="headset-outline" text="AI-voiced transmissions that know your name and your mood" />
                        <PromiseRow icon="git-branch-outline" text="18 future voices unlock based on your daily choices" />
                        <PromiseRow icon="pulse-outline" text="A living story that evolves with every check-in" />
                    </Animated.View>

                    {/* Primary CTA */}
                    <Animated.View entering={isWeb ? undefined : FadeInUp.delay(1400).duration(500)}>
                        <Pressable disabled={isBusy} onPress={handleStartPrologue} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                            {isSubmitting ? (
                                <ActivityIndicator color="#101320" />
                            ) : (
                                <View style={styles.ctaInner}>
                                    <Ionicons name="play" size={18} color="#101320" />
                                    <Text style={styles.primaryText}>Begin your prologue</Text>
                                </View>
                            )}
                        </Pressable>
                        <Text style={styles.ctaSubtext}>No sign-up required — play instantly</Text>
                    </Animated.View>

                    {/* Account toggle */}
                    <Pressable disabled={isBusy} onPress={() => setIsAccountPanelOpen((current) => !current)} style={styles.accountToggle}>
                        <Text style={styles.accountToggleText}>{isAccountPanelOpen ? "Hide account options" : "Already playing? Save your timeline"}</Text>
                        <Ionicons name={isAccountPanelOpen ? "chevron-up" : "chevron-down"} size={16} color="#AEB6D4" />
                    </Pressable>
                </Animated.View>

                {isAccountPanelOpen ? (
                    <Animated.View entering={isWeb ? undefined : FadeInDown.duration(300)} style={styles.accountCard}>
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
                    </Animated.View>
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
        gap: 18,
        borderRadius: 36,
        borderCurve: "continuous",
        backgroundColor: "rgba(14,17,34,0.82)",
        borderWidth: 1,
        borderColor: "rgba(247,211,139,0.22)",
        padding: 28,
        boxShadow: "0 24px 70px rgba(0,0,0,0.38)",
    },
    orbContainer: {
        width: 110,
        height: 110,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        marginBottom: 4,
    },
    orbitRingOuter: {
        position: "absolute",
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 1,
        borderColor: "rgba(247,211,139,0.18)",
    },
    orbitRingInner: {
        position: "absolute",
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 1,
        borderColor: "rgba(247,211,139,0.12)",
    },
    orb: {
        width: 62,
        height: 62,
        borderRadius: 31,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(247,211,139,0.36)",
    },
    orbGlow: {
        position: "absolute",
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: "rgba(247,211,139,0.06)",
    },
    eyebrow: {
        color: "#F7D38B",
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 3,
        textTransform: "uppercase",
        textAlign: "center",
    },
    taglineContainer: {
        minHeight: 90,
    },
    title: {
        color: "#F7F0DF",
        fontSize: 34,
        fontWeight: "900",
        letterSpacing: -1.2,
        lineHeight: 40,
        textAlign: "center",
    },
    cursor: {
        color: "#F7D38B",
        fontWeight: "300",
    },
    subtitle: {
        color: "#BCC2DA",
        fontSize: 15,
        lineHeight: 23,
        textAlign: "center",
    },
    socialProof: {
        alignItems: "center",
        gap: 6,
    },
    liveIndicator: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        backgroundColor: "rgba(247,211,139,0.08)",
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: "#F7D38B",
    },
    liveText: {
        color: "#F7D38B",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.3,
    },
    durationHint: {
        color: "#767B96",
        fontSize: 12,
        fontWeight: "600",
    },
    promiseStack: {
        gap: 12,
        paddingVertical: 4,
    },
    promiseRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    promiseIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(247,211,139,0.1)",
        borderWidth: 1,
        borderColor: "rgba(247,211,139,0.15)",
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
        boxShadow: "0 8px 32px rgba(247,211,139,0.25)",
    },
    ctaInner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    primaryText: {
        color: "#101320",
        fontSize: 17,
        fontWeight: "900",
    },
    ctaSubtext: {
        color: "#767B96",
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 8,
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
