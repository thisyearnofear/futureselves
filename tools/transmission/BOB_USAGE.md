# IBM Bob Usage Statement

## How IBM Bob 2.0 was used

IBM Bob 2.0 is the **core engine** of this project. The entire audit workflow is a Bob skill (`SKILL.md`) that instructs Bob to use Agent mode, parallel subagents, and document understanding to analyze a real codebase end-to-end.

### Bob as the audit orchestrator

The skill directs Bob to:

1. **Bootstrap with document understanding**: read `.bobignore`, `README.md`, `AGENTS.md`, and `package.json` to model the project before spawning subagents — applying Bob's document understanding to the team's stated beliefs about their own code.

2. **Spawn five parallel subagents** (Agent mode + subagents):
   - **Remote API surface**: grep for `fetch(`, provider SDKs, webhook handlers; classify each call site by provider, gating logic, fallback chain, and PII surface; cross-check against `docs/remote-apis.md` to detect drift.
   - **Backend function health**: read the coding-guidelines file; verify every exported function has auth, validators, index usage, and correct transaction boundaries; detect dead exports and schema drift.
   - **Documentation drift**: extract factual claims (file:line refs, function names, env vars) from top-level docs; verify each against current source.
   - **Test coverage gaps**: inventory test files; for every exported backend function, check whether any test references it.
   - **Security & secrets**: verify `.gitignore` covers sensitive paths; scan for hardcoded secret shapes; flag TODO/FIXME in security-sensitive code.

3. **Synthesize**: deduplicate findings, cap to the 30 highest-severity, sort by severity then file path, write a three-paragraph narrative and a 60–90 second transmission script in the voice of "your codebase six months from now."

4. **Emit structured JSON**: a single document matching `schema/findings.schema.json` that the CLI renders into the viewer.

### Bob as the build partner

Bob also helped **build the tool itself**:

- The CLI (`src/cli.ts`, `src/bob.ts`, `src/render.ts`) was scaffolded and iterated with Bob in Agent mode. Bob read the Future Selves codebase to learn the project conventions (TypeScript, zero-dep tooling, single-file output) and generated the initial implementation.
- The viewer template was refined with Bob's literate coding: inline natural-language comments describing the desired visuals (dark palette, severity color coding, persona voice card) were expanded into working CSS/HTML.
- The fixture data was authored with Bob's help: Bob analyzed Future Selves and produced realistic findings matching the schema, curated into the example fixture.

### Why Bob is essential

- **Full repository context**: the audit reads dozens of files across `convex/`, `apps/`, `docs/`, and config at once. Bob's repo-wide indexing makes this feasible in one session.
- **Parallel subagents**: five independent audits run concurrently instead of sequentially, saving time and Bobcoins within the hackathon window.
- **Document understanding**: the highest-value findings come from verifying the team's *stated beliefs* (in `AGENTS.md` and `docs/remote-apis.md`) against actual source.
- **Agent mode orchestration**: the multi-step workflow (bootstrap → subagents → synthesize → emit) needs an agent that plans, executes, and self-corrects. Bob provides this out of the box.

The skill stays within the 40-Bobcoin budget: five parallel subagents plus one synthesis pass, with explicit instructions to avoid re-running subagents and to prefer fewer high-confidence findings over many speculative ones.

### No watsonx.ai or watsonx Orchestrate used

This submission does not use IBM watsonx.ai or watsonx Orchestrate. The entire workflow runs inside Bob IDE / Bob Shell.
