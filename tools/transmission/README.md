# transmission

**Daily code-health ritual powered by IBM Bob 2.0.**

A CLI + self-contained HTML viewer that runs IBM Bob against a real codebase and renders the audit as a "transmission from your codebase's future self" — a daily report of findings that will hurt you in six months if you don't fix them today.

Built for the [IBM Bob 2.0 Hackathon](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon) (lablab.ai, Sept 25–27 2026) using the [Future Selves](https://github.com/thisyearnofear/futureselves) codebase as the live demo target.

---

## What problem does this solve?

Engineering teams lose hours to **drift** — docs that no longer match code, dead exports that mislead future devs, missing auth regression tests, unbounded schema fields, and remote-API call sites that aren't in the inventory. These issues compound silently. By the time someone notices, the fix is expensive and the context is lost.

Most code-health tools are one-shot audits (run a linter, get a report, forget it). **transmission** reframes code health as a **daily ritual**: Bob analyzes the repo with full repository context, spawns parallel subagents to audit five dimensions (remote APIs, backend function health, documentation drift, test coverage, security), and emits a structured findings document. The CLI renders it as a single-file HTML "transmission" — readable in 60 seconds, actionable in 10 minutes.

The ritual framing is borrowed from [Future Selves](https://github.com/thisyearnofear/futureselves), a consumer app where users receive daily voicemails from their future self. Here, the "future self" is your codebase six months from now, narrating what will go wrong.

---

## Quick start

```bash
# From the tools/transmission/ directory

# 1. Render the example fixture (no Bob required)
bun src/cli.ts render fixtures/findings.example.json --out dist/example.html
open dist/example.html

# 2. Run the deterministic baseline audit on any repo (no Bob required)
bun src/cli.ts analyze /path/to/some-repo --static

# 3. Initialize a target repo for the full Bob skill audit
bun src/cli.ts init /path/to/some-repo

# 4. Run the Bob-driven audit end-to-end (requires Bob Shell on PATH)
bun src/cli.ts analyze /path/to/some-repo

# 5. Or run the audit in Bob IDE, paste the JSON output, then render
bun src/cli.ts render findings.json --out transmission.html
```

The CLI has **zero npm dependencies**. It reads, parses, validates, and renders. That's it.

---

## Two audit passes

**Pass 1 — Static baseline (`--static`, no Bob needed).** A deterministic, dependency-free pass that applies targeted heuristics: backend test-coverage ratio, deprecated schema fields, documentation staleness vs recent source changes, broken doc references, secret hygiene (git-tracked vs git-ignored), and unbounded array fields. It proves the pipeline end-to-end and produces real findings on any repo today.

**Pass 2 — IBM Bob skill pass (default when Bob Shell is on PATH).** The deep audit defined in `SKILL.md` — Bob reads the team's stated beliefs with document understanding, spawns five parallel subagents in Agent mode, and writes the narrative-grade transmission. This is the hackathon showcase.

`analyze` picks the Bob pass automatically when Bob Shell is available and falls back to the static baseline otherwise.

---

## Commands

| Command | Description |
|---|---|
| `transmission render <findings.json>` | Render a findings JSON into a single-file HTML transmission |
| `transmission init <repo-path>` | Copy `SKILL.md` + `.bobignore` into the target repo |
| `transmission analyze <repo-path>` | Full audit: Bob skill pass when Bob Shell is available, static baseline otherwise |
| `transmission analyze <repo-path> --static` | Force the deterministic baseline audit (no Bob needed) |
| `transmission analyze <repo-path> --bob` | Force the Bob Shell skill pass (errors if Bob is absent) |
| `transmission schema` | Print the JSON schema for the findings document |
| `transmission --help` | Show usage |

---

## How Bob is used

The audit is defined in [`SKILL.md`](./SKILL.md) — a reusable Bob skill that instructs Bob to:

1. **Bootstrap**: read `.bobignore`, `README.md`, `AGENTS.md`, `package.json` to understand the project shape.
2. **Spawn five parallel subagents** (Agent mode):
   - **Subagent A — Remote API surface**: grep for `fetch(`, provider SDKs, webhook handlers; verify gating logic, fallback chains, PII surface; cross-check against `docs/remote-apis.md`.
   - **Subagent B — Backend function health**: verify auth, validators, index usage, transaction boundaries; detect dead exports and schema drift.
   - **Subagent C — Documentation drift**: extract factual claims from docs; verify against current source.
   - **Subagent D — Test coverage gaps**: identify high-value functions with no tests.
   - **Subagent E — Security & secrets**: check `.gitignore`, scan for hardcoded secrets, flag TODO/FIXME in security paths.
3. **Synthesize**: deduplicate, cap to 30 findings, sort by severity, write the narrative + transmission script.
4. **Emit JSON**: a single structured document matching [`schema/findings.schema.json`](./schema/findings.schema.json).

Bob's **document understanding** reads the team's stated beliefs (AGENTS.md, remote-apis.md) and verifies them against source. Bob's **parallel subagents** minimize Bobcoin usage by running independent audits concurrently. Bob's **Agent mode** orchestrates the multi-step workflow end-to-end.

---

## Output format

The findings JSON has this shape (see [`schema/findings.schema.json`](./schema/findings.schema.json) for the full schema):

```json
{
  "dateKey": "2026-09-26",
  "repository": "futureselves",
  "headline": "One-line summary",
  "narrative": "Three-paragraph executive summary",
  "transmission": {
    "persona": "The Maintainer",
    "script": "Hey. It's you, six months from now..."
  },
  "findings": [
    {
      "id": "DOC-001",
      "severity": "high",
      "category": "docs",
      "title": "...",
      "detail": "...",
      "file": "docs/remote-apis.md",
      "line": 124,
      "fix": "..."
    }
  ],
  "stats": { "filesScanned": 47, "findingsTotal": 10, "bySeverity": {...}, "byCategory": {...} }
}
```

The viewer renders this as a single self-contained HTML file (no external CSS/JS, no network calls). Drop it into Slack, attach it to a PR, open it from disk — it works the same.

---

## Repo layout

```
tools/transmission/
├── README.md                    # this file
├── SKILL.md                     # the Bob skill definition (the heart of the demo)
├── package.json                 # zero-dep CLI
├── tsconfig.json
├── .bobignore                   # what Bob should skip
├── PROBLEM_AND_SOLUTION.md      # 500-word problem & solution statement
├── BOB_USAGE.md                 # 500-word IBM Bob usage statement
├── cover.png                    # cover image for the submission
├── deploy.sh                    # one-shot GitHub Pages deploy of demo/
├── schema/
│   └── findings.schema.json     # JSON schema for the findings document
├── fixtures/
│   └── findings.example.json    # example findings (for testing the viewer)
├── src/
│   ├── cli.ts                   # CLI entry point
│   ├── bob.ts                   # Bob Shell wrapper
│   ├── static-audit.ts          # deterministic baseline audit (no Bob needed)
│   └── render.ts                # findings JSON → single-file HTML
├── bin/
│   └── transmission.mjs         # convenience wrapper
├── demo/                        # GitHub Pages site (landing + live viewer + slides)
├── dist/                        # rendered output (gitignored)
├── bob_sessions/                # Bob IDE task session screenshots (submission deliverable)
└── slides/                      # slide deck (HTML source + PNGs) + VIDEO_SCRIPT.md
```

---

## Recording Bob session screenshots (submission deliverable)

The hackathon requires **Bob IDE task session summary screenshots** from each team member, saved in `bob_sessions/`.

1. Open the target repo in Bob IDE.
2. Run the audit skill (paste the prompt from `transmission init`).
3. In Bob IDE's chat interface, select **Tasks** → pick the task → select the task header.
4. A **task session consumption summary** will display. Screenshot it (PNG preferred).
5. Save to `bob_sessions/` with a clear name: `teamname_task01_audit_summary.png`.

Repeat for every task related to the submission.

---

## License

MIT — same as the parent [Future Selves](https://github.com/thisyearnofear/futureselves) repo.

---

## Acknowledgements

Built for the IBM Bob 2.0 Hackathon (lablab.ai, Sept 25–27 2026) using the Future Selves codebase as the live demo target. The "transmission from your future self" framing is borrowed from Future Selves' core product concept.
