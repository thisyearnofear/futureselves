/**
 * design-tokens.ts — Shared design system tokens for the entire app.
 *
 * Single source of truth for animation durations, border radii, easing
 * curves, type scale, spacing, and the serif display family. Import from
 * here instead of hardcoding values. Rules live in docs/design.md.
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

// ─── Type scale ──────────────────────────────────────────────────────────────

/**
 * Bundled display family (Instrument Serif, SIL OFL — see assets/fonts/OFL.txt).
 * Loaded once in app/_layout.tsx via expo-font. Always read TYPE.serif from
 * here so the family name stays in sync with the loadFonts() call.
 */
export const TYPE = {
  serif: "InstrumentSerif",
  serifItalic: "InstrumentSerif-Italic",
  /** Hero statements, milestone words. */
  display: { fontSize: 40, lineHeight: 46 } as const,
  /** Section statements, transmission titles. */
  statement: { fontSize: 32, lineHeight: 38 } as const,
  /** Quotes, cliffhangers, whisper lines — what a voice says. */
  quote: { fontSize: 22, lineHeight: 30 } as const,
  /** Large numerals (streak, timers). Pair with tabular-nums. */
  number: { fontSize: 34, lineHeight: 40 } as const,
} as const;

export const FONT_SIZE = {
  /** Screen-level titles when NOT in the display family. */
  title: 28,
  heading: 20,
  /** Default reading size. */
  body: 15,
  caption: 13,
  /** Uppercase section labels. */
  eyebrow: 11,
} as const;

export const LETTER_SPACING = {
  /** Display serif tightens. */
  display: -0.5,
  /** UI titles. */
  title: -0.8,
  /** Uppercase eyebrows breathe out. */
  eyebrow: 2.4,
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const SPACE = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  /** Between editorial sections (no-box rhythm). */
  section: 40,
} as const;

// ─── Hairline + materials ────────────────────────────────────────────────────

/** The one hairline color. Editorial separators only — not card borders. */
export const HAIRLINE = "rgba(255,255,255,0.06)";

/** Gradient stops for the primary button border (the one special material). */
export const PRIMARY_GRADIENT = ["#F7D38B", "#E8B85C", "#F7D38B"] as const;

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
