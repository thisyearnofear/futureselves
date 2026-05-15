import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { CastMember } from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";

const AURA_COLORS: Partial<Record<CastMember, readonly [string, string, string]>> = {
  future_self: ["#1A1520", "#1E1A2A", "#0F0E18"],
  future_partner: ["#1F1520", "#221A2A", "#150E18"],
  future_mentor: ["#141820", "#1A1E2A", "#0E1018"],
  shadow: ["#18141E", "#1E182A", "#100E18"],
  alternate_self: ["#16141E", "#1C182A", "#0F0E18"],
  future_best_friend: ["#1A1720", "#1E1C2A", "#100F18"],
};

const DEFAULT_COLORS = ["#1A1520", "#1E1A2A", "#0F0E18"] as const;

interface TransmissionShareCardProps {
  text: string;
  castMember: CastMember;
  streak: number;
  title: string;
}

/**
 * A beautifully styled card designed to be captured as an image for sharing.
 * Uses ViewShot-compatible styling (no opacity animations, no transforms).
 */
export const TransmissionShareCard = forwardRef<View, TransmissionShareCardProps>(
  function TransmissionShareCard({ text, castMember, streak, title }, ref) {
    const colors = AURA_COLORS[castMember] ?? DEFAULT_COLORS;
    const teaser = text.length > 200 ? `${text.slice(0, 197)}...` : text;

    return (
      <View ref={ref} collapsable={false} style={cardStyles.wrapper}>
        <LinearGradient
          colors={[...colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={cardStyles.gradient}
        >
          {/* Top accent line */}
          <View style={cardStyles.accentLine} />

          {/* Header */}
          <View style={cardStyles.header}>
            <View style={cardStyles.castBadge}>
              <Ionicons name="radio" size={12} color="#F7D38B" />
              <Text style={cardStyles.castText}>
                {formatCastMember(castMember)}
              </Text>
            </View>
            <Text style={cardStyles.dayBadge}>Day {streak}</Text>
          </View>

          {/* Title */}
          <Text style={cardStyles.title}>{title}</Text>

          {/* Quote */}
          <View style={cardStyles.quoteContainer}>
            <Text style={cardStyles.openQuote}>&ldquo;</Text>
            <Text style={cardStyles.quoteText}>{teaser}</Text>
            <Text style={cardStyles.closeQuote}>&rdquo;</Text>
          </View>

          {/* Footer */}
          <View style={cardStyles.footer}>
            <View style={cardStyles.brandRow}>
              <View style={cardStyles.brandDot} />
              <Text style={cardStyles.brandText}>future self</Text>
            </View>
            <Text style={cardStyles.urlText}>futureself.app</Text>
          </View>
        </LinearGradient>
      </View>
    );
  },
);

const cardStyles = StyleSheet.create({
  wrapper: {
    width: 390,
    borderRadius: 28,
    overflow: "hidden",
  },
  gradient: {
    padding: 28,
    gap: 20,
  },
  accentLine: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#F7D38B",
    alignSelf: "flex-start",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  castBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(247,211,139,0.12)",
  },
  castText: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  dayBadge: {
    color: "#8F96B4",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  title: {
    color: "#F8F0DE",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  quoteContainer: {
    paddingLeft: 4,
  },
  openQuote: {
    color: "#F7D38B",
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 36,
    marginBottom: -8,
  },
  quoteText: {
    color: "#E8E1D3",
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "700",
    paddingLeft: 4,
  },
  closeQuote: {
    color: "#F7D38B",
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 36,
    textAlign: "right",
    marginTop: -4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F7D38B",
  },
  brandText: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  urlText: {
    color: "#6F7591",
    fontSize: 12,
    fontWeight: "700",
  },
});
