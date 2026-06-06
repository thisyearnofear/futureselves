import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useLocalVoicemail } from "@/hooks/use-local-voicemail";
import { styles } from "./voicemail-experience.styles";

export function VoicemailExperience() {
  // @ts-expect-error - voicemail property is generated dynamically by Convex
  const status = useQuery(api.voicemail.getVoicemailStatus);

  if (!status) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#F7D38B" />
      </View>
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

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(800)}>
        <View style={lockedStyles.iconContainer}>
          <Ionicons name="lock-closed" size={64} color="#555" />
        </View>
        <Text style={styles.title}>The Last Voicemail</Text>
        <Text style={styles.subtitle}>
          Hear the words your future self never said — synthesized from your
          emotional journey.
        </Text>

        <View style={lockedStyles.milestoneCard}>
          <Text style={lockedStyles.milestoneLabel}>
            {nextMilestone
              ? `${nextMilestone - streak} days to unlock`
              : "Keep going"}
          </Text>
          <View style={styles.progressBar}>
            <Animated.View
              style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]}
            />
          </View>
          <Text style={lockedStyles.milestoneHint}>
            {nextMilestone === 7
              ? "Your first voicemail unlocks at Day 7"
              : nextMilestone === 30
                ? "Cinematic voicemail unlocks at Day 30"
                : "Voicemail archive unlocks at Day 90"}
          </Text>
        </View>

        <View style={lockedStyles.previewContainer}>
          <Text style={lockedStyles.previewTitle}>What you'll experience</Text>
          <View style={lockedStyles.previewItem}>
            <Ionicons name="mic-outline" size={20} color="#F7D38B" />
            <Text style={lockedStyles.previewText}>
              A voicemail from your future self, voiced by AI
            </Text>
          </View>
          <View style={lockedStyles.previewItem}>
            <Ionicons name="heart-outline" size={20} color="#F7D38B" />
            <Text style={lockedStyles.previewText}>
              Built from your daily check-ins, choices, and emotional arc
            </Text>
          </View>
          <View style={lockedStyles.previewItem}>
            <Ionicons name="sparkles-outline" size={20} color="#F7D38B" />
            <Text style={lockedStyles.previewText}>
              Critique-refined for emotional authenticity
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
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
    "Reading your emotional journey...",
    "Extracting the core feeling...",
    "Writing the unspoken words...",
    "Refining for authenticity...",
    "Generating voice...",
    "Assembling the voicemail...",
  ];

  const handleGenerate = async () => {
    await generate();
  };

  if (result) {
    return <VoicemailResult result={result} onReset={reset} isPremium={isPremium} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>The Last Voicemail</Text>
      <Text style={styles.subtitle}>
        {isPremium
          ? "Full cinematic experience — audio, visuals, and multi-agent refinement."
          : "Your future self has a message, built from your emotional journey."}
      </Text>

      <View style={unlockedStyles.creditsRow}>
        <Ionicons name="mail-outline" size={18} color="#F7D38B" />
        <Text style={unlockedStyles.creditsText}>
          {tier === "premium"
            ? "Unlimited voicemails"
            : `${credits} voicemail${credits !== 1 ? "s" : ""} available`}
        </Text>
        {isPremium && (
          <View style={unlockedStyles.premiumBadge}>
            <Text style={unlockedStyles.premiumBadgeText}>PREMIUM</Text>
          </View>
        )}
      </View>

      {!isGenerating ? (
        <Animated.View entering={SlideInDown} style={styles.inputContainer}>
          {isPremium && (
            <View style={unlockedStyles.modeToggle}>
              <TouchableOpacity
                style={[
                  unlockedStyles.modeButton,
                  mode === "context" && unlockedStyles.modeButtonActive,
                ]}
                onPress={() => setMode("context")}
              >
                <Text
                  style={[
                    unlockedStyles.modeButtonText,
                    mode === "context" && unlockedStyles.modeButtonTextActive,
                  ]}
                >
                  From My Journey
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  unlockedStyles.modeButton,
                  mode === "manual" && unlockedStyles.modeButtonActive,
                ]}
                onPress={() => setMode("manual")}
              >
                <Text
                  style={[
                    unlockedStyles.modeButtonText,
                    mode === "manual" && unlockedStyles.modeButtonTextActive,
                  ]}
                >
                  Custom Situation
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isPremium && mode === "manual" && (
            <TextInput
              style={styles.input}
              placeholder="Describe the situation in one sentence..."
              placeholderTextColor="#666"
              value={situation}
              onChangeText={setSituation}
              multiline
            />
          )}

          {mode === "context" && (
            <View style={unlockedStyles.contextSummary}>
              <Text style={unlockedStyles.contextTitle}>
                Your voicemail will be built from:
              </Text>
              <Text style={unlockedStyles.contextItem}>
                Your last {Math.min(streak, 14)} days of check-ins
              </Text>
              <Text style={unlockedStyles.contextItem}>
                Your recent choices and emotional arc
              </Text>
              <Text style={unlockedStyles.contextItem}>
                Delivered by your Future Self
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              isPremium && mode === "manual" && !situation.trim() && styles.buttonDisabled,
            ]}
            onPress={handleGenerate}
            disabled={isPremium && mode === "manual" && !situation.trim()}
          >
            <LinearGradient
              colors={isPremium ? ["#B388FF", "#7C4DFF"] : ["#F7D38B", "#D4A017"]}
              style={styles.gradient}
            >
              <Text style={styles.buttonText}>
                {isPremium ? "Generate Cinematic Voicemail" : "Generate Voicemail"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <StepProgress currentStep={step} steps={steps} />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </ScrollView>
  );
}

interface StepProgressProps {
  currentStep: number;
  steps: string[];
}

function StepProgress({ currentStep, steps }: StepProgressProps) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#F7D38B" />
      <Text style={styles.stepText}>{steps[currentStep]}</Text>
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: `${((currentStep + 1) / steps.length) * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

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
      player.play();
    }
  };

  const handleShare = async () => {
    const message = `"${result.transcript}"\n\n— A voicemail from my future self\nExperience it at futureself.app`;
    try {
      await Share.share({ message });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Animated.View entering={FadeIn.duration(1000)} style={styles.resultCard}>
        <Text style={styles.emotionalCore}>Feeling: {result.emotionalCore}</Text>
        <View style={styles.divider} />

        {isPremium && result.imageUrl ? (
          <View style={styles.mediaPlaceholder}>
            <Image
              source={{ uri: result.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={1000}
            />
            <TouchableOpacity onPress={togglePlayback} style={styles.playButtonOverlay}>
              <Ionicons
                name={status.playbackState === "playing" ? "pause-circle" : "play-circle"}
                size={100}
                color="#F7D38B"
              />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={togglePlayback} style={freePlayerStyles.audioPlayer}>
            <Ionicons
              name={status.playbackState === "playing" ? "pause-circle" : "play-circle"}
              size={64}
              color="#F7D38B"
            />
            <Text style={freePlayerStyles.audioLabel}>
              {status.playbackState === "playing" ? "Playing..." : "Tap to listen"}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.transcript}>"{result.transcript}"</Text>

        {result.critique && (
          <View style={styles.critiqueBox}>
            <Text style={styles.critiqueTitle}>Agent Critique</Text>
            <Text style={styles.critiqueText}>{result.critique}</Text>
          </View>
        )}

        {result.generationTier && (
          <View style={tierBadgeStyles.container}>
            <Text style={tierBadgeStyles.text}>
              {result.generationTier === "premium" ? "Premium" : "Free Tier"}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share the Unspoken</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetButton} onPress={onReset}>
          <Text style={styles.resetButtonText}>Generate Another</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const lockedStyles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
    opacity: 0.6,
  },
  milestoneCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "rgba(247, 211, 139, 0.15)",
  },
  milestoneLabel: {
    color: "#F7D38B",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  milestoneHint: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  previewContainer: {
    marginTop: 32,
    gap: 14,
  },
  previewTitle: {
    color: "#ccc",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewText: {
    color: "#999",
    fontSize: 14,
    flex: 1,
  },
});

const unlockedStyles = StyleSheet.create({
  creditsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  creditsText: {
    color: "#ccc",
    fontSize: 14,
  },
  premiumBadge: {
    backgroundColor: "rgba(179, 136, 255, 0.2)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  premiumBadgeText: {
    color: "#B388FF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  modeToggle: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  modeButtonActive: {
    borderColor: "#F7D38B",
    backgroundColor: "rgba(247, 211, 139, 0.08)",
  },
  modeButtonText: {
    color: "#888",
    fontSize: 13,
    fontWeight: "500",
  },
  modeButtonTextActive: {
    color: "#F7D38B",
  },
  contextSummary: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  contextTitle: {
    color: "#ccc",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  contextItem: {
    color: "#999",
    fontSize: 13,
  },
});

const freePlayerStyles = StyleSheet.create({
  audioPlayer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  audioLabel: {
    color: "#999",
    fontSize: 13,
  },
});

const tierBadgeStyles = StyleSheet.create({
  container: {
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  text: {
    color: "#888",
    fontSize: 12,
  },
});
