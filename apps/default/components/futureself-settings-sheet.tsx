import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  Archetype,
  FirstVoiceCastMember,
  PersonaState,
  Timeline,
  VoicePreset,
} from "@/lib/futureself";
import type { ReminderPreferences } from "@/lib/reminder-preferences";
import {
  archetypeLabels,
  archetypeValues,
  firstVoiceCastMembers,
  firstVoiceLabels,
  inferVoicePresetFromSelectedVoice,
  timelineLabels,
  timelineValues,
  voicePresetDescriptions,
  voicePresetLabels,
  voicePresetValues,
} from "@/lib/futureself";

interface SettingsPreferences {
  timeline: Timeline;
  archetype: Archetype;
  firstVoice: FirstVoiceCastMember;
  voicePreset: VoicePreset;
  futureChildOptIn: boolean;
  reminderEnabled: boolean;
  reminderHour: number;
}

interface FutureselfSettingsSheetProps {
  visible: boolean;
  persona: PersonaState | null;
  isSaving: boolean;
  reminderPreferences: ReminderPreferences;
  onClose: () => void;
  onSignOut: () => void;
  onSave: (preferences: SettingsPreferences) => Promise<void>;
}

export function FutureselfSettingsSheet({
  visible,
  persona,
  isSaving,
  reminderPreferences,
  onClose,
  onSignOut,
  onSave,
}: FutureselfSettingsSheetProps) {
  const [timeline, setTimeline] = useState<Timeline>("5_years");
  const [archetype, setArchetype] = useState<Archetype>("wise");
  const [firstVoice, setFirstVoice] =
    useState<FirstVoiceCastMember>("future_self");
  const [voicePreset, setVoicePreset] = useState<VoicePreset>("ember");
  const [futureChildOptIn, setFutureChildOptIn] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);

  useEffect(() => {
    if (!visible || !persona) return;
    setTimeline(persona.timeline);
    setArchetype(persona.archetype);
    setFirstVoice((persona.firstVoice as FirstVoiceCastMember) ?? "future_self");
    setVoicePreset(inferVoicePresetFromSelectedVoice(persona.selectedVoiceName));
    setFutureChildOptIn(persona.futureChildOptIn);
    setReminderEnabled(reminderPreferences.enabled);
    setReminderHour(reminderPreferences.hour);
  }, [visible, persona, reminderPreferences.enabled, reminderPreferences.hour]);

  const hasChanges = useMemo(() => {
    if (!persona) return false;
    return (
      timeline !== persona.timeline ||
      archetype !== persona.archetype ||
      firstVoice !== persona.firstVoice ||
      voicePreset !== inferVoicePresetFromSelectedVoice(persona.selectedVoiceName) ||
      futureChildOptIn !== persona.futureChildOptIn ||
      reminderEnabled !== reminderPreferences.enabled ||
      reminderHour !== reminderPreferences.hour
    );
  }, [
    archetype,
    firstVoice,
    futureChildOptIn,
    persona,
    reminderEnabled,
    reminderHour,
    reminderPreferences.enabled,
    reminderPreferences.hour,
    timeline,
    voicePreset,
  ]);

  if (!persona) return null;

  async function handleSave() {
    await onSave({
      timeline,
      archetype,
      firstVoice,
      voicePreset,
      futureChildOptIn,
      reminderEnabled,
      reminderHour,
    });
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Ritual settings</Text>
              <Text style={styles.title}>Shape the ritual, not just the signal.</Text>
              <Text style={styles.copy}>
                Your first transmission got you started. This is where you tune the
                horizon, voice, and consent settings without restarting the line.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-outline" size={22} color="#F8F0DE" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryPill}>
                <Ionicons name="radio-outline" size={14} color="#F7D38B" />
                <Text style={styles.summaryPillText}>
                  {persona.selectedVoiceName} active
                </Text>
              </View>
              <View style={styles.summaryPill}>
                <Ionicons name="git-branch-outline" size={14} color="#F7D38B" />
                <Text style={styles.summaryPillText}>
                  {timelineLabels[timeline]}
                </Text>
              </View>
              <View style={styles.summaryPill}>
                <Ionicons name="notifications-outline" size={14} color="#F7D38B" />
                <Text style={styles.summaryPillText}>
                  {reminderEnabled
                    ? `${reminderHour === 20 ? "8 PM" : `${reminderHour} AM`} reminder`
                    : "Reminders off"}
                </Text>
              </View>
            </View>

            <Section
              title="Ritual profile"
              copy="These shape the distance, tone, and default perspective of the voices answering you."
            >
              <Label text="Timeline horizon" />
              <ChipGrid
                labels={timelineLabels}
                onSelect={setTimeline}
                selected={timeline}
                values={timelineValues}
              />

              <Label text="Archetype tone" />
              <ChipGrid
                labels={archetypeLabels}
                onSelect={setArchetype}
                selected={archetype}
                values={archetypeValues}
              />

              <Label text="Default first voice" />
              <ChipGrid
                labels={firstVoiceLabels}
                onSelect={setFirstVoice}
                selected={firstVoice}
                values={firstVoiceCastMembers}
              />
            </Section>

            <Section
              title="Voice delivery"
              copy="If audio is unavailable, your transmission still arrives in text. The ritual never depends on playback."
            >
              <View style={styles.voiceList}>
                {voicePresetValues.map((preset) => {
                  const selected = voicePreset === preset;
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => setVoicePreset(preset)}
                      style={[
                        styles.voiceCard,
                        selected && styles.voiceCardSelected,
                      ]}
                    >
                      <View style={styles.voiceHeader}>
                        <Text
                          style={[
                            styles.voiceName,
                            selected && styles.voiceNameSelected,
                          ]}
                        >
                          {voicePresetLabels[preset]}
                        </Text>
                        {selected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#F7D38B"
                          />
                        ) : null}
                      </View>
                      <Text style={styles.voiceDescription}>
                        {voicePresetDescriptions[preset]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            <Section
              title="Reminder rhythm"
              copy="Reminders are local to this device. They only turn on if you choose them here."
            >
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>Daily reminder</Text>
                  <Text style={styles.toggleBody}>
                    A gentle nudge that your signal is waiting.
                  </Text>
                </View>
                <Switch
                  onValueChange={setReminderEnabled}
                  thumbColor={reminderEnabled ? "#F7D38B" : "#F8F0DE"}
                  trackColor={{
                    false: "rgba(255,255,255,0.18)",
                    true: "rgba(247,211,139,0.45)",
                  }}
                  value={reminderEnabled}
                />
              </View>
              <View style={styles.chipGrid}>
                {[
                  { label: "8 AM", hour: 8 },
                  { label: "9 AM", hour: 9 },
                  { label: "8 PM", hour: 20 },
                ].map((option) => (
                  <Pressable
                    key={option.label}
                    disabled={!reminderEnabled}
                    onPress={() => setReminderHour(option.hour)}
                    style={[
                      styles.chip,
                      reminderHour === option.hour && styles.chipSelected,
                      !reminderEnabled && styles.disabledChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        reminderHour === option.hour && styles.chipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="notifications-outline" size={18} color="#F7D38B" />
                <Text style={styles.infoText}>
                  We only ask the device for notification permission if you turn
                  reminders on. This reminder stays local to this device, and web
                  does not schedule push reminders in this version.
                </Text>
              </View>
            </Section>

            <Section
              title="Rare voices"
              copy="These show up sparingly and only when the story earns them. Keep them off until you want that wider emotional range."
            >
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>Allow family-future voices</Text>
                  <Text style={styles.toggleBody}>
                    Includes rare voices like a future child. This is always
                    optional.
                  </Text>
                </View>
                <Switch
                  onValueChange={setFutureChildOptIn}
                  thumbColor={futureChildOptIn ? "#F7D38B" : "#F8F0DE"}
                  trackColor={{
                    false: "rgba(255,255,255,0.18)",
                    true: "rgba(247,211,139,0.45)",
                  }}
                  value={futureChildOptIn}
                />
              </View>
            </Section>

            <Section
              title="Trust and account"
              copy="Small, explicit controls. Nothing here resets your ritual unless you choose to leave the session."
            >
              <View style={styles.accountModesSummary}>
                <View style={styles.accountModeCard}>
                  <Text style={styles.accountModeEyebrow}>Quick start</Text>
                  <Text style={styles.accountModeTitle}>Anonymous-first is valid</Text>
                  <Text style={styles.accountModeBody}>
                    You can begin the ritual without committing to an account
                    first.
                  </Text>
                </View>
                <View style={styles.accountModeCard}>
                  <Text style={styles.accountModeEyebrow}>Account-backed</Text>
                  <Text style={styles.accountModeTitle}>Use sign-in for continuity</Text>
                  <Text style={styles.accountModeBody}>
                    Return with the same account when you want a longer-running
                    timeline.
                  </Text>
                </View>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#F7D38B" />
                <Text style={styles.infoText}>
                  Your check-ins and transmissions stay attached to the session or
                  account you opened. Use sign out only if you want to switch
                  identity on the welcome screen.
                </Text>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="volume-medium-outline" size={18} color="#F7D38B" />
                <Text style={styles.infoText}>
                  Audio is optional. The ritual still works in text-first mode if
                  voice playback is unavailable.
                </Text>
              </View>
              <Pressable
                onPress={onSignOut}
                style={({ pressed }) => [
                  styles.signOutButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="log-out-outline" size={16} color="#F8F0DE" />
                <Text style={styles.signOutText}>Sign out and switch account</Text>
              </Pressable>
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
            <Pressable
              disabled={!hasChanges || isSaving}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.primaryButton,
                (!hasChanges || isSaving) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#101320" />
              ) : (
                <Text style={styles.primaryButtonText}>Save ritual settings</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCopy}>{copy}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function ChipGrid<T extends string>({
  values,
  selected,
  labels,
  onSelect,
}: {
  values: ReadonlyArray<T>;
  selected: T;
  labels: Record<T, string>;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.chipGrid}>
      {values.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          style={[
            styles.chip,
            selected === value && styles.chipSelected,
          ]}
        >
          <Text
            style={[
              styles.chipText,
              selected === value && styles.chipTextSelected,
            ]}
          >
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
    maxHeight: "88%",
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
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(247,211,139,0.1)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.16)",
  },
  summaryPillText: {
    color: "#F8F0DE",
    fontSize: 12,
    fontWeight: "800",
  },
  accountModesSummary: {
    gap: 10,
  },
  accountModeCard: {
    gap: 5,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  accountModeEyebrow: {
    color: "#F7D38B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  accountModeTitle: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "900",
  },
  accountModeBody: {
    color: "#BFC6DE",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  section: {
    gap: 8,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionTitle: {
    color: "#F8F0DE",
    fontSize: 16,
    fontWeight: "900",
  },
  sectionCopy: {
    color: "#AEB6D4",
    fontSize: 13,
    lineHeight: 18,
  },
  sectionBody: {
    gap: 12,
  },
  label: {
    color: "#D7DCEE",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipSelected: {
    backgroundColor: "rgba(247,211,139,0.16)",
    borderColor: "rgba(247,211,139,0.34)",
  },
  disabledChip: {
    opacity: 0.45,
  },
  chipText: {
    color: "#AEB6D4",
    fontSize: 12,
    fontWeight: "800",
  },
  chipTextSelected: {
    color: "#F7D38B",
  },
  voiceList: {
    gap: 10,
  },
  voiceCard: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  voiceCardSelected: {
    backgroundColor: "rgba(247,211,139,0.12)",
    borderColor: "rgba(247,211,139,0.28)",
  },
  voiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  voiceName: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "900",
  },
  voiceNameSelected: {
    color: "#F7D38B",
  },
  voiceDescription: {
    color: "#BFC6DE",
    fontSize: 13,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "800",
  },
  toggleBody: {
    color: "#BFC6DE",
    fontSize: 12,
    lineHeight: 18,
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
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  signOutText: {
    color: "#F8F0DE",
    fontSize: 13,
    fontWeight: "800",
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
  secondaryButtonText: {
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
  primaryButtonText: {
    color: "#101320",
    fontSize: 14,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
});
