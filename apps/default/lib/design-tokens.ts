/**
 * design-tokens.ts — Shared design system tokens for the entire app.
 *
 * Single source of truth for animation durations, border radii, and
 * easing curves. Import from here instead of hardcoding values.
 *
 * Based on Emil Kowalski's design engineering principles:
 * - UI animations under 300ms with custom easing (not built-in CSS easings)
 * - Press feedback: scale(0.97) at 150ms ease-out
 * - Enter animations: ease-out (starts fast, feels responsive)
 * - On-screen movement: ease-in-out (natural acceleration/deceleration)
 * - Decorative/ambient motion: can exceed 300ms
 */

// ─── Animation durations ─────────────────────────────────────────────────────

export const DURATION = {
  /** Button press feedback, icon swaps. Instant feel. */
  press: 150,
  /** Tooltips, small popovers, chip transitions. */
  fast: 200,
  /** Dropdowns, selects, standard enter animations. */
  normal: 280,
  /** Modals, drawers, larger card transitions. */
  slow: 400,
  /** Decorative/ambient only (constellation glow, mic pulse). */
  ambient: 1200,
} as const;

// ─── Border radii ────────────────────────────────────────────────────────────

export const RADIUS = {
  /** Small chips, badges, pills. */
  chip: 14,
  /** Small cards, inner elements. */
  cardSmall: 20,
  /** Standard cards, transmission cards, drill cards. */
  card: 24,
  /** Hero cards, feature cards, share cards. */
  cardLarge: 28,
  /** Full pill / capsule buttons. */
  pill: 999,
} as const;

// ─── Easing curves (Reanimated-compatible) ───────────────────────────────────
//
// Built-in easings are too weak. These custom curves give animations
// the punch that makes them feel intentional.
// Reanimated Easing objects are constructed at call sites, not here,
// to avoid importing Reanimated in this pure-constants file.

import { Easing } from "react-native-reanimated";

export const EASE = {
  /** Strong ease-out for enter animations and press feedback. */
  out: Easing.bezier(0.23, 1, 0.32, 1),
  /** Strong ease-in-out for on-screen movement. */
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  /** iOS-like drawer/sheet curve. */
  drawer: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

// ─── Press feedback scale ────────────────────────────────────────────────────

/** The scale to apply on press for any pressable element. */
export const PRESS_SCALE = 0.97;

// ─── Colors (shared across all surfaces) ─────────────────────────────────────

export const COLORS = {
  /** Primary gold accent. */
  gold: "#F7D38B",
  /** Cream text on dark backgrounds. */
  cream: "#F8F0DE",
  /** Muted blue-gray text. */
  muted: "#BFC6DE",
  /** Subtle gray for labels, hints. */
  subtle: "#6B7290",
  /** Dark navy card background (use with opacity). */
  cardBg: "rgba(14,17,34,0.84)",
  /** Darker navy card background for nested elements. */
  cardBgSubtle: "rgba(14,17,34,0.6)",
  /** Error red. */
  error: "#FF9A9A",
  /** Success green. */
  success: "#A9F7B5",
  /** Gold border with low opacity. */
  goldBorder: "rgba(247,211,139,0.2)",
  /** Gold background tint. */
  goldTint: "rgba(247,211,139,0.08)",
} as const;
