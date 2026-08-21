import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import Animated, { FadeIn, SlideInDown, ZoomIn, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useLocalVoicemail } from "@/hooks/use-local-voicemail";
import { AvatarReveal } from "@/components/avatar-reveal";
import { BottomNav } from "@/components/bottom-nav";
import { presentAwakenedPaywall } from "@/lib/revenuecat";
import { buildSignalLink } from "@/lib/futureself";
import { styles } from "./voicemail-experience.styles";

export function VoicemailExperience() {
  const status = useQuery(api.voicemail.getVoicemailStatus);

  if (!status) {
    return (
      <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.gradientBg}>
        <ActivityIndicator size="large" color="#F7D38B" />
      </LinearGradient>
    );
  }

  if (!status.unlocked) {
    return <LockedState streak={status.streak} nextMilestone={status.nextMilestone} />;
  }

  return (
    <UnlockedExperience
      credits={status.credits}
      tier={status.tier}
      streak={status.streak}
    />
  );
}

function LockedState({
  streak,
  nextMilestone,
}: {
  streak: number;
  nextMilestone: number | null;
}) {
  const progress = nextMilestone ? (streak / nextMilestone) * 100 : 0;
  const [isPresentingPaywall, setIsPresentingPaywall] = useState(false);
  const syncEntitlement = useMutation(api.revenuecat.syncEntitlementFromClient);

  const handleUnlockNow = async () => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPresentingPaywall(true);
    try {
      const result = await presentAwakenedPaywall();
      if (result === "purchased" || result === "restored") {
        // Fast-path confirmation — see docs/shipaton-2026.md "Sync architecture".
        // The webhook will also arrive and apply the same state.
        await syncEntitlement({ hasAwakenedEntitlement: true });
      }
    } finally {
      setIsPresentingPaywall(false);
    }
  };

  return (
    <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.gradientBg}>
      <ScrollView contentContainerStyle={styles.lockedScroll}>
        <Animated.View entering={FadeIn.duration(800)}>
          <View style={styles.lockedIconWrap}>
            <Ionicons name="lock-closed" size={48} color="rgba(247,211,139,0.3)" />
          </View>
          <Text style={styles.lockedTitle}>The Last Voicemail</Text>
          <Text style={styles.lockedSubtitle}>
            A cinematic voicemail from your future self, built from your emotional journey.
          </Text>

          <View style={styles.milestoneCard}>
            <View style={styles.milestoneHeader}>
              <Ionicons name="time-outline" size={16} color="#F7D38B" />
              <Text style={styles.milestoneLabel}>
                {nextMilestone
                  ? `${nextMilestone - streak} days to unlock`
                  : "Keep going"}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]}
              />
            </View>
            <Text style={styles.milestoneHint}>
              {nextMilestone === 7
                ? "Your first voicemail unlocks at Day 7"
                : nextMilestone === 30
                  ? "Premium cinematic voicemails unlock at Day 30"
                  : "Voicemail archive unlocks at Day 90"}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.unlockNowButton,
              pressed && styles.pressed,
              isPresentingPaywall && styles.buttonDisabled,
            ]}
            onPress={handleUnlockNow}
            disabled={isPresentingPaywall}
          >
            <LinearGradient colors={["#B388FF", "#7C4DFF"]} style={styles.gradient}>
              {isPresentingPaywall ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sparkles" size={16} color="#fff" />
              )}
              <Text style={[styles.buttonText, { color: "#fff" }]}>
                Or wake this voice now
              </Text>
            </LinearGradient>
          </Pressable>

          <Text style={styles.awakenedSubtext}>
            Awakened voices don't wait for a milestone — they're always on the line.
          </Text>

          <View style={styles.previewList}>
            <Text style={styles.previewTitle}>What you'll experience</Text>
            <View style={styles.previewItem}>
              <View style={styles.previewIconWrap}>
                <Ionicons name="mic-outline" size={18} color="#F7D38B" />
              </View>
              <Text style={styles.previewText}>
                A voicemail from your future self, voiced on-device
              </Text>
            </View>
            <View style={styles.previewItem}>
              <View style={styles.previewIconWrap}>
                <Ionicons name="heart-outline" size={18} color="#F7D38B" />
              </View>
              <Text style={styles.previewText}>
                Built from your check-ins, choices, and emotional arc
              </Text>
            </View>
            <View style={styles.previewItem}>
              <View style={styles.previewIconWrap}>
                <Ionicons name="sparkles" size={18} color="#F7D38B" />
              </View>
              <Text style={styles.previewText}>
                Multi-agent critique loop for emotional authenticity
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      <BottomNav />
    </LinearGradient>
  );
}

function UnlockedExperience({
  credits,
  tier,
  streak,
}: {
  credits: number;
  tier: string;
  streak: number;
}) {
  const [mode, setMode] = useState<"context" | "manual">("context");
  const [situation, setSituation] = useState("");
  const { generate, isGenerating, result, error, step, reset } = useLocalVoicemail();

  const isPremium = tier === "premium";

  const steps = [
    { icon: "reader-outline", label: "Reading your journey..." },
    { icon: "search-outline", label: "Finding the core feeling..." },
    { icon: "create-outline", label: "Writing the unspoken words..." },
    { icon: "cut-outline", label: "Critique agent refining..." },
    { icon: "mic-outline", label: "Synthesizing voice on-device..." },
    { icon: "film-outline", label: "Assembling the voicemail..." },
  ];

  const handleGenerate = async () => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await generate();
  };

  if (result) {
    return <VoicemailResult result={result} onReset={reset} isPremium={isPremium} />;
  }

  return (
    <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.gradientBg}>
      <ScrollView contentContainerStyle={styles.unlockedScroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(400)}>
          <View style={styles.unlockedHeader}>
            <View style={styles.unlockedIconWrap}>
              <Ionicons name="mail-open-outline" size={24} color="#F7D38B" />
            </View>
            <Text style={styles.unlockedTitle}>The Last Voicemail</Text>
            <Text style={styles.unlockedSubtitle}>
              {isPremium
                ? "Full cinematic experience. Audio, visuals, and multi-agent refinement."
                : "Your future self has a message, built from your emotional journey."}
            </Text>
          </View>

          <View style={styles.creditsRow}>
            <Ionicons name="mail-outline" size={16} color="#F7D38B" />
            <Text style={styles.creditsText}>
              {isPremium
                ? "Fully awakened — voicemails whenever you need one"
                : `${credits} voicemail${credits !== 1 ? "s" : ""} available`}
            </Text>
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>AWAKENED</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {!isGenerating ? (
          <Animated.View entering={SlideInDown.duration(400)} style={styles.inputContainer}>
            {isPremium && (
              <View style={styles.modeToggle}>
                <Pressable
                  style={[
                    styles.modeButton,
                    mode === "context" && styles.modeButtonActive,
                  ]}
                  onPress={() => setMode("context")}
                >
                  <Ionicons
                    name="book-outline"
                    size={14}
                    color={mode === "context" ? "#F7D38B" : "#8F96B4"}
                  />
                  <Text style={[styles.modeButtonText, mode === "context" && styles.modeButtonTextActive]}>
                    From My Journey
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modeButton,
                    mode === "manual" && styles.modeButtonActive,
                  ]}
                  onPress={() => setMode("manual")}
                >
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color={mode === "manual" ? "#F7D38B" : "#8F96B4"}
                  />
                  <Text style={[styles.modeButtonText, mode === "manual" && styles.modeButtonTextActive]}>
                    Custom Situation
                  </Text>
                </Pressable>
              </View>
            )}

            {isPremium && mode === "manual" && (
              <TextInput
                style={styles.input}
                placeholder="Describe the situation in one sentence..."
                placeholderTextColor="#6F7591"
                value={situation}
                onChangeText={setSituation}
                multiline
              />
            )}

            {mode === "context" && (
              <View style={styles.contextSummary}>
                <View style={styles.contextHeader}>
                  <Ionicons name="information-circle-outline" size={16} color="#F7D38B" />
                  <Text style={styles.contextTitle}>Your voicemail will be built from:</Text>
                </View>
                <View style={styles.contextItem}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#F7D38B" />
                  <Text style={styles.contextItemText}>
                    Your last {Math.min(streak, 14)} days of check-ins
                  </Text>
                </View>
                <View style={styles.contextItem}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#F7D38B" />
                  <Text style={styles.contextItemText}>Your recent choices and emotional arc</Text>
                </View>
                <View style={styles.contextItem}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#F7D38B" />
                  <Text style={styles.contextItemText}>Delivered by your Future Self, on-device</Text>
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.generateButton,
                isPremium && mode === "manual" && !situation.trim() && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleGenerate}
              disabled={isPremium && mode === "manual" && !situation.trim()}
            >
              <LinearGradient
                colors={isPremium ? ["#B388FF", "#7C4DFF"] : ["#F7D38B", "#D4A017"]}
                style={styles.gradient}
              >
                <Ionicons name="mic" size={18} color={isPremium ? "#fff" : "#101320"} />
                <Text style={[styles.buttonText, isPremium && { color: "#fff" }]}>
                  {isPremium ? "Generate Cinematic Voicemail" : "Generate Voicemail"}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : (
          <AgentPipeline currentStep={step} steps={steps} />
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
      <BottomNav />
    </LinearGradient>
  );
}

// ─── Multi-Agent Pipeline Visualization ──────────────────────────────────────

interface AgentPipelineProps {
  currentStep: number;
  steps: Array<{ icon: string; label: string }>;
}

function AgentPipeline({ currentStep, steps }: AgentPipelineProps) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.pipelineContainer}>
      <View style={styles.pipelineHeader}>
        <ActivityIndicator size="small" color="#F7D38B" />
        <Text style={styles.pipelineTitle}>Agents at work</Text>
      </View>
      <View style={styles.pipelineSteps}>
        {steps.map((step, i) => {
          const isComplete = i < currentStep;
          const isActive = i === currentStep;
          const isPending = i > currentStep;
          return (
            <Animated.View
              key={i}
              entering={FadeIn.delay(i * 100).duration(300)}
              style={[
                styles.pipelineStep,
                isActive && styles.pipelineStepActive,
                isComplete && styles.pipelineStepComplete,
              ]}
            >
              <View style={[
                styles.pipelineIconWrap,
                isActive && styles.pipelineIconWrapActive,
                isComplete && styles.pipelineIconWrapComplete,
              ]}>
                <Ionicons
                  name={isComplete ? "checkmark" : step.icon as any}
                  size={14}
                  color={isActive ? "#F7D38B" : isComplete ? "#A9F7B5" : "#6F7591"}
                />
              </View>
              <Text style={[
                styles.pipelineLabel,
                isActive && styles.pipelineLabelActive,
                isComplete && styles.pipelineLabelComplete,
              ]}>
                {step.label}
              </Text>
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.pipelineProgressTrack}>
        <Animated.View
          style={[
            styles.pipelineProgressFill,
            { width: `${((currentStep + 1) / steps.length) * 100}%` },
          ]}
        />
      </View>
    </Animated.View>
  );
}

// ─── Voicemail Result ────────────────────────────────────────────────────────

interface LocalVoicemailResult {
  transcript: string;
  emotionalCore: string;
  audioUrl: string | null;
  generationTier?: string;
  critique?: string;
  imageUrl?: string;
  videoUrl?: string;
}

function VoicemailResult({ result, onReset, isPremium }: { result: LocalVoicemailResult; onReset: () => void; isPremium: boolean }) {
  const player = useAudioPlayer(result.audioUrl);
  const status = useAudioPlayerStatus(player);

  const togglePlayback = () => {
    if (status.playbackState === "playing") {
      player.pause();
    } else {
      if (Platform.OS !== "web") void Haptics.selectionAsync();
      player.play();
    }
  };

  const handleShare = async () => {
    const signalLink = buildSignalLink({
      type: "transmission",
      cast: "future_self",
      quote: result.transcript,
    });
    const message = `"${result.transcript}"\n\n— A voicemail from my future self\n${signalLink}`;
    try {
      await Share.share({ message });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.gradientBg}>
      <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={ZoomIn.duration(600).springify().damping(14)} style={styles.resultCard}>
          {/* Avatar */}
          <AvatarReveal castMember="future_self" size={80} />

          <Text style={styles.emotionalCore}>{result.emotionalCore}</Text>
          <View style={styles.divider} />

          {isPremium && result.imageUrl ? (
            <View style={styles.mediaPlaceholder}>
              <Image
                source={{ uri: result.imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={1000}
              />
              <Pressable onPress={togglePlayback} style={styles.playButtonOverlay}>
                <Ionicons
                  name={status.playbackState === "playing" ? "pause-circle" : "play-circle"}
                  size={80}
                  color="#F7D38B"
                />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={togglePlayback}
              style={({ pressed }) => [styles.audioPlayer, pressed && styles.pressed]}
            >
              <View style={styles.audioPlayButton}>
                <Ionicons
                  name={status.playbackState === "playing" ? "pause" : "play"}
                  size={28}
                  color="#101320"
                />
              </View>
              <View style={styles.audioPlayerInfo}>
                <Text style={styles.audioLabel}>
                  {status.playbackState === "playing" ? "Playing..." : "Tap to listen"}
                </Text>
                <Text style={styles.audioSubtext}>
                  {result.audioUrl ? "On-device voice synthesis" : "Voice unavailable"}
                </Text>
              </View>
            </Pressable>
          )}

          <Text style={styles.transcript}>"{result.transcript}"</Text>

          {/* Behind the scenes: multi-agent critique */}
          {result.critique ? (
            <View style={styles.critiqueBox}>
              <View style={styles.critiqueHeader}>
                <Ionicons name="film-outline" size={14} color="#F7D38B" />
                <Text style={styles.critiqueTitle}>Director's notes</Text>
              </View>
              <Text style={styles.critiqueText}>{result.critique}</Text>
            </View>
          ) : null}

          {/* Tier badge */}
          {result.generationTier ? (
            <View style={styles.tierBadgeWrap}>
              <View style={[styles.tierBadge, result.generationTier === "premium" && styles.tierBadgePremium]}>
                <Ionicons
                  name={result.generationTier === "premium" ? "star" : "star-outline"}
                  size={10}
                  color={result.generationTier === "premium" ? "#B388FF" : "#8F96B4"}
                />
                <Text style={[
                  styles.tierBadgeText,
                  result.generationTier === "premium" && styles.tierBadgeTextPremium,
                ]}>
                  {result.generationTier === "premium" ? "Awakened" : "Free line"}
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={16} color="#101320" />
            <Text style={styles.shareButtonText}>Share the unspoken</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
            onPress={onReset}
          >
            <Ionicons name="refresh-outline" size={14} color="#8F96B4" />
            <Text style={styles.resetButtonText}>Generate another</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
      <BottomNav />
    </LinearGradient>
  );
}
