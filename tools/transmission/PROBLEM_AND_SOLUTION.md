# Problem & Solution Statement

## The problem

Engineering teams lose hours every week to **drift** — the silent divergence between what a codebase *says* it does and what it *actually* does. Documentation references files that moved. Remote-API call sites aren't in the inventory. Dead exports mislead future developers. Auth wrappers are load-bearing but have zero regression tests. Schema fields grow unbounded until they hit storage limits. None of these fail loudly. They compound quietly until someone pays in a production incident, a failed audit, or a new-hire onboarding that takes three weeks instead of three days.

Existing code-health tools are one-shot: run a linter, get a report, file it away. The report is static, the context is lost, nobody reads it twice. There is no **ritual** — no daily practice that keeps the team's mental model in sync with reality.

## The solution

**transmission** is a daily code-health ritual powered by IBM Bob 2.0. It runs Bob against a real codebase with full repository context, spawns five parallel subagents to audit five dimensions (remote-API surface, backend function health, documentation drift, test coverage, security & secrets), and emits a structured findings document. A zero-dependency CLI renders it as a single self-contained HTML "transmission" — readable in 60 seconds, actionable in 10 minutes.

The framing is borrowed from Future Selves, a consumer app where users receive daily voicemails from their future self. Here the "future self" is your codebase six months from now, narrating what will go wrong if today's findings aren't addressed. A transmission persona (for example "The Maintainer") gives the report a voice — specific, concrete, slightly urgent — instead of sterile lint output.

## Target users & interaction

Engineering teams of 2–20 developers maintaining a codebase with real complexity: multiple services, third-party APIs, schema evolution, living docs. The daily ritual: run `transmission analyze <repo>`, open the HTML, read the transmission, fix the top finding. Over time the team builds a streak of clean audits — the same loop that makes Future Selves' personal ritual sticky, applied to code health.

## Why it's creative and unique

1. **Ritual framing**: nobody has applied the "daily transmission from your future self" pattern to code health. It turns a chore into a habit.
2. **Bob as orchestrator, not assistant**: the skill uses Agent mode, parallel subagents, and document understanding to run a multi-step audit — exactly the "manage and improve multiple steps, not just assist with coding" the challenge asks for.
3. **Dogfooding**: the demo runs on Future Selves itself — a real production codebase with 30+ Convex functions, 9 remote APIs across 6 providers, and docs that have genuinely drifted since August 2026. The findings are real, not synthetic.
4. **Zero-dependency output**: the viewer is one HTML file with no external CSS, JS, or network calls. It works offline, in Slack, or attached to a PR.

## How it addresses the issue in a new way

Instead of a one-shot audit producing a static report, transmission produces a **living artifact** the team opens daily. The persona voice makes findings memorable; severity ordering makes the top action obvious; single-file output makes sharing frictionless. The business value is concrete: catch doc drift before it misleads a new hire, catch missing auth tests before a refactor silently breaks them, catch unbounded schema fields before they hit storage limits. Each prevented finding is hours of debugging saved.
