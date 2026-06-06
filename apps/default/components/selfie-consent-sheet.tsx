import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CastMember } from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";

interface SelfieConsentSheetProps {
  visible: boolean;
  castMember: CastMember;
  onClose: () => void;
  onComplete: (storageId: string) => void;
}

export function SelfieConsentSheet({
  visible,
  castMember,
  onClose,
  onComplete,
}: SelfieConsentSheetProps) {
  const [step, setStep] = useState<"consent" | "picking" | "uploading" | "generating" | "done">("consent");
  const [error, setError] = useState<string | null>(null);
  const generatePersonalized = useAction(api.face.generatePersonalizedAvatar);

  const memberLabel = formatCastMember(castMember);

  async function handlePickPhoto() {
    setStep("picking");
    setError(null);

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setError("Photo library access is needed to choose a photo.");
        setStep("consent");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        setStep("consent");
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        setError("Could not read the selected photo.");
        setStep("consent");
        return;
      }

      setStep("uploading");

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        type: "image/jpeg",
        name: "selfie.jpg",
      } as any);

      const uploadUrl = process.env.EXPO_PUBLIC_CONVEX_URL!.replace(
        "/api",
        "/api/storage",
      );
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await uploadResponse.json() as { storageId: string };

      setStep("generating");
      const result_new = await generatePersonalized({
        castMember,
        selfieStorageId: storageId as any,
      });

      if (result_new.status === "generated" && result_new.storageId) {
        setStep("done");
        onComplete(result_new.storageId);
      } else if (result_new.status === "no_api_key") {
        setError("Avatar generation is not configured yet.");
        setStep("consent");
      } else {
        setError("Could not generate the personalized avatar. Try again.");
        setStep("consent");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStep("consent");
    }
  }

  function handleReset() {
    setStep("consent");
    setError(null);
    onClose();
  }

  return (
    <Modal animationType="fade" onRequestClose={handleReset} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable onPress={handleReset} style={styles.backdrop} />
        <View style={styles.sheet}>
          {step === "consent" && (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="camera-outline" size={32} color="#F7D38B" />
              </View>
              <Text style={styles.title}>See yourself as {memberLabel}</Text>
              <Text style={styles.body}>
                Upload a photo and we'll show you what {memberLabel.toLowerCase()} might look
                like — with your face.
              </Text>
              <View style={styles.consentList}>
                <View style={styles.consentRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                  <Text style={styles.consentText}>Your photo is uploaded temporarily, then deleted</Text>
                </View>
                <View style={styles.consentRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                  <Text style={styles.consentText}>No biometric data is stored</Text>
                </View>
                <View style={styles.consentRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                  <Text style={styles.consentText}>You can delete the result anytime</Text>
                </View>
                <View style={styles.consentRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                  <Text style={styles.consentText}>You can regenerate with a different photo</Text>
                </View>
              </View>
              {error && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color="#FF6B6B" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <View style={styles.actions}>
                <Pressable onPress={handleReset} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Maybe later</Text>
                </Pressable>
                <Pressable onPress={handlePickPhoto} style={styles.primaryButton}>
                  <Text style={styles.primaryText}>Choose photo</Text>
                </Pressable>
              </View>
            </>
          )}

          {step === "picking" && (
            <View style={styles.centerState}>
              <ActivityIndicator color="#F7D38B" size="large" />
              <Text style={styles.statusText}>Opening photo library...</Text>
            </View>
          )}

          {step === "uploading" && (
            <View style={styles.centerState}>
              <ActivityIndicator color="#F7D38B" size="large" />
              <Text style={styles.statusText}>Uploading your photo...</Text>
            </View>
          )}

          {step === "generating" && (
            <View style={styles.centerState}>
              <ActivityIndicator color="#F7D38B" size="large" />
              <Text style={styles.statusText}>
                Your {memberLabel} is forming...{`\n`}This may take 10–15 seconds
              </Text>
            </View>
          )}

          {step === "done" && (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="checkmark-circle" size={48} color="#4ADE80" />
              </View>
              <Text style={styles.title}>Your {memberLabel} has arrived</Text>
              <Text style={styles.body}>
                The personalized avatar will now appear in your transmissions from{" "}
                {memberLabel.toLowerCase()}.
              </Text>
              <Pressable onPress={handleReset} style={styles.primaryButton}>
                <Text style={styles.primaryText}>Done</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(8,10,23,0.7)",
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: "100%",
    maxWidth: 400,
    gap: 18,
    padding: 28,
    borderRadius: 28,
    backgroundColor: "#101320",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.18)",
    alignItems: "center",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(247,211,139,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#F8F0DE",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  body: {
    color: "#BCC2DA",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  consentList: {
    width: "100%",
    gap: 10,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  consentText: {
    flex: 1,
    color: "#C8D4E8",
    fontSize: 13,
    lineHeight: 18,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,107,107,0.1)",
  },
  errorText: {
    flex: 1,
    color: "#FF6B6B",
    fontSize: 13,
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#F7D38B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryText: {
    color: "#101320",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  secondaryText: {
    color: "#C8D4E8",
    fontSize: 15,
    fontWeight: "800",
  },
  centerState: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  statusText: {
    color: "#C8D4E8",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
  },
});
