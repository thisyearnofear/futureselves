import React, { useState, useEffect } from "react";
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
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { styles } from "./voicemail-experience.styles";

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
            { width: `${((currentStep + 1) / steps.length) * 100}%` }
          ]} 
        />
      </View>
    </View>
  );
}

export function VoicemailExperience() {
  const [situation, setSituation] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  // @ts-expect-error - voicemail property is generated dynamically by Convex
  const generateVoicemail = useAction(api.voicemail.generateVoicemail);

  const steps = [
    "Intaking emotion...",
    "Mel Agent: Extracting core...",
    "Scripting the unspoken...",
    "Refining for authenticity...",
    "Generating voice (ElevenLabs)...",
    "Atmospheric rendering...",
    "Finalizing assembly...",
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && step < steps.length - 1) {
      interval = setInterval(() => {
        setStep((s) => Math.min(s + 1, steps.length - 1));
      }, 3500); 
    }
    return () => clearInterval(interval);
  }, [isGenerating, step]);

  const handleGenerate = async () => {
    if (!situation.trim()) return;
    setIsGenerating(true);
    setStep(0);
    setError(null);
    try {
      const data = await generateVoicemail({ situation });
      setResult(data);
      setStep(steps.length - 1);
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((e as any).message || "Something went wrong in the timeline.");
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setResult(null);
    setSituation("");
    setIsGenerating(false);
    setStep(0);
  };

  if (result) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <VoicemailResult result={result as any} onReset={reset} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>The Last Voicemail</Text>
      <Text style={styles.subtitle}>
        Hear the words people never said at emotionally charged moments.
      </Text>

      {!isGenerating ? (
        <Animated.View entering={SlideInDown} style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Describe the situation in one sentence..."
            placeholderTextColor="#666"
            value={situation}
            onChangeText={setSituation}
            multiline
          />
          <TouchableOpacity 
            style={[styles.button, !situation.trim() && styles.buttonDisabled]} 
            onPress={handleGenerate}
            disabled={!situation.trim()}
          >
            <LinearGradient
              colors={["#F7D38B", "#D4A017"]}
              style={styles.gradient}
            >
              <Text style={styles.buttonText}>Generate Voicemail</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <StepProgress currentStep={step} steps={steps} />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VoicemailResult({ result, onReset }: { result: any; onReset: () => void }) {
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
    const message = `I built an AI system that lets you hear the words people never said.\n\n"${result.transcript}"\n\nExperience "The Last Voicemail" at futureself.app`;
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

        <Text style={styles.transcript}>"{result.transcript}"</Text>

        {result.critique && (
          <View style={styles.critiqueBox}>
            <Text style={styles.critiqueTitle}>Agent Critique</Text>
            <Text style={styles.critiqueText}>{result.critique}</Text>
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
