import { useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Stable references so the map callbacks below don't recreate layout animations
// on every render. (Reanimated treats a new object identity as a new animation.)
const HERO_ENTER = undefined;
const CTA_ENTER = undefined;
const STEPS_ENTER: any[] = [undefined, undefined, undefined];
const FEATURES_ENTER: any[] = Array.from({ length: 6 }, () => undefined);
const TESTIMONIALS_ENTER: any[] = Array.from({ length: 3 }, () => undefined);
const FINAL_CTA_ENTER = undefined;

/**
 * On web we render the full tagline immediately to avoid the rAF + setState
 * storm that previously froze the page. On native we run a lightweight
 * typewriter via setInterval, but only while JS-thread rAF is alive (no
 * Reanimated coupling that would re-trigger React renders).
 */
function useTypewriter(text: string, _speed = 42, _delay = 800): string {
  const [slice, setSlice] = useState(text);
  const isWeb = Platform.OS === "web";
  useEffect(() => {
    if (isWeb) return;
    setSlice("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setSlice(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, _speed);
    return () => clearInterval(id);
  }, [text, _speed, isWeb]);
  return slice;
}

const FEATURES = [
  {
    icon: "mic-outline" as const,
    glyph: "🜲",
    title: "Voice",
    body: "AI voices from your future",
    accent: "#F7D38B",
  },
  {
    icon: "git-branch-outline" as const,
    glyph: "✶",
    title: "Choice",
    body: "Each day shifts the line",
    accent: "#A9F7B5",
  },
  {
    icon: "people-outline" as const,
    glyph: "✺",
    title: "Voices",
    body: "A constellation of selves",
    accent: "#C9B6FF",
  },
  {
    icon: "sparkles-outline" as const,
    glyph: "✦",
    title: "Synthesis",
    body: "Weekly themes from your words",
    accent: "#FF9A9A",
  },
  {
    icon: "call-outline" as const,
    glyph: "✹",
    title: "Voicemail",
    body: "Raw voice at every milestone",
    accent: "#9AE3F7",
  },
  {
    icon: "shield-checkmark-outline" as const,
    glyph: "✜",
    title: "Awakened",
    body: "Keep every earned voice fully lit",
    accent: "#F7D38B",
  },
];

// NOTE: these are placeholder testimonials ("Day 3"/"Day 14"/"Day 21" as
// authors, no real names) — they read as fabricated user quotes if shipped
// publicly as-is. Flagging rather than silently deleting: replace with real
// user quotes before this page goes live for the Shipaton submission, or
// remove the section if none exist yet. See docs/product-narrative.md.
const TESTIMONIALS = [
  {
    quote: "The first time I heard my future self say my name, I cried.",
    author: "Day 3",
  },
  {
    quote: "The only app I open before coffee.",
    author: "Day 14",
  },
  {
    quote: "A phone app that makes me braver. Didn't see that coming.",
    author: "Day 21",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const tagline = useTypewriter("Hear from the future version of your life.");
  const isWeb = Platform.OS === "web";

  // Orb animation
  const orbScale = useSharedValue(1);
  const orbGlow = useSharedValue(0.12);

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
  }, []);

  const orbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    backgroundColor: `rgba(247,211,139,${orbGlow.value})`,
  }));

  return (
    <View style={[s.bg, isWeb && s.bgWeb]}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <Animated.View
            entering={HERO_ENTER}
            style={s.hero}
          >
            <View style={s.orbContainer}>
              <View style={s.orbGlow} />
              <Animated.View style={[s.orb, orbAnimatedStyle]}>
                <Ionicons name="radio" size={30} color="#F7D38B" />
              </Animated.View>
            </View>

            <Text style={s.eyebrow}>future self</Text>

            <View style={s.taglineWrap}>
              <Text style={s.tagline}>
                {tagline}
                <Text style={s.cursor}>|</Text>
              </Text>
            </View>

            <Text style={s.subtitle}>
              A daily ritual where AI voices from your future speak to the person you are today. One word. One transmission. One choice — every day.
            </Text>

            <Animated.View
              entering={CTA_ENTER}
            >
              <Pressable
                onPress={() => router.replace("/")}
                style={({ pressed }) => [s.ctaButton, pressed && s.pressed]}
              >
                <Ionicons name="play" size={18} color="#101320" />
                <Text style={s.ctaText}>Begin your prologue</Text>
              </Pressable>
              <Text style={s.ctaSub}>
                No sign-up required — about a minute to your first transmission
              </Text>
            </Animated.View>
          </Animated.View>

          {/* ── How It Works ── */}
          <View style={s.sectionHeader}>
            <Ionicons name="compass-outline" size={18} color="#F7D38B" />
            <Text style={s.sectionTitle}>How it works</Text>
          </View>

          <View style={s.stepsRow}>
            {[
              { step: "1", label: "Give today one word", sub: "30 seconds" },
              { step: "2", label: "Receive a transmission", sub: "Listen or read" },
              { step: "3", label: "Make a choice", sub: "Shapes tomorrow" },
            ].map((item, i) => (
              <Animated.View
                key={item.step}
                entering={STEPS_ENTER[i]}
                style={s.stepCard}
              >
                <View style={s.stepCircle}>
                  <Text style={s.stepNumber}>{item.step}</Text>
                </View>
                <Text style={s.stepLabel}>{item.label}</Text>
                <Text style={s.stepSub}>{item.sub}</Text>
              </Animated.View>
            ))}
          </View>

          {/* ── Features ── */}
          <View style={s.sectionHeader}>
            <Ionicons name="layers-outline" size={18} color="#F7D38B" />
            <Text style={s.sectionTitle}>What&apos;s inside</Text>
          </View>

          <View style={s.featureGrid}>
            {FEATURES.map((feature, i) => (
              <Animated.View
                key={feature.title}
                entering={FEATURES_ENTER[i]}
                style={[s.featureCard, { borderColor: `${feature.accent}33` }]}
              >
                <Text
                  style={[s.featureGlyph, { color: feature.accent }]}
                  accessibilityElementsHidden
                >
                  {feature.glyph}
                </Text>
                <Text style={s.featureTitle}>{feature.title}</Text>
                <Text style={s.featureBody}>{feature.body}</Text>
              </Animated.View>
            ))}
          </View>

          {/* ── Testimonials ── */}
          <View style={s.sectionHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#F7D38B" />
            <Text style={s.sectionTitle}>Early voices</Text>
          </View>

          <View style={s.testimonialCol}>
            {TESTIMONIALS.map((t, i) => (
              <Animated.View
                key={i}
                entering={TESTIMONIALS_ENTER[i]}
                style={s.testimonialCard}
              >
                <Text style={s.testimonialQuote}>&ldquo;{t.quote}&rdquo;</Text>
                <Text style={s.testimonialAuthor}>{t.author}</Text>
              </Animated.View>
            ))}
          </View>

          {/* ── Final CTA ── */}
          <Animated.View
            entering={FINAL_CTA_ENTER}
            style={s.finalCta}
          >
            <Text style={s.finalCtaTitle}>
              Someone from your future has been trying to reach you.
            </Text>
            <Pressable
              onPress={() => router.replace("/")}
              style={({ pressed }) => [s.ctaButton, pressed && s.pressed]}
            >
              <Ionicons name="play" size={18} color="#101320" />
              <Text style={s.ctaText}>Start the ritual</Text>
            </Pressable>
          </Animated.View>

          <View style={s.footer}>
            <View style={s.footerBrand}>
              <View style={s.footerDot} />
              <Text style={s.footerBrandText}>future self</Text>
            </View>
            <Text style={s.footerCopy}>
              A daily narrative ritual. Built with love and AI.
            </Text>
            <View style={s.footerPrivacyRow}>
              <Text style={s.footerPrivacyText}>
                This is a demo with sample data.{" "}
                <Text
                  style={s.footerPrivacyLink}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      window.open(
                        "https://github.com/thisyearnofear/futureselves/blob/main/docs/privacy-posture.md",
                        "_blank",
                      );
                    }
                  }}
                >
                  Privacy statement
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#080A17" },
  bgWeb: {
    backgroundImage: "linear-gradient(180deg, #080A17 0%, #11162B 50%, #21172D 100%)",
  },
  scroll: {
    alignItems: "center",
    padding: 20,
    paddingBottom: 60,
    gap: 32,
  },
  hero: {
    width: "100%",
    maxWidth: 720,
    gap: 18,
    borderRadius: 36,
    borderCurve: "continuous",
    backgroundColor: "rgba(14,17,34,0.82)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.22)",
    padding: 28,
    boxShadow: "0 24px 70px rgba(0,0,0,0.38)",
    alignItems: "center",
  },
  orbContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
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
  taglineWrap: { minHeight: 74 },
  tagline: {
    color: "#F7F0DF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 40,
    textAlign: "center",
  },
  cursor: { color: "#F7D38B", fontWeight: "300" },
  subtitle: {
    color: "#BCC2DA",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 460,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 58,
    borderRadius: 21,
    borderCurve: "continuous",
    backgroundColor: "#F7D38B",
    paddingHorizontal: 28,
    boxShadow: "0 8px 32px rgba(247,211,139,0.25)",
  },
  ctaText: {
    color: "#101320",
    fontSize: 17,
    fontWeight: "900",
  },
  ctaSub: {
    color: "#767B96",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },

  // Section headers
  sectionHeader: {
    width: "100%",
    maxWidth: 720,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: "#F8F0DE",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  // Steps
  stepsRow: {
    width: "100%",
    maxWidth: 720,
    flexDirection: "row",
    gap: 12,
  },
  stepCard: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,211,139,0.12)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.3)",
  },
  stepNumber: {
    color: "#F7D38B",
    fontSize: 16,
    fontWeight: "900",
  },
  stepLabel: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  stepSub: {
    color: "#8F96B4",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  // Features
  featureGrid: {
    width: "100%",
    maxWidth: 720,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  featureCard: {
    width: SCREEN_WIDTH > 600 ? "48%" : "100%",
    gap: 8,
    padding: 20,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(14,17,34,0.72)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.12)",
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,211,139,0.1)",
  },
  featureGlyph: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "300",
    textShadowColor: "rgba(247,211,139,0.45)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  featureTitle: {
    color: "#F8F0DE",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  featureBody: {
    color: "#AEB6D4",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },

  // Testimonials
  testimonialCol: {
    width: "100%",
    maxWidth: 720,
    gap: 12,
  },
  testimonialCard: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  testimonialQuote: {
    color: "#E8E1D3",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    fontStyle: "italic",
  },
  testimonialAuthor: {
    color: "#8F96B4",
    fontSize: 12,
    fontWeight: "800",
  },

  // Final CTA
  finalCta: {
    width: "100%",
    maxWidth: 720,
    alignItems: "center",
    gap: 20,
    padding: 32,
    borderRadius: 36,
    borderCurve: "continuous",
    backgroundColor: "rgba(14,17,34,0.82)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.22)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.38)",
  },
  finalCtaTitle: {
    color: "#F8F0DE",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 32,
    textAlign: "center",
  },

  // Footer
  footer: {
    alignItems: "center",
    gap: 8,
    paddingTop: 16,
  },
  footerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F7D38B",
  },
  footerBrandText: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  footerCopy: {
    color: "#6F7591",
    fontSize: 12,
    fontWeight: "600",
  },
  footerPrivacyRow: {
    width: "100%",
    maxWidth: 720,
    gap: 6,
    alignItems: "center",
    marginTop: 4,
  },
  footerPrivacyText: {
    color: "#5A6180",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 460,
  },
  footerPrivacyLink: {
    color: "#A0B4D0",
    textDecorationLine: "underline",
    cursor: "pointer",
  },
});
