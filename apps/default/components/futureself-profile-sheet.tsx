import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Distinguishing, HairStyle, PersonaState, SkinTone } from "@/lib/futureself";
import {
  distinguishingLabels,
  distinguishingValues,
  hairStyleLabels,
  hairStyleValues,
  skinToneLabels,
  skinToneValues,
} from "@/lib/futureself";

interface ProfileRefinementValues {
  age?: string;
  afraidWontHappen?: string;
  draining: string;
  significantDates: Array<string>;
  skinTone?: string;
  hairStyle?: string;
  distinguishing?: string;
}

interface FutureselfProfileSheetProps {
  visible: boolean;
  persona: PersonaState | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: ProfileRefinementValues) => Promise<void>;
}

export function FutureselfProfileSheet({
  visible,
  persona,
  isSaving,
  onClose,
  onSave,
}: FutureselfProfileSheetProps) {
  const [age, setAge] = useState("");
  const [afraidWontHappen, setAfraidWontHappen] = useState("");
  const [draining, setDraining] = useState("");
  const [significantDate, setSignificantDate] = useState("");
  const [skinTone, setSkinTone] = useState("");
  const [hairStyle, setHairStyle] = useState("");
  const [distinguishing, setDistinguishing] = useState("");

  useEffect(() => {
    if (!visible || !persona) return;
    setAge(persona.age ?? "");
    setAfraidWontHappen(persona.afraidWontHappen);
    setDraining(persona.draining);
    setSignificantDate(persona.significantDates[0] ?? "");
    setSkinTone(persona.skinTone ?? "");
    setHairStyle(persona.hairStyle ?? "");
    setDistinguishing(persona.distinguishing ?? "");
  }, [visible, persona]);

  if (!persona) return null;

  async function handleSave() {
    await onSave({
      age: age.trim() || undefined,
      afraidWontHappen: afraidWontHappen.trim() || undefined,
      draining: draining.trim(),
      significantDates: significantDate.trim() ? [significantDate.trim()] : [],
      skinTone: skinTone || undefined,
      hairStyle: hairStyle || undefined,
      distinguishing: distinguishing || undefined,
    });
  }

  const isReady = Boolean(draining.trim());

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Your profile</Text>
              <Text style={styles.title}>Give future-you a little more context.</Text>
              <Text style={styles.copy}>
                Now that the ritual has started, you can add a few optional details
                to make future transmissions feel more grounded.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-outline" size={22} color="#F8F0DE" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.infoCard}>
              <Ionicons name="sparkles-outline" size={16} color="#F7D38B" />
              <Text style={styles.infoText}>
                This helps future transmissions sound more grounded and less generic.
              </Text>
            </View>

            <Field
              label="Age, if it matters to the story"
              onChangeText={setAge}
              placeholder="Optional"
              value={age}
            />
            <View style={styles.chipSection}>
              <Text style={styles.label}>How would someone spot you in a crowd?</Text>
              <Text style={styles.chipHint}>Optional. Helps future-you look more like you.</Text>
              <ChipRow
                values={skinToneValues}
                selected={skinTone as SkinTone | ""}
                labels={skinToneLabels as Record<string, string>}
                onSelect={(v) => setSkinTone(v === skinTone ? "" : v)}
              />
              <ChipRow
                values={hairStyleValues}
                selected={hairStyle as HairStyle | ""}
                labels={hairStyleLabels as Record<string, string>}
                onSelect={(v) => setHairStyle(v === hairStyle ? "" : v)}
              />
              <ChipRow
                values={distinguishingValues}
                selected={distinguishing as Distinguishing | ""}
                labels={distinguishingLabels as Record<string, string>}
                onSelect={(v) => setDistinguishing(v === distinguishing ? "" : v)}
              />
            </View>
            <Field
              label="What future do you almost not let yourself want?"
              multiline
              onChangeText={setAfraidWontHappen}
              placeholder="The hope under the practical answers."
              value={afraidWontHappen}
            />
            <Field
              label="What has been draining you lately?"
              multiline
              onChangeText={setDraining}
              placeholder="A pattern, habit, room, or rhythm that keeps wearing you down."
              value={draining}
            />
            <Field
              label="One date the future should remember"
              onChangeText={setSignificantDate}
              placeholder="Optional: a birthday, deadline, move, or anniversary"
              value={significantDate}
            />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Later</Text>
            </Pressable>
            <Pressable
              disabled={!isReady || isSaving}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.primaryButton,
                (!isReady || isSaving) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#101320" />
              ) : (
                <Text style={styles.primaryText}>Save profile</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6F7591"
        style={[styles.input, multiline && styles.inputMultiline]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

function ChipRow<T extends string>({
  values,
  selected,
  labels,
  onSelect,
}: {
  values: ReadonlyArray<T>;
  selected: T | "";
  labels: Record<string, string>;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {values.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          style={[styles.chip, selected === value && styles.chipActive]}
        >
          <Text style={[styles.chipText, selected === value && styles.chipTextActive]}>
            {labels[value]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8,10,23,0.55)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#101320",
    borderTopWidth: 1,
    borderColor: "rgba(247,211,139,0.18)",
    paddingTop: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#F8F0DE",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  copy: {
    color: "#AEB6D4",
    fontSize: 13,
    lineHeight: 19,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(247,211,139,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.14)",
  },
  infoText: {
    flex: 1,
    color: "#D8DDF0",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  fieldWrap: {
    gap: 8,
  },
  label: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "800",
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    color: "#F8F0DE",
    fontSize: 16,
    paddingHorizontal: 15,
  },
  inputMultiline: {
    minHeight: 112,
    paddingTop: 14,
    lineHeight: 22,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  secondaryText: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1.4,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7D38B",
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryText: {
    color: "#101320",
    fontSize: 14,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  chipSection: {
    gap: 10,
  },
  chipHint: {
    color: "#AEB6D4",
    fontSize: 12,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipActive: {
    backgroundColor: "rgba(247,211,139,0.18)",
    borderColor: "rgba(247,211,139,0.45)",
  },
  chipText: {
    color: "#AEB6D4",
    fontWeight: "800",
    fontSize: 13,
  },
  chipTextActive: {
    color: "#F7D38B",
  },
});
