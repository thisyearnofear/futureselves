# Future Selves — Design Stylecard

> Process rule (from MengTo's method): **specs beat vibes, references beat paragraphs,
> change 1–2 things only per pass.** This file is the spec. Any visual change should
> be expressible as a diff against a rule in here. If a rule is missing, add it here
> *before* changing code.

## Positioning

An intimate daily ritual, not a dashboard. The feel target is **"a letter that arrived
at night"**: editorial calm, one living scene, typography that speaks, motion that
rewards attention — and silence everywhere else.

Anti-patterns we are deliberately moving away from (the "generic AI app" read):

- Dark card + faint white border + rounded corners, repeated down the page
- `fontWeight: "900"` on everything (loudness as hierarchy)
- Five independent ambient loops running at once
- Every CTA as the same gold pill

## Type

Two voices, like two people:

| Role | Face | Size/Line | Weight | Where |
|---|---|---|---|---|
| **Display** | Instrument Serif (bundled, OFL) | 40/46 (hero), 32/38 (statement) | 400 | Hero statements, transmission titles, milestone words |
| **Display italic** | Instrument Serif Italic | 22/30 | 400 | Quotes, cliffhangers, whisper lines, the north-star badge |
| **UI** | System (SF/Roboto) | see scale below | 600–700 max | All controls, labels, lists, numbers |
| **Eyebrow** | System | 11/14, uppercase, tracking 2.4 | 700 | Section labels above content |

Scale (UI): display 40 · title 28 · heading 20 · body 15 · caption 13 · eyebrow 11.
Numbers that update (streak, timers) use `fontVariant: ["tabular-nums"]`.
Rules: never `fontWeight: "900"`; never system-font hero text; italic serif is for
things a *voice* says, bold UI is for things the *system* says. That distinction is
the app's whole personality model.

## Composition

- Boxes are **semantic**, not decorative: a container exists because the thing inside
  is an object (the transmission, an input, a sheet). Sections that are *states or
  facts* (session arc, stats, prompts) get: eyebrow label + hairline separator +
  whitespace. No border, no background.
- Hairline: `rgba(255,255,255,0.06)`, exactly one style, full-width.
- One accent per screen-view. Gold is the only structural accent; pastels only carry
  meaning (choice colors), never decoration.

## Materials

- Card: `COLORS.cardBg` + hairline, radius from `RADIUS` — for semantic objects only.
- Primary button: gradient border (gold → warm amber) with a specular sweep on press.
  This is the only "special material"; nothing else gets gradients.
- Atmosphere: two slow aurora layers behind content (`AtmosphereBackground`), tinted
  by divergence band. Never animated faster than 8s per cycle.

## Motion budget

One living scene per screen (the constellation sky on Today), plus entrance
choreography. Everything else is static.

- Entrance: `DURATION.normal/slow` with `EASE.out`, staggered by role (see below).
- Ambient loops allowed: constellation glows, aurora drift, audio waveform (only
  while playing). Everything else (dot pulses, breathing auras, idle halos, drifts)
  is **removed**, not tuned.
- Transmission reveal: staggered word entrance, 24ms/word, ~260ms per word, capped
  ~800ms total impression. No typewriter (reads as slow, hides length).
- Numbers count up once (700ms). Never pulse.
- `useReduceMotion()` gates all of the above: reduced-motion users get final states.

## Tokens

`apps/default/lib/design-tokens.ts` is the only source for colors, radii, durations,
easing, type scale. New styles must import from it; no new `rgba(255,255,255,…)`
literals in components.

## Iteration protocol (from MengTo/Skills)

1. Name the treatment (e.g. "eyebrow sections", "specular primary").
2. Apply to **one surface** end-to-end, capture before/after screenshots.
3. Variants over rerolls: 2–3 options of one section, pick one.
4. Update this file when a new rule is ratified. Rules die here, not in code.