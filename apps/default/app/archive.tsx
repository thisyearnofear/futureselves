import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GameState } from "@/lib/futureself";
import { getLocalDateKey } from "@/lib/futureself";
import {
  MemoryArchiveSection,
  type MemoryArchiveFilter,
  sortMemoryTransmissions,
} from "@/components/memory-archive-section";
import { BottomNav } from "@/components/bottom-nav";
import { styles } from "@/components/futureself-home.styles";
import { useSavedSignalPins } from "@/lib/saved-signal-pins";

export default function ArchiveScreen() {
  const [dateKey] = useState(() => getLocalDateKey());
  const [archiveFilter, setArchiveFilter] = useState<MemoryArchiveFilter>("all");
  const state = useQuery(api.game.getState, { dateKey });
  const { pinnedSignalIds, togglePinnedSignal, isLoaded } = useSavedSignalPins();

  if (state === undefined || !isLoaded) {
    return (
      <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={{ flex: 1 }}>
        <StatusBar style="light" />
        <View style={styles.archiveLoadingState}>
          <Text style={styles.archiveLoadingText}>Opening the archive...</Text>
        </View>
      </LinearGradient>
    );
  }

  const gameState = state as GameState;
  const transmissions = sortMemoryTransmissions(
    gameState.recentTransmissions.filter(
      (transmission) => transmission.id !== gameState.todayTransmission?.id,
    ),
    pinnedSignalIds,
  );
  const pinnedCount = transmissions.filter((transmission) =>
    pinnedSignalIds.includes(transmission.id),
  ).length;

  return (
    <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.archiveScreenContent, { paddingTop: 60 }]}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.archiveHero}>
            <Text style={styles.archiveEyebrow}>Memory archive</Text>
            <Text style={styles.archiveTitle}>Keep the line close.</Text>
            <Text style={styles.archiveBody}>
              Pinned transmissions stay near the surface. Every saved line remains easy to reopen.
            </Text>
            <View style={styles.archiveStatsRow}>
              <View style={styles.archiveStatCard}>
                <Text style={styles.archiveStatValue}>{transmissions.length}</Text>
                <Text style={styles.archiveStatLabel}>saved</Text>
              </View>
              <View style={styles.archiveStatCard}>
                <Text style={styles.archiveStatValue}>{pinnedCount}</Text>
                <Text style={styles.archiveStatLabel}>pinned</Text>
              </View>
            </View>
          </View>

          <MemoryArchiveSection
            expandedByDefault
            filter={archiveFilter}
            onFilterChange={setArchiveFilter}
            onTogglePin={togglePinnedSignal}
            pinnedSignalIds={pinnedSignalIds}
            transmissions={transmissions}
          />
        </ScrollView>
        <BottomNav />
      </SafeAreaView>
    </LinearGradient>
  );
}
