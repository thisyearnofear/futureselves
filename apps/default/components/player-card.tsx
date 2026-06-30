/**
 * player-card.tsx — FIFA Ultimate Team style player card.
 *
 * The viral share surface for the Football Path. Shows the user's
 * position, level, and stats (PAC/REA/CTR/Overall) derived from
 * drill results. Tapping the card captures it as an image and opens
 * the native share sheet.
 *
 * Uses the same captureRef + RNShare pattern as TransmissionShareCard.
 * No new dependencies — react-native-view-shot and react-native Share
 * are already installed.
 *
 * Stats are calculated in drill-utils.ts (single source of truth).
 */

import { forwardRef, useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  type CardStats,
  getCardTier,
  CARD_TIER_COLORS,
} from "@/lib/drill-utils";

// ─── Next goal calculation ───────────────────────────────────────────────────

const TIER_THRESHOLDS = [
  { tier: "bronze", min: 0 },
  { tier: "silver", min: 50 },
  { tier: "gold", min: 70 },
  { tier: "elite", min: 85 },
] as const;

function getNextTier(overall: number): { label: string; min: number } | null {
  for (const t of TIER_THRESHOLDS) {
    if (overall < t.min) return { label: t.tier.toUpperCase(), min: t.min };
  }
  return null;
}

function getWeakestStat(stats: CardStats): { label: string; value: number } {
  const statsArr = [
    { label: "PAC", value: stats.pac },
    { label: "REA", value: stats.rea },
    { label: "CTR", value: stats.ctr },
  ];
  return statsArr.reduce((min, s) => (s.value < min.value ? s : min));
}

const POSITION_SHORT: Record<string, string> = {
  goalkeeper: "GK",
  center_back: "CB",
  full_back: "FB",
  defensive_mid: "CDM",
  central_mid: "CM",
  attacking_mid: "CAM",
  winger: "LW",
  striker: "ST",
  unknown: "FUT",
};

interface PlayerCardProps {
  playerName: string;
  position: string;
  positionLabel: string;
  level: string;
  stats: CardStats;
  /** Optional stat delta to show as a callout badge (e.g. "REA +5"). */
  statDelta?: { label: string; delta: number } | null;
}

/**
 * The card itself — designed to be captured via captureRef.
 * No animations, no opacity transforms — ViewShot-compatible only.
 */
export const PlayerCard = forwardRef<View, PlayerCardProps>(
  function PlayerCard({ playerName, position, positionLabel, level, stats, statDelta }, ref) {
    const tier = getCardTier(stats.overall);
    const colors = CARD_TIER_COLORS[tier];

    return (
      <View ref={ref} collapsable={false} style={cardStyles.wrapper}>
        <LinearGradient
          colors={["#0E1122", "#141828", "#0A0D1A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={cardStyles.gradient}
        >
          {/* Tier accent border */}
          <View style={[cardStyles.accentBorder, { borderColor: colors.border }]} />

          {/* Top row: position + overall */}
          <View style={cardStyles.topRow}>
            <View style={cardStyles.positionCol}>
              <Text style={[cardStyles.positionShort, { color: colors.primary }]}>
                {POSITION_SHORT[position] ?? "FUT"}
              </Text>
              <Text style={cardStyles.positionFull}>{positionLabel}</Text>
            </View>
            <View style={cardStyles.overallCol}>
              <Text style={[cardStyles.overallNumber, { color: colors.primary }]}>
                {stats.overall}
              </Text>
              <Text style={[cardStyles.overallLabel, { color: colors.primary }]}>
                {colors.label}
              </Text>
            </View>
          </View>

          {/* Player name */}
          <Text style={cardStyles.playerName} numberOfLines={1}>
            {playerName.toUpperCase()}
          </Text>

          {/* Divider */}
          <View style={cardStyles.divider} />

          {/* Stats */}
          <View style={cardStyles.statsRow}>
            <StatBar label="PAC" value={stats.pac} color={colors.primary} />
            <StatBar label="REA" value={stats.rea} color={colors.primary} />
            <StatBar label="CTR" value={stats.ctr} color={colors.primary} />
          </View>

          {/* Level + on-device badge */}
          <View style={cardStyles.footerRow}>
            <Text style={cardStyles.levelText}>{level.toUpperCase()}</Text>
            <View style={cardStyles.deviceBadge}>
              <Ionicons name="shield-checkmark" size={10} color="#6B7290" />
              <Text style={cardStyles.deviceBadgeText}>BUILT ON-DEVICE</Text>
            </View>
          </View>

          {/* Stat delta callout */}
          {statDelta && statDelta.delta !== 0 && (
            <View style={[cardStyles.deltaBadge, { borderColor: colors.primary }]}>
              <Text style={[cardStyles.deltaText, { color: colors.primary }]}>
                {statDelta.label} {statDelta.delta > 0 ? "+" : ""}{statDelta.delta}
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  },
);

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={cardStyles.statCol}>
      <Text style={cardStyles.statLabel}>{label}</Text>
      <Text style={[cardStyles.statValue, { color: value > 0 ? color : "#3A3F58" }]}>
        {value > 0 ? value : "—"}
      </Text>
      <View style={cardStyles.statTrack}>
        <View
          style={[
            cardStyles.statFill,
            { width: `${value}%`, backgroundColor: value > 0 ? color : "#3A3F58" },
          ]}
        />
      </View>
    </View>
  );
}

// ─── Interactive wrapper with share ──────────────────────────────────────────

interface PlayerCardShareProps extends PlayerCardProps {
  /** Whether to show the "Tap to share" hint below the card. */
  showShareHint?: boolean;
}

/**
 * Wraps the PlayerCard with tap-to-share functionality.
 * Captures the card as a PNG and opens the native share sheet.
 */
export function PlayerCardShare({ showShareHint = true, ...cardProps }: PlayerCardShareProps) {
  const cardRef = forwardRef<View, {}>(() => null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    if (Platform.OS === "web") return;
    setIsSharing(true);
    setShareStatus(null);
    try {
      const { captureRef } = await import("react-native-view-shot");
      const { Share: RNShare } = await import("react-native");
      // cardRef is set on the PlayerCard via forwardRef
      const uri = await captureRef(cardRef as any, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await RNShare.share({
        url: uri,
        message: `My Football Path card — ${cardProps.positionLabel}, OVR ${cardProps.stats.overall}. Built entirely on-device. #FootballPath`,
        title: "My Football Path Card",
      });
      setShareStatus("Shared!");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Fallback: text-only share
      const { Share: RNShare } = await import("react-native");
      try {
        await RNShare.share({
          message: `My Football Path card — ${cardProps.positionLabel}, OVR ${cardProps.stats.overall}. Built entirely on-device. #FootballPath`,
          title: "My Football Path Card",
        });
        setShareStatus("Shared!");
      } catch {
        setShareStatus(null);
      }
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareStatus(null), 2000);
    }
  }, [cardProps.positionLabel, cardProps.stats.overall]);

  return (
    <View style={shareStyles.container}>
      <Pressable
        onPress={handleShare}
        disabled={isSharing}
        style={({ pressed }) => pressed ? { transform: [{ scale: 0.98 }], opacity: 0.92 } : undefined}
      >
        <PlayerCard ref={cardRef as any} {...cardProps} />
      </Pressable>

      {/* Next goal indicator */}
      <NextGoal stats={cardProps.stats} />

      {showShareHint && (
        <View style={shareStyles.hintRow}>
          {isSharing ? (
            <Text style={shareStyles.hintText}>Capturing...</Text>
          ) : shareStatus ? (
            <Text style={shareStyles.hintTextDone}>{shareStatus}</Text>
          ) : (
            <>
              <Ionicons name="share-outline" size={14} color="#6B7290" />
              <Text style={shareStyles.hintText}>Tap card to share</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Next goal indicator ─────────────────────────────────────────────────────

function NextGoal({ stats }: { stats: CardStats }) {
  const nextTier = getNextTier(stats.overall);
  const weakest = getWeakestStat(stats);

  if (!nextTier) {
    // Already elite
    return (
      <View style={goalStyles.container}>
        <Ionicons name="trophy" size={14} color="#A0F4D8" />
        <Text style={goalStyles.text}>Elite tier — max rank achieved</Text>
      </View>
    );
  }

  const pointsToNext = nextTier.min - stats.overall;

  return (
    <View style={goalStyles.container}>
      <View style={goalStyles.row}>
        <Ionicons name="trending-up" size={14} color="#F7D38B" />
        <Text style={goalStyles.text}>
          {pointsToNext} points to <Text style={goalStyles.highlight}>{nextTier.label}</Text>
        </Text>
      </View>
      {weakest.value > 0 && (
        <Text style={goalStyles.sub}>
          Train {weakest.label} (lowest at {weakest.value}) to climb faster
        </Text>
      )}
    </View>
  );
}

const goalStyles = StyleSheet.create({
  container: {
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginTop: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: {
    color: "#BFC6DE",
    fontSize: 13,
    fontWeight: "600",
  },
  highlight: {
    color: "#F7D38B",
    fontWeight: "800",
  },
  sub: {
    color: "#6B7290",
    fontSize: 11,
    fontWeight: "600",
    paddingLeft: 20,
  },
});

// ─── Card styles (ViewShot-safe: no animations, no opacity) ──────────────────

const cardStyles = StyleSheet.create({
  wrapper: {
    borderRadius: 24,
    overflow: "hidden",
  },
  gradient: {
    padding: 20,
    gap: 14,
    position: "relative",
  },
  accentBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderRadius: 24,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  positionCol: {
    gap: 2,
  },
  positionShort: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
  },
  positionFull: {
    color: "#BFC6DE",
    fontSize: 11,
    fontWeight: "600",
  },
  overallCol: {
    alignItems: "center",
    gap: 0,
  },
  overallNumber: {
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 44,
  },
  overallLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  playerName: {
    color: "#F8F0DE",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  statCol: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    color: "#6B7290",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
  },
  statTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  statFill: {
    height: "100%",
    borderRadius: 1.5,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  levelText: {
    color: "#6B7290",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  deviceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deviceBadgeText: {
    color: "#6B7290",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  deltaBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: "rgba(14,17,34,0.9)",
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "800",
  },
});

const shareStyles = StyleSheet.create({
  container: {
    gap: 8,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  hintText: {
    color: "#6B7290",
    fontSize: 12,
    fontWeight: "600",
  },
  hintTextDone: {
    color: "#A9F7B5",
    fontSize: 12,
    fontWeight: "700",
  },
});
