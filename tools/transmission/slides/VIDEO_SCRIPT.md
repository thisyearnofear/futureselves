# Demo Video Script — "transmission" (≤ 3 min, ≥ 90s of solution in action)

Record at 1280×720 or higher. Narrate as you go. Keep it tight — judges watch a lot of these.

---

## ACT 1 — The hook (0:00 – 0:25)

**On screen:** Title card (slide-01.png) or the landing page hero.

**Narration:**
> "Every codebase drifts. Docs stop matching code. Dead exports pile up. The auth wrapper that guards everything has zero tests. Nobody notices — until it costs real hours.
>
> This is transmission. A daily code-health ritual powered by IBM Bob 2.0. Bob reads your entire repo and delivers a voicemail from your codebase's future self — the things that will bite you in six months if you don't fix them today."

---

## ACT 2 — The problem + what makes this different (0:25 – 0:45)

**On screen:** slide-02.png (problem), then slide-03.png (solution flow).

**Narration:**
> "Linters give you a static report you read once. transmission is different: it's a ritual. Run it daily, open one HTML file, read the transmission, fix the top finding. The persona voice makes it memorable. Severity ordering makes the next action obvious."

---

## ACT 3 — Bob at work (0:45 – 1:45) ★ THIS IS THE MONEY SECTION

**On screen:** Bob IDE, open on the Future Selves repo. Run the audit live (or show a recorded run).

**Narration:**
> "Here's Bob doing the real work. I point it at Future Selves — a production codebase with 30+ Convex functions and 9 remote APIs across 6 providers.
>
> The audit is a reusable Bob skill. Bob reads the team's own documentation — AGENTS.md, remote-apis.md — as source of truth. Then it spawns five subagents in parallel: remote API surface, backend health, doc drift, test gaps, and security. Agent mode orchestrates the whole thing. Document understanding verifies what the docs *claim* against what the code *does*."

**Show:** the subagents running in Bob's task view, then the JSON output appearing.

> "Bob finishes and emits one structured JSON document — findings with severity, file, line, and a suggested fix."

---

## ACT 4 — The transmission renders (1:45 – 2:25)

**On screen:** Terminal running `bun src/cli.ts render findings.json`, then the HTML output opening. Scroll through it.

**Narration:**
> "The CLI renders that JSON into a single self-contained HTML file. No dependencies, no network calls — it works offline, in Slack, on a PR.
>
> Look at what it actually found on Future Selves — this run scanned 523 files. Two high-severity items: the remote-API inventory doc is stale — 19 source files changed since it was last audited — and 16 of 32 backend modules have no test referencing them. Medium: a deprecated schema field that was never migrated. And an info-level note showing the secret scanner correctly classifies a git-ignored local credential instead of crying wolf. These are real findings from a real codebase — produced live, not synthetic."

**Show:** scroll the transmission, hover the findings, show the persona script.

---

## ACT 5 — Close (2:25 – 2:50)

**On screen:** slide-06.png (business value), then the GitHub repo + live demo URL.

**Narration:**
> "transmission turns code health from a chore into a habit. Faster onboarding, fewer incidents, and a daily ritual your team actually opens. Built in 48 hours with IBM Bob 2.0 doing the heavy lifting — five subagents, one synthesis pass, well under the Bobcoin budget.
>
> transmission — your codebase, talking back."

---

## Recording checklist

- [ ] Bob IDE signed into hackathon account (ibm-coding-challenge-uat, us-east)
- [ ] Future Selves repo open in Bob IDE
- [ ] Audit skill runs live (or pre-recorded run ready)
- [ ] Terminal visible for the `render` step
- [ ] HTML output opens in browser, scrollable
- [ ] Narration recorded (clean audio, no background noise)
- [ ] Total runtime ≤ 3:00, solution-in-action ≥ 1:30
- [ ] Bob task session summary screenshots captured → bob_sessions/
