/**
 * Bob Shell integration.
 *
 * Two responsibilities:
 *   (1) Detect whether Bob Shell is installed and on PATH.
 *   (2) Wrap a non-interactive invocation: feed the skill + repo path in, capture the JSON out.
 *
 * The wrapper is intentionally thin. The real audit logic lives in SKILL.md — Bob reads it.
 * The CLI's job is just plumbing.
 */

import { spawnSync, spawn } from "node:child_process";
import { existsSync, writeFileSync, copyFileSync, readFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

export type BobAvailability =
  | { state: "available"; path: string; version?: string }
  | { state: "not-found" }
  | { state: "wrong-account" };

export type BobShellResult =
  | { ok: true; findingsPath: string }
  | { ok: false; reason: "bob-shell-not-found"; message: string }
  | { ok: false; reason: "invocation-failed"; message: string };

export function detectBobShell(): BobAvailability {
  const cmd = process.env.BOB_SHELL_CMD || "bob";
  try {
    const which = execSync(`which ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (!which) return { state: "not-found" };
    let version: string | undefined;
    try {
      version = execSync(`${cmd} --version`, { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim()
        .split("\n")[0];
    } catch {
      // ignore — version detection is best-effort
    }
    return { state: "available", path: which, version };
  } catch {
    return { state: "not-found" };
  }
}

export function summarizeBobAvailability(): string {
  const a = detectBobShell();
  if (a.state === "available") {
    return `Bob Shell: available (${a.path}${a.version ? `, ${a.version}` : ""})`;
  }
  return `Bob Shell: not detected on PATH (set BOB_SHELL_CMD to override)`;
}

/**
 * Copy SKILL.md and .bobignore from the transmission package into the target repo.
 * Idempotent — overwrites if present.
 */
export function ensureSkillInstalled(repoPath: string, pkgRoot: string): void {
  const skillSrc = join(pkgRoot, "SKILL.md");
  const bobignoreSrc = join(pkgRoot, ".bobignore");
  const skillDst = join(repoPath, "SKILL.transmission.md");
  const bobignoreDst = join(repoPath, ".bobignore");
  if (!existsSync(skillSrc) || !existsSync(bobignoreSrc)) {
    throw new Error(`transmission package missing SKILL.md or .bobignore at ${pkgRoot}`);
  }
  copyFileSync(skillSrc, skillDst);
  copyFileSync(bobignoreSrc, bobignoreDst);
}

/**
 * Invoke Bob Shell in non-interactive mode.
 *
 * The exact CLI surface of Bob Shell's non-interactive mode is documented at
 * https://bob.ibm.com/docs/shell/getting-started/start-bobshell-non-interactive.
 * This wrapper attempts the most common invocation patterns and surfaces any
 * failure clearly so the user can fall back to running the skill in Bob IDE.
 *
 * We deliberately do NOT auto-retry or hide errors. If Bob Shell isn't right,
 * the user should know — they may need to switch to Bob IDE for the demo.
 */
export function invokeBobShell(opts: {
  repoPath: string;
  skillPath: string;
  findingsOutPath: string;
  dryRun?: boolean;
}): BobShellResult {
  mkdirSync(dirname(opts.findingsOutPath), { recursive: true });
  if (opts.dryRun) {
    const cmd = process.env.BOB_SHELL_CMD || "bob";
    console.log(`[dry-run] would execute:`);
    console.log(`  ${cmd} shell --non-interactive --repo ${opts.repoPath} --output ${opts.findingsOutPath}`);
    console.log(`  with skill at: ${opts.skillPath}`);
    return { ok: true, findingsPath: opts.findingsOutPath };
  }
  const a = detectBobShell();
  if (a.state !== "available") {
    return {
      ok: false,
      reason: "bob-shell-not-found",
      message: `Bob Shell not found on PATH (BOB_SHELL_CMD=${process.env.BOB_SHELL_CMD || "bob"}).`,
    };
  }

  // Build the prompt Bob should execute.
  // We hand Bob the skill path explicitly so it knows where to read its instructions.
  const prompt = [
    `Read the file at ${opts.skillPath}.`,
    `Treat it as your operating procedure.`,
    `Run the audit it describes against the repository at ${opts.repoPath}.`,
    `Use Agent mode. Spawn the five subagents in parallel as the skill describes.`,
    `Respect .bobignore. Do not modify any source files. Do not run git push.`,
    `When you are done, emit ONLY a single JSON object matching the schema in tools/transmission/schema/findings.schema.json.`,
    `Write the JSON object to ${opts.findingsOutPath}.`,
    `Do not include any markdown fences, prose, or commentary outside the JSON object.`,
  ].join("\n");

  const cmd = process.env.BOB_SHELL_CMD || "bob";
  const args = ["shell", "--non-interactive", "--repo", opts.repoPath, "--output", opts.findingsOutPath];

  if (opts.dryRun) {
    console.log(`[dry-run] would execute:`);
    console.log(`  ${cmd} ${args.join(" ")}`);
    console.log(`  with prompt (first 200 chars):`);
    console.log(`    ${prompt.slice(0, 200).replace(/\n/g, " ")}...`);
    return { ok: true, findingsPath: opts.findingsOutPath };
  }

  // Run Bob Shell with the prompt on stdin (most CLI patterns accept this).
  const r = spawnSync(cmd, args, {
    input: prompt,
    cwd: opts.repoPath,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (r.status !== 0) {
    return {
      ok: false,
      reason: "invocation-failed",
      message: r.stderr || r.stdout || `Bob Shell exited with code ${r.status}`,
    };
  }

  // Sanity check: did Bob actually write the findings file?
  if (!existsSync(opts.findingsOutPath)) {
    // Some CLI patterns write to stdout. If we got JSON on stdout, write it ourselves.
    const trimmed = (r.stdout || "").trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      writeFileSync(opts.findingsOutPath, trimmed, "utf8");
      return { ok: true, findingsPath: opts.findingsOutPath };
    }
    return {
      ok: false,
      reason: "invocation-failed",
      message: `Bob Shell exited 0 but did not produce ${opts.findingsOutPath} and stdout was not JSON.`,
    };
  }
  return { ok: true, findingsPath: opts.findingsOutPath };
}
