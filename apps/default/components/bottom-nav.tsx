/**
 * bottom-nav.tsx
 *
 * Bottom tab bar for the main app screens.
 * Uses expo-router's router.push for navigation.
 * Matches the dark + gold design language.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from "react-native-reanimated";
import { useEffect } from "react";

interface TabConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  href: string;
}

const TABS: Array<TabConfig> = [
  {
    label: "Today",
    icon: "radio-outline",
    iconActive: "radio",
    href: "/",
  },
  {
    label: "Football",
    icon: "football-outline",
    iconActive: "football",
    href: "/football",
  },
  {
    label: "Voices",
    icon: "star-outline",
    iconActive: "star",
    href: "/constellation",
  },
  {
    label: "Archive",
    icon: "library-outline",
    iconActive: "library",
    href: "/archive",
  },
] /*
 * Football Path was the Tether Developers Cup hackathon vehicle (submitted,
 * complete). The flagship product for the public release is the ritual
 * itself, so the Football tab is hidden by default to keep the nav focused
 * on one clear job. Set EXPO_PUBLIC_SHOW_FOOTBALL=true to bring the
 * experiment back. The routes (/football, /football-drill, /challenge)
 * remain registered, so existing deep links still resolve without crashing.
 */;

const SHOW_FOOTBALL = process.env.EXPO_PUBLIC_SHOW_FOOTBALL === "true";

const VISIBLE_TABS: Array<TabConfig> = SHOW_FOOTBALL
  ? TABS
  : TABS.filter((tab) => tab.href !== "/football");

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {VISIBLE_TABS.map((tab) => {
          const isActive =
            (tab.href === "/" && (pathname === "/" || pathname === "")) ||
            (tab.href !== "/" && pathname.startsWith(tab.href));

          return (
            <TabButton
              key={tab.href}
              tab={tab}
              isActive={isActive}
              onPress={() => router.push(tab.href as any)}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabButtonProps {
  tab: TabConfig;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ tab, isActive, onPress }: TabButtonProps) {
  const iconScale = useSharedValue(1);
  useEffect(() => {
    iconScale.value = withTiming(isActive ? 1.15 : 1, { duration: 200 });
  }, [isActive, iconScale]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={isActive ? tab.iconActive : tab.icon}
          size={22}
          color={isActive ? "#F7D38B" : "#6F7591"}
        />
      </Animated.View>
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
        {tab.label}
      </Text>
      {isActive ? <View style={styles.activeIndicator} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 0,
  },
  tabBar: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
    backgroundColor: "rgba(8,10,23,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(247,211,139,0.1)",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
    borderRadius: 14,
    position: "relative",
  },
  tabLabel: {
    color: "#6F7591",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: "#F7D38B",
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#F7D38B",
  },
  pressed: {
    opacity: 0.7,
  },
});
