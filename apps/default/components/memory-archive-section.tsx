import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import type { TransmissionState } from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";
import { useRelatedSignals } from "@/hooks/use-related-signals";
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
  // Stable toggle handler for the row component. Without useCallback the row's
  // React.memo is defeated by a new function on every render of the parent.
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);
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
      ? "Transmissions you chose to keep in reach."
      : filter === "recent"
        ? "Recent lines that have not been pinned yet."
        : "The line remembers what it already said. Reopen a transmission, or pin one that should stay close.";

  return (
    <Animated.View entering={FadeInUp.duration(260)} style={styles.memoryCard}>
      <View style={styles.memoryHeaderRow}>
        <View style={styles.memoryHeader}>
          <View style={styles.memoryBadge}>
            <Ionicons name="bookmark-outline" size={15} color="#F7D38B" />
          </View>
          <View style={styles.memoryCopy}>
            <Text style={styles.sectionTitle}>Archive</Text>
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
            {filter === "pinned" ? "No pinned transmissions yet." : "No unpinned transmissions right now."}
          </Text>
          <Text style={styles.memoryEmptyBody}>
            {filter === "pinned"
              ? "Bookmark a transmission to keep it near the top of your archive."
              : "Pinned transmissions stay close. New arrivals will appear here as the line grows."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransmissions}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <MemoryArchiveItem
              transmission={item}
              index={index}
              isPinned={pinnedSet.has(item.id)}
              isExpanded={expandedId === item.id}
              onTogglePin={onTogglePin}
              onToggleExpand={handleToggleExpand}
              allTransmissions={filteredTransmissions}
            />
          )}
          // scrollEnabled={false} because the parent ScrollView in app/archive.tsx
          // and the home page controls scrolling. FlatList here just virtualizes
          // row rendering so a 90-day archive doesn't mount every row up front.
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          // Perf tuning: cap initial render, keep a small render window.
          // The home view shows ~5–10 rows; the archive page can hit 90+.
          initialNumToRender={6}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </Animated.View>
  );
}

interface MemoryArchiveItemProps {
  transmission: TransmissionState;
  index: number;
  isPinned: boolean;
  isExpanded: boolean;
  onTogglePin: (id: string) => void;
  onToggleExpand: (id: string) => void;
  allTransmissions: Array<TransmissionState>;
}

// Memoized so a single row doesn't re-render when a sibling row expands or when
// the user pins a different item. The row only re-renders when its own props
// (isPinned, isExpanded, transmission reference) actually change.
const MemoryArchiveItem = React.memo(function MemoryArchiveItem({
  transmission,
  index,
  isPinned,
  isExpanded,
  onTogglePin,
  onToggleExpand,
  allTransmissions,
}: MemoryArchiveItemProps) {
  return (
    <View
      style={[
        styles.memoryItem,
        isPinned && styles.memoryItemPinned,
        isExpanded && styles.memoryItemExpanded,
      ]}
    >
      <View style={styles.memoryMetaRow}>
        <View style={styles.memoryLabelRow}>
          <Text style={styles.memoryIndex}>
            {isPinned ? "Pinned" : "Transmission"} {String(index + 1).padStart(2, "0")}
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
        onPress={() => onToggleExpand(transmission.id)}
        style={styles.memoryPressArea}
      >
        <Text numberOfLines={isExpanded ? undefined : 2} style={styles.memoryBody}>
          {transmission.cliffhanger}
        </Text>
        <Text style={styles.memoryExpandHint}>
          {isExpanded ? "Tap to close." : "Tap to reopen."}
        </Text>
        {isExpanded ? (
          <View style={styles.memoryExpandedContent}>
            <Text style={styles.memoryExcerpt}>{getMemoryExcerpt(transmission.text)}</Text>
            <View style={styles.memoryActionRow}>
              <Ionicons name="arrow-forward-outline" size={14} color="#F7D38B" />
              <Text style={styles.memoryAction}>{transmission.actionPrompt}</Text>
            </View>
            <RelatedSignalsList
              sourceTransmission={transmission}
              allTransmissions={allTransmissions}
            />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
});

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

// ─── Related Signals (QVAC embeddings) ───────────────────────────────────────

interface RelatedSignalsListProps {
  sourceTransmission: TransmissionState;
  allTransmissions: Array<TransmissionState>;
}

function RelatedSignalsList({ sourceTransmission, allTransmissions }: RelatedSignalsListProps) {
  const { related, isComputing } = useRelatedSignals(sourceTransmission, allTransmissions, 3);

  if (isComputing) {
    return (
      <View style={styles.relatedContainer}>
        <View style={styles.relatedHeader}>
          <Ionicons name="git-network-outline" size={12} color="#A0B4D0" />
          <Text style={styles.relatedHeaderText}>Finding similar signals...</Text>
        </View>
      </View>
    );
  }

  if (related.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.relatedContainer}>
      <View style={styles.relatedHeader}>
        <Ionicons name="git-network-outline" size={12} color="#A0B4D0" />
        <Text style={styles.relatedHeaderText}>
          {related.length} similar signal{related.length !== 1 ? "s" : ""} in the line
        </Text>
      </View>
      <View style={styles.relatedList}>
        {related.map(({ transmission, similarity }) => (
          <Pressable
            key={transmission.id}
            onPress={() => {
              // Scroll to the related transmission by simulating expand
              // (parent doesn't expose this; tap reveals awareness)
            }}
            style={({ pressed }) => [styles.relatedItem, pressed && styles.pressed]}
          >
            <View style={styles.relatedBar}>
              <View
                style={[
                  styles.relatedBarFill,
                  { width: `${Math.round(similarity * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.relatedContent}>
              <Text style={styles.relatedVoice}>
                {formatCastMember(transmission.castMember)}
              </Text>
              <Text numberOfLines={1} style={styles.relatedTitle}>
                {transmission.title}
              </Text>
            </View>
            <View style={styles.relatedSimilarityBadge}>
              <Text style={styles.relatedSimilarityText}>
                {Math.round(similarity * 100)}%
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}
