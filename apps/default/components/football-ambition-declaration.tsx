/**
 * football-ambition-declaration.tsx
 *
 * The entry point for the Football Path. The user speaks their football dream
 * into the phone via on-device STT (QVAC Parakeet), the on-device LLM (QVAC
 * Llama 3.2) extracts structured ambition data, and the result is saved to
 * Convex. After declaration, the user can receive their first football-path
 * transmission.
 *
 * All AI runs on-device through QVAC. No cloud. See `docs/edge-ai-qvac.md`.
 */

import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { extractAmbition, type FootballPosition } from "@/lib/football-llm";
import { isLocalMode } from "@/lib/ai";

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Goalkeeper",
  center_back: "Center Back",
  full_back: "Full Back",
  defensive_mid: "Defensive Midfielder",
  central_mid: "Central Midfielder",
  attacking_mid: "Attacking Midfielder",
  winger: "Winger",
  striker: "Striker",
  unknown: "Footballer",
};

interface FootballAmbitionDeclarationProps {
  /** LLM model ID from QVAC loadModel. Required for ambition extraction. */
  llmModelId: string | null;
  /** STT model ID from QVAC loadModel. Required for speech recognition. */
  sttModelId: string | null;
  /** Called after the ambition is successfully saved. */
  onDeclared: () => void;
}

export function FootballAmbitionDeclaration({
  llmModelId,
  sttModelId,
  onDeclared,
}: FootballAmbitionDeclarationProps) {
  const [transcribedText, setTranscribedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState<{
    position: FootballPosition;
    description: string;
    level: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveAmbition = useMutation(api.football.saveAmbition);

  const speech = useSpeechRecognition({
    sttModelId,
    onResult: (text) => {
      setTranscribedText(text);
      setExtractedPreview(null);
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleExtract = useCallback(async () => {
    if (!transcribedText.trim()) {
      setError("Speak your ambition first.");
      return;
    }
    if (!llmModelId) {
      setError("AI model is still loading. Try again in a moment.");
      return;
    }
    setError(null);
    setIsExtracting(true);
    try {
      const extracted = await extractAmbition(llmModelId, transcribedText);
      setExtractedPreview({
        position: extracted.targetPosition,
        description: extracted.description,
        level: extracted.currentLevel,
      });
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not understand. Try again.");
    } finally {
      setIsExtracting(false);
    }
  }, [transcribedText, llmModelId]);

  const handleConfirm = useCallback(async () => {
    if (!extractedPreview || isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      await saveAmbition({
        spokenText: transcribedText,
        targetPosition: extractedPreview.position,
        description: extractedPreview.description,
        currentLevel: extractedPreview.level,
      });
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onDeclared();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your ambition.");
    } finally {
      setIsSaving(false);
    }
  }, [extractedPreview, transcribedText, saveAmbition, onDeclared, isSaving]);

  const isNative = Platform.OS !== "web";
  const canUseSTT = isNative && isLocalMode() && sttModelId !== null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <Text style={styles.eyebrow}>FOOTBALL PATH</Text>
        <Text style={styles.title}>What do you want to become?</Text>
        <Text style={styles.subtitle}>
          Speak it out loud. Your future self — the one who lived it — is listening.
        </Text>
      </Animated.View>

      {/* Speak button */}
      <Animated.View entering={FadeInUp.delay(100)} style={styles.micSection}>
        <Pressable
          style={({ pressed }) => [
            styles.micButton,
            speech.isRecording && styles.micButtonRecording,
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
          onPress={speech.isRecording ? speech.stopRecording : speech.startRecording}
          disabled={!canUseSTT && !speech.isRecording}
        >
          {speech.isRecording ? (
            <>
              <ActivityIndicator color="#080A17" size="small" />
              <Text style={styles.micButtonTextRecording}>Tap to stop</Text>
            </>
          ) : speech.isTranscribing ? (
            <>
              <ActivityIndicator color="#F7D38B" size="small" />
              <Text style={styles.micButtonText}>Listening...</Text>
            </>
          ) : (
            <>
              <Ionicons name="mic-outline" size={28} color="#F7D38B" />
              <Text style={styles.micButtonText}>Hold to speak</Text>
            </>
          )}
        </Pressable>
        {!canUseSTT && (
          <Text style={styles.hint}>
            {isNative ? "Loading AI models..." : "Speech recognition requires the native app."}
          </Text>
        )}
      </Animated.View>

      {/* Transcribed text */}
      {transcribedText ? (
        <Animated.View entering={FadeInUp} style={styles.transcriptSection}>
          <Text style={styles.transcriptLabel}>You said:</Text>
          <Text style={styles.transcriptText}>"{transcribedText}"</Text>
          <Pressable
            style={styles.editButton}
            onPress={() => {
              setTranscribedText("");
              setExtractedPreview(null);
            }}
          >
            <Text style={styles.editButtonText}>Clear & re-record</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Extract button */}
      {transcribedText && !extractedPreview ? (
        <Animated.View entering={FadeInUp}>
          <Pressable
            style={({ pressed }) => [
              styles.extractButton,
              isExtracting && styles.extractButtonDisabled,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleExtract}
            disabled={isExtracting}
          >
            {isExtracting ? (
              <ActivityIndicator color="#080A17" size="small" />
            ) : (
              <Text style={styles.extractButtonText}>Understand my dream</Text>
            )}
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Extracted preview */}
      {extractedPreview ? (
        <Animated.View entering={FadeInUp} style={styles.previewSection}>
          <Text style={styles.previewLabel}>Your future self heard:</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewKey}>Position</Text>
              <Text style={styles.previewValue}>
                {POSITION_LABELS[extractedPreview.position] ?? extractedPreview.position}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewKey}>Level</Text>
              <Text style={styles.previewValue}>{extractedPreview.level}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewKey}>Dream</Text>
              <Text style={styles.previewValueFlex}>{extractedPreview.description}</Text>
            </View>
          </View>
          <Text style={styles.previewHint}>
            Your first transmission will tell you what this path actually demands.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.confirmButton,
              isSaving && styles.confirmButtonDisabled,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleConfirm}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#080A17" size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>Begin the path</Text>
            )}
          </Pressable>
        </Animated.View>
      ) : null}

      {error ? (
        <Animated.View entering={FadeIn} style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      ) : null}

      {speech.error ? (
        <Text style={styles.errorText}>{speech.error}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    gap: 20,
  },
  header: {
    alignItems: "center",
    gap: 10,
    marginTop: 20,
  },
  eyebrow: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: "#F8F0DE",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: "#BFC6DE",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 280,
  },
  micSection: {
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  micButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: "rgba(247,211,139,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(247,211,139,0.3)",
  },
  micButtonRecording: {
    backgroundColor: "#F7D38B",
    borderColor: "#F7D38B",
  },
  micButtonText: {
    color: "#F7D38B",
    fontSize: 15,
    fontWeight: "700",
  },
  micButtonTextRecording: {
    color: "#080A17",
    fontSize: 15,
    fontWeight: "700",
  },
  hint: {
    color: "#6B7290",
    fontSize: 13,
  },
  transcriptSection: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  transcriptLabel: {
    color: "#6B7290",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  transcriptText: {
    color: "#BFC6DE",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
  },
  editButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  editButtonText: {
    color: "#6B7290",
    fontSize: 13,
  },
  extractButton: {
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: "#F7D38B",
  },
  extractButtonDisabled: {
    opacity: 0.6,
  },
  extractButtonText: {
    color: "#080A17",
    fontSize: 16,
    fontWeight: "800",
  },
  previewSection: {
    gap: 14,
  },
  previewLabel: {
    color: "#F7D38B",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  previewCard: {
    gap: 14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.15)",
  },
  previewRow: {
    flexDirection: "row",
    gap: 12,
  },
  previewKey: {
    color: "#6B7290",
    fontSize: 14,
    fontWeight: "700",
    minWidth: 80,
  },
  previewValue: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "600",
  },
  previewValueFlex: {
    color: "#F8F0DE",
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  previewHint: {
    color: "#BFC6DE",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  confirmButton: {
    alignItems: "center",
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: "#F7D38B",
    marginTop: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: "#080A17",
    fontSize: 17,
    fontWeight: "800",
  },
  errorBox: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,154,154,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,154,154,0.2)",
  },
  errorText: {
    color: "#FF9A9A",
    fontSize: 14,
    lineHeight: 20,
  },
});
