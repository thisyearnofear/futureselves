/**
 * ritual-state.tsx
 *
 * Game state visualization beyond streaks:
 * - Choice pattern: counts toward/steady/release/repair with visual progress
 * - Consequence chain: 3 same-direction choices in a week = compound reward
 * - Streak risk: warning when streak is about to break
 *
 * Adds skill-based progression to the daily ritual loop.
 */

import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, SlideInRight, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import type { PersonaState, Choice } from "@/lib/futureself";
import {
  CHOICE_CONFIG,
  MAX_CHAIN,
  getConsequenceChain,
  getStreakRisk,
} from "@/lib/ritual-logic";

interface RitualStateProps {
  persona: PersonaState;
  recentChoices?: Array<{ choice: Choice; dateKey: string }>;
}

export function RitualState({ persona, recentChoices = [] }: RitualStateProps) {
  const chain = useMemo(
    () => getConsequenceChain(recentChoices),
    [recentChoices],
  );
  const risk = useMemo(
    () => getStreakRisk(persona.streak, persona.lastCheckInDateKey),
    [persona.streak, persona.lastCheckInDateKey],
  );

  const chainConfig = chain.type
    ? CHOICE_CONFIG.find((c) => c.key === chain.type)
    : null;

  return (
    <Animated.View
      entering={SlideInRight.delay(100).duration(400)}
      style={styles.container}
    >
      {/* Streak risk indicator */}
      {risk.level !== "safe" || persona.streak > 0 ? (
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={[
            styles.riskCard,
            risk.level === "warning" && styles.riskCardWarning,
            risk.level === "critical" && styles.riskCardCritical,
          ]}
        >
          <View
            style={[
              styles.riskIcon,
              {
                backgroundColor:
                  risk.level === "critical"
                    ? "rgba(255,107,107,0.18)"
                    : risk.level === "warning"
                      ? "rgba(247,211,139,0.18)"
                      : "rgba(169,247,181,0.18)",
              },
            ]}
          >
            <Ionicons
              name={
                risk.level === "critical"
                  ? "flame-outline"
                  : risk.level === "warning"
                    ? "time-outline"
                    : "flame"
              }
              size={16}
              color={
                risk.level === "critical"
                  ? "#FF6B6B"
                  : risk.level === "warning"
                    ? "#F7D38B"
                    : "#A9F7B5"
              }
            />
          </View>
          <View style={styles.riskCopy}>
            <Text style={styles.riskTitle}>
              {persona.streak} day{persona.streak !== 1 ? "s" : ""}
            </Text>
            <Text style={styles.riskMessage}>{risk.message}</Text>
          </View>
        </Animated.View>
      ) : null}

      {/* Choice pattern visualization */}
      <View style={styles.patternCard}>
        <View style={styles.patternHeader}>
          <Ionicons name="analytics-outline" size={14} color="#F7D38B" />
          <Text style={styles.patternTitle}>Your pattern</Text>
        </View>
        <View style={styles.choiceBars}>
          {CHOICE_CONFIG.map((config) => {
            const count =
              config.key === "toward"
                ? persona.towardCount
                : config.key === "steady"
                  ? persona.steadyCount
                  : config.key === "release"
                    ? persona.releaseCount
                    : persona.repairCount;
            const maxCount = Math.max(
              persona.towardCount,
              persona.steadyCount,
              persona.releaseCount,
              persona.repairCount,
              1,
            );
            const fillPct = (count / Math.max(maxCount, 5)) * 100;
            return (
              <View key={config.key} style={styles.choiceBarRow}>
                <View style={styles.choiceBarLabel}>
                  <Ionicons name={config.icon as any} size={12} color={config.color} />
                  <Text style={styles.choiceBarText}>{config.label}</Text>
                </View>
                <View style={styles.choiceBarTrack}>
                  <View
                    style={[
                      styles.choiceBarFill,
                      { width: `${fillPct}%`, backgroundColor: config.color },
                    ]}
                  />
                </View>
                <Text style={[styles.choiceBarCount, { color: config.color }]}>
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Consequence chain */}
      {chainConfig && chain.length > 0 ? (
        <Animated.View entering={ZoomIn.duration(300)} style={styles.chainCard}>
          <View style={styles.chainHeader}>
            <View
              style={[
                styles.chainIcon,
                { backgroundColor: `${chainConfig.color}22`, borderColor: `${chainConfig.color}66` },
              ]}
            >
              <Ionicons name={chainConfig.icon as any} size={16} color={chainConfig.color} />
            </View>
            <View style={styles.chainCopy}>
              <Text style={styles.chainTitle}>
                {chain.isComplete ? "Chain complete" : "Building a chain"}
              </Text>
              <Text style={styles.chainSubtitle}>
                {chain.length} consecutive {chainConfig.label.toLowerCase()} move
                {chain.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          {/* Chain dots */}
          <View style={styles.chainDots}>
            {Array.from({ length: 3 }, (_, i) => {
              const isFilled = i < chain.length;
              return (
                <View
                  key={i}
                  style={[
                    styles.chainDot,
                    isFilled && {
                      backgroundColor: chainConfig.color,
                      borderColor: chainConfig.color,
                    },
                    isFilled && i === 2 && styles.chainDotComplete,
                  ]}
                >
                  {isFilled && i === 2 ? (
                    <Ionicons name="checkmark" size={10} color="#101320" />
                  ) : null}
                </View>
              );
            })}
          </View>
          <Text style={[styles.chainReward, chain.isComplete && { color: chainConfig.color }]}>
            {chain.nextReward}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  // ─── Streak risk ───
  riskCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(169,247,181,0.06)",
    borderWidth: 1,
    borderColor: "rgba(169,247,181,0.18)",
  },
  riskCardWarning: {
    backgroundColor: "rgba(247,211,139,0.06)",
    borderColor: "rgba(247,211,139,0.18)",
  },
  riskCardCritical: {
    backgroundColor: "rgba(255,107,107,0.06)",
    borderColor: "rgba(255,107,107,0.18)",
  },
  riskIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  riskCopy: {
    flex: 1,
    gap: 2,
  },
  riskTitle: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "900",
  },
  riskMessage: {
    color: "#AEB6D4",
    fontSize: 12,
    fontWeight: "600",
  },
  // ─── Pattern card ───
  patternCard: {
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(14,17,34,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  patternHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  patternTitle: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  choiceBars: {
    gap: 10,
  },
  choiceBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  choiceBarLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 76,
  },
  choiceBarText: {
    color: "#AEB6D4",
    fontSize: 11,
    fontWeight: "800",
  },
  choiceBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  choiceBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  choiceBarCount: {
    width: 28,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  // ─── Consequence chain ───
  chainCard: {
    gap: 10,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(14,17,34,0.72)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.18)",
  },
  chainHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chainIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  chainCopy: {
    flex: 1,
    gap: 2,
  },
  chainTitle: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "900",
  },
  chainSubtitle: {
    color: "#AEB6D4",
    fontSize: 12,
    fontWeight: "600",
  },
  chainDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chainDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  chainDotComplete: {
    transform: [{ scale: 1.1 }],
  },
  chainReward: {
    color: "#AEB6D4",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
});
