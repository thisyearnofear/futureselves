import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { useOAuthSignIn } from "@/hooks/use-oauth-sign-in";
import { Image } from "expo-image";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const TAGLINE_FULL = "Hear from the future version of your life.";

// Fallback avatar images for the morphing constellation behind the orb.
// Uses bundled assets only — no Convex query needed before a persona exists.
const CONSTELLATION_AVATARS = [
  require("@/assets/images/avatars/future_self.webp"),
  require("@/assets/images/avatars/future_partner.webp"),
  require("@/assets/images/avatars/future_mentor.webp"),
  require("@/assets/images/avatars/shadow.webp"),
  require("@/assets/images/avatars/the_ghost.webp"),
  require("@/assets/images/avatars/alternate_self.webp"),
] as const;

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
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
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
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = isSubmitting || isOAuthLoading;
  const tagline = useTypewriter(TAGLINE_FULL);

  // ── Orb pulse ──
  const orbScale = useSharedValue(1);
  const orbGlow = useSharedValue(0.12);

  useEffect(() => {
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    orbGlow.value = withRepeat(
      withSequence(
        withTiming(0.24, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.12, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  // ── Morphing constellation: 6 faint portraits orbiting the orb,
  // auto-rotating and crossfading. Each portrait sits at a fixed angle and
  // fades in/out as the morph sweep passes through it. ──
  const morphProgress = useSharedValue(0);
  useEffect(() => {
    morphProgress.value = withRepeat(
      withTiming(CONSTELLATION_AVATARS.length, { duration: 21000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const orbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    backgroundColor: `rgba(247,211,139,${orbGlow.value})`,
  }));

  async function handleStartPrologue() {
    setIsSubmitting(true);
    setError(null);
    try {
      await signIn("anonymous");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not open the prologue.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not authenticate.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWith("google");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Google sign-in failed.",
      );
    }
  }

  const isWeb = Platform.OS === "web";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.hero}>
        {/* ── Morphing constellation behind the orb ── */}
        <View style={styles.constellationContainer} pointerEvents="none">
          {CONSTELLATION_AVATARS.map((avatarSrc, index) => {
            const angle = (index / CONSTELLATION_AVATARS.length) * Math.PI * 2;
            const radius = 130;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <ConstellationPortrait
                key={index}
                index={index}
                src={avatarSrc}
                x={x}
                y={y}
                morphProgress={morphProgress}
                totalStates={CONSTELLATION_AVATARS.length}
              />
            );
          })}
        </View>

        {/* ── Orb ── */}
        <View style={styles.orbContainer}>
          <View style={styles.orbGlowStatic} />
          <Animated.View style={[styles.orb, orbAnimatedStyle]}>
            <Ionicons name="radio" size={28} color="#F7D38B" />
          </Animated.View>
        </View>

        {/* ── Tagline ── */}
        <Animated.View
          entering={isWeb ? undefined : FadeInDown.delay(400).duration(800)}
          style={styles.taglineWrap}
        >
          <Text style={styles.eyebrow}>future self</Text>
          <Text style={styles.title}>
            {tagline}
            <Text style={styles.cursor}>|</Text>
          </Text>
        </Animated.View>

        {/* ── Single CTA ── */}
        <Animated.View
          entering={isWeb ? undefined : FadeInUp.delay(1200).duration(600)}
        >
          <Pressable
            disabled={isBusy}
            onPress={handleStartPrologue}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#101320" />
            ) : (
              <View style={styles.ctaInner}>
                <Ionicons name="play" size={18} color="#101320" />
                <Text style={styles.primaryText}>Begin</Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.ctaSubtext}>
            No sign-up — about a minute to your first transmission
          </Text>
        </Animated.View>

        {/* ── Account sheet toggle ── */}
        <Pressable
          disabled={isBusy}
          onPress={() => {
            setIsAccountSheetOpen(true);
            setError(null);
          }}
          style={styles.accountToggle}
        >
          <Text style={styles.accountToggleText}>Have an account?</Text>
          <Ionicons name="chevron-up" size={14} color="#8F96B4" />
        </Pressable>
      </View>

      {/* ── Account bottom sheet ── */}
      {isAccountSheetOpen ? (
        <Animated.View
          entering={isWeb ? undefined : SlideInDown.duration(400).springify().damping(20)}
          style={styles.sheetOverlay}
        >
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setIsAccountSheetOpen(false)}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {mode === "signUp" ? "Create your account" : "Return to your timeline"}
            </Text>
            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setMode("signUp")}
                style={[styles.modeButton, mode === "signUp" && styles.modeActive]}
              >
                <Text style={[styles.modeText, mode === "signUp" && styles.modeTextActive]}>Create</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("signIn")}
                style={[styles.modeButton, mode === "signIn" && styles.modeActive]}
              >
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
            <Pressable
              disabled={isBusy}
              onPress={handlePasswordAuth}
              style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
            >
              {isBusy ? (
                <ActivityIndicator color="#101320" />
              ) : (
                <Text style={styles.accountButtonText}>
                  {mode === "signUp" ? "Create account" : "Return to story"}
                </Text>
              )}
            </Pressable>
            <Pressable
              disabled={isBusy}
              onPress={handleGoogle}
              style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
            >
              <Ionicons name="logo-google" size={17} color="#F7F0DF" />
              <Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {error ? (
        <Animated.Text entering={isWeb ? undefined : FadeIn.duration(200)} style={styles.error}>
          {error}
        </Animated.Text>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// ── Constellation portrait: a single faint avatar positioned on the orbit
// ring, whose opacity derives from the wrapping morph progress. Each portrait
// lights up as the morph sweep passes through its index, then fades as it
// moves to the next. ──

interface ConstellationPortraitProps {
  index: number;
  src: number;
  x: number;
  y: number;
  morphProgress: ReturnType<typeof useSharedValue<number>>;
  totalStates: number;
}

function ConstellationPortrait({
  index,
  src,
  x,
  y,
  morphProgress,
  totalStates,
}: ConstellationPortraitProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = morphProgress.value % totalStates;
    const distance = Math.abs(progress - index);
    const wrappedDistance = Math.min(distance, totalStates - distance);
    const opacity = interpolate(
      wrappedDistance,
      [0, 1.5],
      [0.5, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      wrappedDistance,
      [0, 1.5],
      [1.08, 0.85],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { scale }],
    };
  });

  return (
    <Animated.View style={[styles.constellationPortrait, animatedStyle]}>
      <Image
        source={src}
        style={styles.constellationImage}
        contentFit="cover"
        blurRadius={2}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  hero: {
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    gap: 10,
  },
  constellationContainer: {
    position: "absolute",
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
    top: -40,
  },
  constellationPortrait: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  constellationImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  orbContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  orbGlowStatic: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(247,211,139,0.05)",
  },
  orb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.3)",
  },
  taglineWrap: {
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase",
    textAlign: "center",
  },
  title: {
    color: "#F7F0DF",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 36,
    textAlign: "center",
  },
  cursor: {
    color: "#F7D38B",
    fontWeight: "300",
  },
  primaryButton: {
    minHeight: 56,
    width: 220,
    borderRadius: 28,
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
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 6,
  },
  accountToggleText: {
    color: "#8F96B4",
    fontSize: 13,
    fontWeight: "700",
  },
  sheetOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetCard: {
    backgroundColor: "#11162B",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: "continuous",
    padding: 24,
    paddingBottom: 40,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.14)",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetTitle: {
    color: "#F8F0DE",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
    textAlign: "center",
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
    minHeight: 50,
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
    minHeight: 50,
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
    textAlign: "center",
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
