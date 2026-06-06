import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function useTypewriter(text: string, speed = 42, delay = 800) {
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

const FEATURES = [
  {
    icon: "mic-outline" as const,
    title: "Spoken transmissions",
    body: "AI-generated voice messages from the future version of your life. Not a chatbot — a voice that knows your name, your fears, and your direction.",
  },
  {
    icon: "key-outline" as const,
    title: "One word a day",
    body: "Your daily ritual takes 30 seconds. Give today one word, and your future self will respond with a personal transmission.",
  },
  {
    icon: "git-branch-outline" as const,
    title: "Choices shape the story",
    body: "Each day you choose: move toward, hold steady, release, or repair. Your choices shift which future voice answers next.",
  },
  {
    icon: "people-outline" as const,
    title: "A constellation of voices",
    body: "Future Mentor, Future Partner, The Shadow, Alternate Self — each voice unlocks as your streak deepens.",
  },
  {
    icon: "sparkles-outline" as const,
    title: "Weekly synthesis",
    body: "Every week, AI distills your reflections into a resonant summary and 2-3 concrete action items for the week ahead.",
  },
  {
    icon: "call-outline" as const,
    title: "The Last Voicemail",
    body: "At milestones, your future self leaves a raw, emotionally precise voicemail — synthesized from everything you've shared.",
  },
];

const TESTIMONIALS = [
  {
    quote: "The first time I heard my future self say my name, I cried.",
    author: "Early tester, Day 3",
  },
  {
    quote: "It's the only app I open before coffee.",
    author: "Early tester, Day 14",
  },
  {
    quote: "I didn't expect a phone app to make me braver, but here we are.",
    author: "Early tester, Day 21",
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
    <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={s.bg}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <Animated.View
            entering={isWeb ? undefined : FadeIn.duration(500)}
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
              A daily narrative ritual where AI-generated voices from your future
              speak to the person you are today. One word. One transmission. One
              choice — every day.
            </Text>

            <Animated.View
              entering={isWeb ? undefined : FadeInUp.delay(1200).duration(500)}
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
                entering={isWeb ? undefined : FadeInUp.delay(200 + i * 150).duration(400)}
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
                entering={isWeb ? undefined : FadeInUp.delay(100 + i * 100).duration(400)}
                style={s.featureCard}
              >
                <View style={s.featureIconWrap}>
                  <Ionicons name={feature.icon} size={20} color="#F7D38B" />
                </View>
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
                entering={isWeb ? undefined : FadeInUp.delay(100 + i * 120).duration(400)}
                style={s.testimonialCard}
              >
                <Text style={s.testimonialQuote}>&ldquo;{t.quote}&rdquo;</Text>
                <Text style={s.testimonialAuthor}>{t.author}</Text>
              </Animated.View>
            ))}
          </View>

          {/* ── Architecture: Cloud vs On-Device ── */}
          <Animated.View
            entering={isWeb ? undefined : FadeInUp.delay(50).duration(500)}
            style={s.archSection}
          >
            <Text style={s.archLabel}>Cloud vs on-device</Text>
            <ArchitectureDiagram />
          </Animated.View>

          {/* ── Final CTA ── */}
          <Animated.View
            entering={isWeb ? undefined : FadeInUp.delay(300).duration(500)}
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
              <View style={s.networkIndicator}>
                <View style={[s.networkDot, { backgroundColor: "#4ADE80" }]} />
                <Text style={s.networkLabel}>Network: live</Text>
              </View>
              <Text style={s.footerPrivacyText}>
                This is a demo with sample data. The installed app runs entirely
                on your device.{" "}
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
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
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
  archSection: {
    width: "100%",
    maxWidth: 720,
    alignItems: "center",
    gap: 16,
    paddingVertical: 32,
  },
  archLabel: {
    color: "#8B8FA3",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    opacity: 0.6,
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
  networkIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(74,222,128,0.08)",
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  networkLabel: {
    color: "#4ADE80",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
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
