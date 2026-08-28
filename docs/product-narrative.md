# Product narrative & engagement design notes

Working notes on what makes Future Selves distinctive, and the specific
gaps closed in this pass (August 2026). Companion to `docs/shipaton-2026.md`
(monetization) — this doc is about the product itself: story, pacing, virality.

## What's genuinely distinctive (don't touch the bones)

- **Cast-member voice, not chatbot voice.** The AI never role-plays "your
  therapist" generically — it speaks as one of 18 named cast members
  (`future_self`, `shadow`, `the_ceiling`, ...), each with a distinct voice
  direction (`castDirections` in `packages/backend/convex/cast.ts`).
- **Structural accountability.** The transmission prompt (`game.transmission.ts`)
  forces the model to reference yesterday's specific action and whether the
  user followed through. This is a mechanic, not a suggestion — the app
  is built to feel like a relationship, not a feature.
- **Divergence-as-spatial-storytelling.** The constellation warps toward
  "the shadow side" as the timeline divergence score rises
  (`constellation-map.tsx`'s `calculatePositions`). Behavioral drift is a
  visual, narrative event, not a progress bar.
- **Unchosen Selves.** 10 dark-mirror cast members (`the_ceiling`,
  `the_exhausted_winner`, `the_ghost`, ...) representing cautionary
  alternate timelines, inferred from onboarding free text
  (`deriveUnchosenSelves`) and surfaced probabilistically
  (`isUnchosenSelfTriggered` + an 8% roll in `chooseCastMember`). This is
  the sharpest, most novel idea in the app — and, before this pass, the
  least visible one.

## Gaps closed in this pass

### 1. Deep-link landing page behind shares (`app/signal.tsx`)

Before: `handleShare`, `handleShareMilestone`, and `handleShareVoiceUnlock`
(all in `futureself-home.tsx`) already existed and worked — captured a
styled quote card, opened the native share sheet, fell back to Web Share
API / clipboard on web. But every one of them pointed at the bare marketing
URL (`futureself.app`). A stranger who received a shared transmission quote
landed on a generic homepage with zero context for what they'd just read.

After: `buildSignalLink()` (`lib/futureself.ts`) generates a URL encoding
the shared moment itself (cast member, sender name, streak, quote — all in
the URL, no DB lookup, so a recipient without an account is safe to open
it). `app/signal.tsx` renders that moment with a direct CTA into onboarding,
plus a re-share action. Same acquisition shape as the Football Path's
`challenge.tsx`, ported to the flagship ritual.

**Deliberate difference from `challenge.tsx`:** `challenge.tsx` uses a
`futureself://` custom scheme, because its shares are between people who
already have the app. `signal.tsx` uses an `https://futureself.app/signal`
universal-link shape, because its whole purpose is reaching people who
*don't* have the app yet — a custom scheme does nothing on a device without
it installed. **Follow-up not done in this pass:** actually wiring Apple
App Links / Android Digital Asset Links so `futureself.app/signal` opens
the app when it's installed, and falls back to a web landing page when
it's not. Today the link works (it's a valid URL with the right shape)
but nothing on the `futureself.app` domain routes `/signal` anywhere yet.

### 2. Unlock pacing (`packages/backend/convex/cast.ts`)

Before: the only unlock inside week one was `future_best_friend` (day 3),
and it's the least narratively distinctive voice. Everything else —
including all 10 Unchosen Selves — required 10 to 90+ day streaks. Most
users churn before day 14, meaning they never saw the app's best writing.

After:
- `future_best_friend`: day 3 → day 2, steady-choice requirement 2 → 1.
- `future_mentor`: day 7 → day 5, toward-choice requirement 2 → 1.
- **New:** `the_ghost` gets an early `"quiet"` preview state (streak ≥ 4
  and divergence ≥ 2) — well before its real trigger condition (streak ≥ 7
  AND divergence ≥ 4, in `isUnchosenSelfTriggered`) can actually fire a
  transmission for it. This reuses the exact `"quiet"` semantics `shadow`
  already has ("sensed but not fully arrived") and the exact rendering
  `constellation-map.tsx` / `constellation.tsx` already do for that state —
  no new UI, no new celebration. Confirmed the client's unlock-celebration
  logic (`futureself-home.tsx`, the `currentUnlocked` set) only counts
  `lit`/`dim` transitions, so a `"quiet"` glimpse correctly never triggers
  the "has arrived" overlay — it should feel like a whisper, not a
  fanfare, and the existing state model already enforces that distinction
  for free.
- Everything else (employee/customer/child/stranger/alternate, and every
  other Unchosen Self's real trigger condition) is **unchanged** —
  the long, weighty unlocks are still earned through sustained streaks.
  Only the first taste moved earlier.

## Deliberately not changed

- The core prompt architecture, the cast voice directions, the
  divergence/streak formulas themselves (`game.progression.ts`) — the
  writing and mechanics are the asset; this pass only touched *pacing* and
  *distribution* (getting the existing content in front of more users,
  sooner).
- `isUnchosenSelfTriggered`'s actual trigger conditions for all 10 Unchosen
  Selves are unchanged. Only `the_ghost` got a new *preview* state layered
  on top — the real trigger logic (and thus the real first appearance) is
  the same as before.

### 3. "Awakened" premium tier gets a narrative treatment

Before: three surfaces used three different vocabularies for the same
concept — a "PREMIUM" badge in `voicemail-experience.tsx`, "Awakened" in
Settings, transactional SaaS copy ("Thank you for supporting Future
Selves... Manage your subscription") in the paywall section. None of it
connected to the app's own voice/constellation mythology.

**Unifying idea:** Awakened isn't a subscription tier framed as feature
unlocks — it's a voice-state, using the exact vocabulary the constellation
already has (`lit` / `dim` / `quiet` / `locked`). The free tier's credit
system is reframed as voices that go quiet between milestones; Awakened
keeps every voice you've earned permanently lit. Copy changes:

- `voicemail-experience.tsx`: badge `PREMIUM` → `AWAKENED`; "Unlimited
  voicemails" → "Fully awakened — voicemails whenever you need one";
  result badge `Premium`/`Free tier` → `Awakened`/`Free line`; locked-state
  CTA "Or become Awakened now" → "Or wake this voice now" with a new
  subtext ("Awakened voices don't wait for a milestone — they're always
  on the line"). Also fixed its `handleShare` to use `buildSignalLink()`
  instead of the bare marketing URL — same fix as #1 above, this call site
  was missed the first pass.
- `futureself-settings-sheet.tsx`'s Awakened section: replaced transactional
  copy with "Your line stays fully awake" / "Right now, your voices go
  quiet between milestones. Awakened keeps the whole line lit, all the
  time" / "The line is yours to keep."

**Deliberately not touched:** `voicemail.milestones.ts`'s internal
milestone labels ("Cinematic Voicemail," "Voicemail Archive") — confirmed
via grep these are never rendered in any UI, only logged server-side, so
renaming them would be pure churn with zero user-visible effect.

### 4. Landing page's stale QVAC/on-device pitch (`app/landing.tsx`)

Before: the public marketing page led with an "Architecture: Cloud vs
on-device" section (`ArchitectureDiagram`) and a "Network: live" footer
indicator claiming "the installed app runs entirely on your device" and
"No bytes leave the device." This was accurate for the completed Tether
Developers Cup (QVAC track) submission, but is no longer true: RevenueCat
billing sync (this session's work, `docs/shipaton-2026.md`) and Convex
auth/state sync are both always-on cloud dependencies in the real app.
Shipping this claim publicly now would be a false statement, not just a
stale one.

After: removed the architecture section and the "Network: live" indicator
from the landing page entirely. `ArchitectureDiagram`'s own doc comment
updated to explain why it's no longer rendered (kept as a component for
possible internal/technical use, not deleted). The "Sovereign — Stays on
your device" feature card became "Awakened — Keep every earned voice
fully lit," which is accurate and ties into the new premium narrative
from #3 above instead of the retired privacy pitch. The privacy statement
link in the footer stays (Convex data handling is real and still worth
being transparent about) but no longer makes an on-device-only claim.

**Also flagged, not removed:** the three landing-page testimonials
("Day 3," "Day 14," "Day 21" as authors) read as fabricated user quotes —
no real names, generic praise. Added a code comment flagging this
explicitly rather than silently deleting real estate the user might want
to fill with actual quotes. **Action needed before this page goes live for
the Shipaton submission: replace with real user quotes, or remove the
section.**

## Gaps closed in this pass (UI/UX + game design polish, pre-Shipaton launch)

A design pass leaning into well-understood primitives (time-to-value,
loss aversion, visible consequence, curiosity gap, session arc) before the
public release. Each item below names the primitive it uses.

### 1. Football decoupled from the flagship (focus)

Football was the Tether Developers Cup vehicle (done, submitted). The public
product is the ritual. The Football tab is now hidden by default
(`EXPO_PUBLIC_SHOW_FOOTBALL=true` restores it); all routes stay registered so
existing deep links (`futureself://football*`, `/challenge`) still resolve.

### 2. Time-to-magic onboarding (~30s to first transmission)

The first-run flow now asks only what day-one transmissions need: name, city,
scene, arc, miraculous year, the door not being opened, first voice. The
appearance chip grids, age, `afraidWontHappen`, and `draining` were removed
from onboarding — they now live entirely on the post-ritual refinement
surfaces (Settings + the profile sheet, which gained a new "what future do
you almost not let yourself want?" field so no data is lost, just deferred).

### 3. Daily session arc (session design)

New `SessionArc` under the hero makes the three beats (word → voice → answer)
explicit — completed beats fill, the next one glows, so there is always exactly
one obvious next action and the day reads as a mini-story instead of a feed.
The choice section was reframed as a reply to the voice ("How do you answer?"
+ the quoted `actionPrompt`) rather than a generic 4-way menu.

### 4. Divergence as felt consequence + hero band shift

After a choice, `ChoiceLineDelta` renders the line's before/after as seven
segments with the delta ("Divergence −2 · The timeline settles…"). The hero's
top edge tints with the divergence band (gold → amber → bronze → violet) so
the state of the line is visible at a glance. A "Something is pressing closer…"
pill appears on the choice card when divergence ≥ 3.

### 5. Unchosen Selves made legible (curiosity gap)

Locked `the_*` voices on the constellation get a violet "Unchosen self"
treatment; the home's next-unlock card becomes "Approaching: [name]" with a
dark-mirror tease when the next voice is an Unchosen Self. The mechanic is
now visibly a category, not a dice roll.

### 6. Streak health (loss aversion)

After 6pm with today's beat open, an evening banner surfaces "Your line is
holding — one word before midnight keeps it." The daily reminder notification
now carries yesterday's cliffhanger as its copy ("Yesterday's voice left
something unfinished…") — the serialized story is the return hook.

### 7. Word echo + early-state copy

The typed word is echoed back ("Future-you heard: 'brave'.") so the seed feels
heard; the sparse early constellation on the constellation page is explicitly
framed as charting future capacity.

### 8. Streak freeze tokens (loss aversion, automatic)

A passive shield on top of the streak: fresh personas start with 1 token,
and first crossings of day 7 / 30 grant +1 (max 2). When a check-in arrives
after a missed day (the raw streak would reset), a token is consumed instead
and the streak holds — one token covers exactly one missed day; a second
consecutive miss requires a second token (`applyStreakFreeze` in
`game.progression.ts`; consumers in `saveCheckIn`). The consumed freeze is
surfaced in the `RitualState` card on home: "A freeze caught your line today
— N left". No user action required — it is a shield, not a chore. Schema:
`streakFreezeCount` + `streakFrozenDateKey` on `personas` (both optional, so
no migration is needed for existing documents).

### Deferred, not dropped

- A true "repair" action (spending a resource to restore a *broken* streak
  after it already reset) — the freeze covers the common case; the same token
  field would back a repair later.
- Distinguishing between "answered today" in a fresh session vs. an older
  one for the SessionArc's third beat (it currently tracks in-session).

## De-verbose pass (PR #1 + #2, August 2026)

The product's hook is constraint — one word in, one short voice out —
but the execution had become maximalist on every layer. Three PRs cut
−452 lines of chrome and narration to make the execution match the concept.

### Layer 1: Transmission length (`game.transmission.ts`, `local-llm.ts`)

The LLM prompt instructed 80–120 words per transmission. Cut to 40–60
words, with a sparse-register carve-out for The Ghost and The Flatlined
(they may break below 40 — sparse is their character, not an
under-delivery). Cloud and local paths are at parity.

### Layer 2: Prompt architecture (`game.transmission.ts`, `local-llm.ts`)

Removed `buildPatternsBlock` — the choice-pattern meta-commentary
("they keep reaching forward / holding ground / letting go") that turned
transmissions into self-analysis instead of forward narrative. The
choice data still flows through the accountability block; the model just
no longer narrates the system back at the user.

### Layer 3: UI narration collapse (`futureself-home-sections.tsx`,
`futureself-home.styles.ts`, `futureself-home.tsx`, `ritual-state.tsx`)

- Removed the hero promise row ("spoken / serial / personal") — a
  product explainer that should disappear after onboarding.
- Removed the "N voices are close enough to hear you right now" footnote.
- Removed the drift pill ("Something is pressing closer to the line…")
  — the clearest redundant narrator; the constellation already
  visualizes divergence.
- RitualState narrowed: removed the choice-pattern bars (the exact
  meta-commentary already cut from the prompt) and the freeze-shield
  explainer card. Kept streak-risk (loss-aversion) and the consequence
  chain (compound felt-consequence).
- EveningUrgencyBanner kept — it's time-bound and actionable (one word
  before midnight), not static narration.

### Layer 4: Choice surface (`futureself-home-sections.tsx`,
`futureself-home.tsx`)

- Cut per-choice hints ("The brave move. Shifts the timeline fastest.")
  and divergence-impact previews ("settles the line / holds steady /
  softens, invites strangeness"). The felt line-delta visual carries
  the consequence beat without competing text.
- Outcome card trimmed: dropped `stabilityImpact` (redundant with the
  line-delta) and `threadImpact` (repeats the action just taken). Kept
  `summary` + `detail` + `voiceShift` + the line-delta. Backend fields
  left intact — only the UI render lines were removed.

### What this reinforced (the wedge)

The one-way asymmetry is sharper — a short transmission you can't reply
to is the product; a 120-word paragraph invites a reply. The voice no
longer narrates the system. The constellation and line-delta are the
felt consequence, and the serial accountability is the only thing the
voice narrates. See the wedge discussion in conversation context (Paul
Graham / Peter Thiel lens) for the full strategy.

## Moat-deepening pass (PR #3, August 2026)

### Fallback transmission coverage

`fallbackTransmission` (`game.transmission.ts`) and
`localFallbackTransmission` (`local-llm.ts`) previously had specific
hand-written fallbacks for only 3 of 18 cast members (future_partner,
shadow, future_mentor). The other 15 — including all 10 Unchosen Selves
— fell through to a generic "echo from here" that didn't sound like any
of them. The fallbacks fire when the LLM is unavailable (rate limited,
offline, local-mode failure) — exactly when the voice needs to be most
itself.

Added 7 character-specific fallbacks in both paths: future_self,
future_best_friend, the_ghost, the_flatlined, the_ceiling,
the_dissolver. Each uses the 40–60 word budget (Ghost/Flatlined sparse
carve-out) and references `checkInWord`, `avoiding`, and
`reactionEcho`/`mirroredReply` like the originals. The remaining 8
Unchosen Selves still use the generic fallback — same pattern, can
follow.

### Serial accountability depth (the lock-in mechanism)

`buildAccountabilityBlock` now surfaces a `did_it` follow-through from
3–7 days ago, not just yesterday — making the accumulated narrative
visible in the prompt. Streak milestone callbacks at day 7/14/30
instruct the model to reference an early transmission and trace the arc
("on day 3, you said the word was 'threshold' — here's what's changed
since"). This makes day-30 switching cost real: the voice has been
watching the whole arc, not just yesterday. Mirrored into the local
path (required extending `LocalLLMOptions.recentTransmissions` to carry
`actionPrompt` + `responseReaction`).

### Local-path reaction memory parity

`reactionMemoryLead` (4 lines that make the voice acknowledge the user's
last emotional signal — "You told me you actually did it, and that
changes how I get to speak to you now") existed only in the cloud path.
Ported into `local-llm.ts` and wired into the local fallback. On-device
transmissions now have the same serial emotional continuity as cloud
transmissions.

## Open gaps

- App Links / Associated Domains config for `futureself.app` (see above) —
  still needed for `signal.tsx`'s links to actually open the app when installed.
- Consider giving one or two more Unchosen Selves an early `"quiet"`
  glimpse the same way, once the first one's engagement impact can be
  measured (streak-to-day-30 retention, share rate on the glimpse itself).
- The landing page (`app/landing.tsx`) still pitches the shelved QVAC/
  on-device narrative — see the fix in the earlier pass for detail.
- Remaining 8 Unchosen Selves still use the generic fallback — same
  pattern as the 7 now covered, can follow when ready.
- `daysAgo` value in `olderFollowThrough` is the array index (2–6), not
  the actual day count (should be index + 1). Cosmetic — the model reads
  it as "several days ago" either way.
