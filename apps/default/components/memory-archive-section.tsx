import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { TransmissionState } from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";
import { styles } from "@/components/futureself-home.styles";

export type MemoryArchiveFilter = "all" | "pinned" | "recent";

interface MemoryArchiveSectionProps {
  transmissions: Array<TransmissionState>;
  pinnedSignalIds: Array<string>;
  onTogglePin: (signalId: string) => void;
  filter: MemoryArchiveFilter;
  onFilterChange: (filter: MemoryArchiveFilter) => void;
  showHeaderCta?: boolean;
  onOpenArchive?: () => void;
  expandedByDefault?: boolean;
}

const memoryFilters: Array<{
  key: MemoryArchiveFilter;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "pinned", label: "Pinned" },
  { key: "recent", label: "Recent" },
];

export function MemoryArchiveSection({
  transmissions,
  pinnedSignalIds,
  onTogglePin,
  filter,
  onFilterChange,
  showHeaderCta = false,
  onOpenArchive,
  expandedByDefault = false,
}: MemoryArchiveSectionProps) {
  if (transmissions.length === 0) return null;

  const [expandedId, setExpandedId] = useState<string | null>(
    expandedByDefault ? transmissions[0]?.id ?? null : null,
  );
  const pinnedSet = useMemo(() => new Set(pinnedSignalIds), [pinnedSignalIds]);
  const pinnedCount = transmissions.filter((transmission) => pinnedSet.has(transmission.id)).length;
  const recentOnly = transmissions.filter((transmission) => !pinnedSet.has(transmission.id));

  const filteredTransmissions = transmissions.filter((transmission) => {
    if (filter === "pinned") return pinnedSet.has(transmission.id);
    if (filter === "recent") return !pinnedSet.has(transmission.id);
    return true;
  });

  const headerCopy =
    filter === "pinned"
      ? "Signals you chose to keep in reach."
      : filter === "recent"
        ? "Recent lines that have not been pinned yet."
        : "The line remembers what it already said. Reopen a signal, or pin one that should stay close.";

  return (
    <Animated.View entering={FadeInUp.duration(260)} style={styles.memoryCard}>
      <View style={styles.memoryHeaderRow}>
        <View style={styles.memoryHeader}>
          <View style={styles.memoryBadge}>
            <Ionicons name="bookmark-outline" size={15} color="#F7D38B" />
          </View>
          <View style={styles.memoryCopy}>
            <Text style={styles.sectionTitle}>Signal archive</Text>
            <Text style={styles.sectionCopy}>{headerCopy}</Text>
          </View>
        </View>
        {showHeaderCta && onOpenArchive ? (
          <Pressable
            onPress={onOpenArchive}
            style={({ pressed }) => [styles.memoryArchiveButton, pressed && styles.pressed]}
          >
            <Text style={styles.memoryArchiveButtonText}>Open archive</Text>
            <Ionicons name="arrow-forward-outline" size={15} color="#F7D38B" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.memorySummaryRow}>
        <View style={styles.memorySummaryPill}>
          <Ionicons name="bookmark" size={13} color="#F7D38B" />
          <Text style={styles.memorySummaryText}>
            {pinnedCount} pinned
          </Text>
        </View>
        <View style={styles.memorySummaryPillMuted}>
          <Ionicons name="time-outline" size={13} color="#AEB6D4" />
          <Text style={styles.memorySummaryTextMuted}>{recentOnly.length} recent</Text>
        </View>
      </View>

      <View style={styles.memoryFilterRow}>
        {memoryFilters.map((memoryFilter) => {
          const active = memoryFilter.key === filter;
          return (
            <Pressable
              key={memoryFilter.key}
              onPress={() => onFilterChange(memoryFilter.key)}
              style={({ pressed }) => [
                styles.memoryFilterChip,
                active && styles.memoryFilterChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.memoryFilterText,
                  active && styles.memoryFilterTextActive,
                ]}
              >
                {memoryFilter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filteredTransmissions.length === 0 ? (
        <View style={styles.memoryEmptyState}>
          <Ionicons name="sparkles-outline" size={18} color="#8F96B4" />
          <Text style={styles.memoryEmptyTitle}>
            {filter === "pinned" ? "No pinned signals yet." : "No unpinned signals right now."}
          </Text>
          <Text style={styles.memoryEmptyBody}>
            {filter === "pinned"
              ? "Bookmark a signal to keep it near the top of your archive."
              : "Pinned signals stay close. New arrivals will appear here as the line grows."}
          </Text>
        </View>
      ) : (
        <View style={styles.memoryList}>
          {filteredTransmissions.map((transmission, index) => {
            const isPinned = pinnedSet.has(transmission.id);
            const isExpanded = expandedId === transmission.id;

            return (
              <View
                key={transmission.id}
                style={[
                  styles.memoryItem,
                  isPinned && styles.memoryItemPinned,
                  isExpanded && styles.memoryItemExpanded,
                ]}
              >
                <View style={styles.memoryMetaRow}>
                  <View style={styles.memoryLabelRow}>
                    <Text style={styles.memoryIndex}>
                      {isPinned ? "Pinned" : "Signal"} {String(index + 1).padStart(2, "0")}
                    </Text>
                    {isPinned ? (
                      <View style={styles.memoryPinnedBadge}>
                        <Ionicons name="bookmark" size={11} color="#101320" />
                        <Text style={styles.memoryPinnedBadgeText}>close</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.memoryMetaRight}>
                    <Text style={styles.memoryDate}>{formatDateKey(transmission.dateKey)}</Text>
                    <Ionicons
                      name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                      size={16}
                      color="#8F96B4"
                    />
                  </View>
                </View>
                <View style={styles.memoryTitleRow}>
                  <View style={styles.memoryTitleCopy}>
                    <Text style={styles.memoryVoice}>{formatCastMember(transmission.castMember)}</Text>
                    <Text style={styles.memoryTitle}>{transmission.title}</Text>
                  </View>
                  <Pressable
                    onPress={() => onTogglePin(transmission.id)}
                    style={({ pressed }) => [
                      styles.memoryPinButton,
                      isPinned && styles.memoryPinButtonPinned,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={isPinned ? "bookmark" : "bookmark-outline"}
                      size={15}
                      color={isPinned ? "#101320" : "#F7D38B"}
                    />
                  </Pressable>
                </View>
                <Pressable
                  onPress={() =>
                    setExpandedId((current) =>
                      current === transmission.id ? null : transmission.id,
                    )
                  }
                  style={styles.memoryPressArea}
                >
                  <Text numberOfLines={isExpanded ? undefined : 2} style={styles.memoryBody}>
                    {transmission.cliffhanger}
                  </Text>
                  <Text style={styles.memoryExpandHint}>
                    {isExpanded ? "Tap to close the signal." : "Tap to reopen the signal."}
                  </Text>
                  {isExpanded ? (
                    <View style={styles.memoryExpandedContent}>
                      <Text style={styles.memoryExcerpt}>{getMemoryExcerpt(transmission.text)}</Text>
                      <View style={styles.memoryActionRow}>
                        <Ionicons name="arrow-forward-outline" size={14} color="#F7D38B" />
                        <Text style={styles.memoryAction}>{transmission.actionPrompt}</Text>
                      </View>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

export function sortMemoryTransmissions(
  transmissions: Array<TransmissionState>,
  pinnedSignalIds: Array<string>,
) {
  const pinnedSet = new Set(pinnedSignalIds);
  return [...transmissions].sort((left, right) => {
    const leftPinned = pinnedSet.has(left.id);
    const rightPinned = pinnedSet.has(right.id);
    if (leftPinned === rightPinned) return right.createdAt - left.createdAt;
    return leftPinned ? -1 : 1;
  });
}

function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  const date = new Date(`${year}-${month}-${day}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getMemoryExcerpt(text: string) {
  if (text.length <= 220) return text;
  return `${text.slice(0, 217).trimEnd()}...`;
}
