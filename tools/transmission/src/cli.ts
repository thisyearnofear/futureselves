#!/usr/bin/env node
/**
 * transmission CLI
 *
 * Subcommands:
 *   transmission render <findings.json> [--out <file>]   Render a findings JSON into a single-file HTML transmission.
 *   transmission init <repo-path>                        Copy SKILL.md and .bobignore into the target repo so Bob can run the audit.
 *   transmission analyze <repo-path> [--out <dir>]       Drive Bob Shell (non-interactive) against the target repo, save findings, render HTML.
 *   transmission schema                                  Print the JSON schema for the findings document.
 *   transmission --help                                   Show this help.
 *
 * Modes of use:
 *   (a) You already have a findings JSON (from Bob IDE, Bob Shell, or any source) → use `render`.
 *   (b) You have Bob Shell installed and want the CLI to drive the audit → use `analyze`.
 *   (c) You're using Bob IDE and want the CLI to do the rendering half → use `render` after pasting Bob's JSON output.
 *
 * The CLI deliberately has zero npm dependencies. It reads, parses, and renders. That's it.
 */

import { renderFindings, validateFindings, type Findings } from "./render.js";
import { ensureSkillInstalled, invokeBobShell, summarizeBobAvailability, detectBobShell } from "./bob.js";
import { staticAudit } from "./static-audit.js";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, "..");

type Argv = {
  cmd?: string;
  positional: string[];
  flags: Record<string, string | boolean>;
};

function parse(argv: string[]): Argv {
  const out: Argv = { positional: [], flags: {} };
  const args = argv.slice(2);
  let i = 0;
  if (args.length > 0 && !args[0].startsWith("-")) {
    out.cmd = args[0];
    i = 1;
  }
  while (i < args.length) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        out.flags[key] = next;
        i += 2;
      } else {
        out.flags[key] = true;
        i += 1;
      }
    } else {
      out.positional.push(a);
      i += 1;
    }
  }
  return out;
}

function help(): string {
  return `transmission — daily code-health ritual powered by IBM Bob 2.0

USAGE
  transmission render <findings.json> [--out <file>]
  transmission init <repo-path>
  transmission analyze <repo-path> [--out <dir>] [--static] [--bob] [--dry-run]
  transmission schema
  transmission --help

COMMANDS
  render      Take a findings.json (Bob's structured audit output) and produce a single-file HTML transmission.
  init        Copy SKILL.md + .bobignore into <repo-path> so Bob can run the audit. Idempotent.
  analyze     End-to-end audit of <repo-path>. Uses the IBM Bob skill pass when Bob Shell is on
              PATH; otherwise falls back to a deterministic static baseline audit (no Bob needed).
              Flags: --static force baseline, --bob force Bob (errors if absent), --dry-run preview.
  schema      Print the JSON schema for the findings document.

ENV
  BOB_SHELL_CMD   Override the Bob Shell binary name (default: "bob"). Useful for testing.

EXAMPLES
  # Render the example fixture
  transmission render fixtures/findings.example.json --out dist/example.html

  # Initialize a repo for the audit (one-time)
  transmission init ../some-other-repo

  # Run the audit end-to-end on a repo
  transmission analyze ../some-other-repo --out dist/

The tool has zero npm dependencies. It just reads, parses, validates, and renders.
`;
}

function cmdSchema(): void {
  const schemaPath = join(PKG_ROOT, "schema", "findings.schema.json");
  process.stdout.write(readFileSync(schemaPath, "utf8") + "\n");
}

function cmdInit(repoPath: string): void {
  const target = resolve(repoPath);
  if (!existsSync(target)) {
    console.error(`✗ Repo path does not exist: ${target}`);
    process.exit(2);
  }
  const skillSrc = join(PKG_ROOT, "SKILL.md");
  const bobignoreSrc = join(PKG_ROOT, ".bobignore");
  const skillDst = join(target, "SKILL.transmission.md");
  const bobignoreDst = join(target, ".bobignore");
  if (!existsSync(skillSrc)) {
    console.error(`✗ Missing ${skillSrc}`);
    process.exit(2);
  }
  if (!existsSync(bobignoreSrc)) {
    console.error(`✗ Missing ${bobignoreSrc}`);
    process.exit(2);
  }
  writeFileSync(skillDst, readFileSync(skillSrc, "utf8"));
  writeFileSync(bobignoreDst, readFileSync(bobignoreSrc, "utf8"));
  console.log(`✓ Wrote ${skillDst}`);
  console.log(`✓ Wrote ${bobignoreDst}`);
  console.log(``);
  console.log(`Next steps:`);
  console.log(`  1. Open the repo in Bob IDE (or run Bob Shell from the repo root).`);
  console.log(`  2. Paste this prompt into Bob's chat:`);
  console.log(``);
  console.log(`     Run the audit defined in SKILL.transmission.md against this repo.`);
  console.log(`     Use Agent mode. Spawn the five subagents in parallel as described.`);
  console.log(`     Respect .bobignore. Emit ONLY the JSON object — no markdown fences.`);
  console.log(``);
  console.log(`  3. Copy Bob's JSON output to findings.json, then:`);
  console.log(`     transmission render findings.json --out transmission.html`);
}

function cmdRender(findingsPath: string, flags: Record<string, string | boolean>): void {
  const src = resolve(findingsPath);
  if (!existsSync(src)) {
    console.error(`✗ Findings file not found: ${src}`);
    process.exit(2);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(src, "utf8"));
  } catch (e) {
    console.error(`✗ Could not parse JSON: ${(e as Error).message}`);
    process.exit(2);
  }
  const issues = validateFindings(parsed);
  if (issues.length > 0) {
    console.error(`✗ Findings failed schema validation:`);
    for (const i of issues) console.error(`    - ${i}`);
    process.exit(3);
  }
  const findings = parsed as Findings;
  const outFlag = flags.out;
  const outPath =
    typeof outFlag === "string"
      ? resolve(outFlag)
      : resolve(`transmission-${findings.dateKey}.html`);
  mkdirSync(dirname(outPath), { recursive: true });
  const html = renderFindings(findings);
  writeFileSync(outPath, html, "utf8");
  console.log(`✓ Wrote ${outPath}`);
  console.log(`  findings: ${findings.findings.length}`);
  console.log(`  persona:  ${findings.transmission.persona}`);
  console.log(`  headline: ${findings.headline}`);
}

/** Walk up from a path to find the enclosing git repository root (if any). */
function repoRootOf(start: string): string {
  let cur = start;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (existsSync(join(cur, ".git"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) return start; // no .git found — use the given path
    cur = parent;
  }
}

function cmdAnalyze(repoPath: string, flags: Record<string, string | boolean>): void {
  let target = resolve(repoPath);
  if (!existsSync(target)) {
    console.error(`✗ Repo path does not exist: ${target}`);
    process.exit(2);
  }
  if (!statSync(target).isDirectory()) {
    console.error(`✗ Repo path is not a directory: ${target}`);
    process.exit(2);
  }
  // If the user pointed at a subdirectory, audit the enclosing git repo instead.
  const root = repoRootOf(target);
  if (root !== target) {
    console.log(`→ ${basename(target)} is inside a git repo; auditing repo root: ${root}`);
    target = root;
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  const outDir = typeof flags.out === "string" ? resolve(flags.out) : resolve("dist");
  mkdirSync(outDir, { recursive: true });
  const findingsOut = join(outDir, `findings-${dateKey}.json`);
  const htmlOut = join(outDir, `transmission-${dateKey}.html`);

  // Mode selection:
  //   --static        force the deterministic baseline audit (no Bob needed)
  //   --bob           force the Bob Shell skill pass
  //   (default)       use Bob if available, otherwise fall back to static
  const bob = detectBobShell();
  const wantStatic = flags.static === true;
  const wantBob = flags.bob === true;
  const useBob = wantBob || (!wantStatic && bob.state === "available");

  if (useBob) {
    // Skill files are only needed when Bob is doing the audit. The static
    // baseline pass reads the repo directly, so don't litter the target with
    // SKILL.transmission.md / .bobignore in that mode.
    ensureSkillInstalled(target, PKG_ROOT);
    const dryRun = flags["dry-run"] === true;
    const result = invokeBobShell({
      repoPath: target,
      skillPath: join(target, "SKILL.transmission.md"),
      findingsOutPath: findingsOut,
      dryRun,
    });
    if (!result.ok) {
      if (result.reason === "bob-shell-not-found") {
        console.error(`✗ Bob Shell is not on PATH.`);
        console.error(`  Falling back to the static baseline audit. To use Bob instead:`);
        console.error(`    install: https://bob.ibm.com/docs/shell/getting-started/install-and-setup`);
        console.error(`    or run the skill in Bob IDE and: transmission render <findings.json>`);
        console.error(``);
        runStatic(target, findingsOut, htmlOut);
        return;
      }
      console.error(`✗ Bob Shell invocation failed: ${result.message}`);
      console.error(`  Falling back to the static baseline audit.`);
      runStatic(target, findingsOut, htmlOut);
      return;
    }
    if (dryRun) {
      console.log(`✓ Dry-run complete. Command preview above.`);
      return;
    }
    console.log(`✓ Bob Shell returned findings → ${findingsOut}`);
    cmdRender(findingsOut, { out: htmlOut });
    return;
  }

  // Static baseline
  if (flags["dry-run"] === true) {
    console.log(`[dry-run] would run the static baseline audit on ${target}`);
    return;
  }
  if (wantBob) {
    console.error(`✗ --bob requested but Bob Shell is not on PATH (${summarizeBobAvailability()}).`);
    process.exit(4);
  }
  runStatic(target, findingsOut, htmlOut);
}

function runStatic(target: string, findingsOut: string, htmlOut: string): void {
  console.log(`→ Running static baseline audit on ${target} ...`);
  const findings = staticAudit(target);
  writeFileSync(findingsOut, JSON.stringify(findings, null, 2), "utf8");
  console.log(`✓ Wrote ${findingsOut} (${findings.findings.length} findings)`);
  cmdRender(findingsOut, { out: htmlOut });
}

function main(): void {
  const argv = parse(process.argv);
  if (argv.flags.help === true || argv.flags.h === true || !argv.cmd) {
    process.stdout.write(help());
    return;
  }
  // Light version banner when invoked
  if (!process.env.TRANSMISSION_QUIET) {
    console.error(`transmission v0.1.0 — daily code-health ritual powered by IBM Bob 2.0`);
    console.error(`  ${summarizeBobAvailability()}`);
    console.error(``);
  }
  switch (argv.cmd) {
    case "render": {
      if (argv.positional.length < 1) {
        console.error(`✗ render requires <findings.json>`);
        process.exit(2);
      }
      cmdRender(argv.positional[0], argv.flags);
      return;
    }
    case "init": {
      if (argv.positional.length < 1) {
        console.error(`✗ init requires <repo-path>`);
        process.exit(2);
      }
      cmdInit(argv.positional[0]);
      return;
    }
    case "analyze": {
      if (argv.positional.length < 1) {
        console.error(`✗ analyze requires <repo-path>`);
        process.exit(2);
      }
      cmdAnalyze(argv.positional[0], argv.flags);
      return;
    }
    case "schema": {
      cmdSchema();
      return;
    }
    case "--help":
    case "-h": {
      process.stdout.write(help());
      return;
    }
    case "version":
    case "--version":
    case "-v": {
      console.log("0.1.0");
      return;
    }
    default: {
      console.error(`✗ Unknown command: ${argv.cmd}`);
      console.error(`Run 'transmission --help' for usage.`);
      process.exit(2);
    }
  }
}

main();
