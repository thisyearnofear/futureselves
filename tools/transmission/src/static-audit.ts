/**
 * static-audit.ts — a deterministic, dependency-free baseline audit.
 *
 * This runs WITHOUT Bob. It produces real, reproducible findings by applying
 * targeted heuristics to the repo (test-coverage ratio, deprecated schema
 * fields, documentation staleness, broken doc references, secret hygiene,
 * unbounded array fields). It emits the same Findings shape as the Bob-driven
 * pass so the renderer is unchanged.
 *
 * Role in the story: this is the "fast baseline." IBM Bob 2.0's skill-driven
 * pass (SKILL.md) goes deeper — it reads the team's stated beliefs, reasons
 * about auth/invariants, and writes the narrative voice. The static pass proves
 * the pipeline works end-to-end today; Bob makes it smart.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { Finding, Findings, Severity, Category } from "./render.js";

/**
 * Is this file tracked by git (i.e. would a secret inside it be exposed publicly)?
 * Returns false if git is unavailable, the repo has no git, or the file is ignored.
 */
function isGitTracked(root: string, rel: string): boolean {
  try {
    const out = execFileSync("git", ["-C", root, "ls-files", "--error-unmatch", "--", rel], {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    return out.trim().length > 0;
  } catch {
    return false; // not tracked, or git unavailable
  }
}

type RepoFile = { rel: string; abs: string; mtimeMs: number };

function walk(dir: string, root: string, acc: RepoFile[], ignore: (rel: string) => boolean): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = relative(root, abs);
    if (ignore(rel)) continue;
    if (entry.isDirectory()) {
      walk(abs, root, acc, ignore);
    } else if (entry.isFile()) {
      try {
        acc.push({ rel, abs, mtimeMs: statSync(abs).mtimeMs });
      } catch {
        // skip unreadable
      }
    }
  }
}

const IGNORE_DIRS = ["node_modules", ".git", "dist", "build", ".turbo", ".expo", "coverage", "_generated", ".next", ".vercel", "__pycache__", "hf-space"];

function defaultIgnore(rel: string): boolean {
  const parts = rel.split("/");
  return parts.some((p) => IGNORE_DIRS.includes(p)) || rel.includes("tools/transmission");
}

function isBackendSource(rel: string): boolean {
  return /convex\/.*\.ts$/.test(rel) && !rel.endsWith(".test.ts") && !rel.includes("_generated") && !rel.endsWith(".config.ts") && !rel.endsWith("README.md");
}
function isTestFile(rel: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(rel);
}

export function staticAudit(repoPath: string): Findings {
  const root = resolve(repoPath);
  const repoName = basename(root);
  const dateKey = new Date().toISOString().slice(0, 10);

  const files: RepoFile[] = [];
  walk(root, root, files, defaultIgnore);

  const findings: Finding[] = [];
  let idCounter: Record<string, number> = {};
  const nextId = (prefix: string): string => {
    idCounter[prefix] = (idCounter[prefix] || 0) + 1;
    return `${prefix}-${String(idCounter[prefix]).padStart(3, "0")}`;
  };
  const add = (severity: Severity, category: Category, title: string, detail: string, fix: string, file?: string, line?: number): void => {
    const prefix = { "remote-api": "API", backend: "BE", docs: "DOC", tests: "TEST", security: "SEC", schema: "SCH", "dead-code": "DEAD" }[category];
    findings.push({ id: nextId(prefix), severity, category, title, detail, fix, file, line });
  };

  // ── Check 1: test coverage ratio on the backend ───────────────────────────
  const backendSources = files.filter((f) => isBackendSource(f.rel));
  const testFiles = files.filter((f) => isTestFile(f.rel));
  const testText = testFiles.map((t) => {
    try { return readFileSync(t.abs, "utf8"); } catch { return ""; }
  }).join("\n");
  const uncovered = backendSources.filter((s) => {
    const mod = basename(s.rel).replace(/\.ts$/, "");
    if (mod === "schema" || mod === "validators" || mod === "functions" || mod === "http") return false; // infra, not logic
    // covered if a test file references the module name or imports the file
    return !new RegExp(`\\b${mod}\\b`).test(testText);
  });
  if (backendSources.length > 0) {
    const ratio = testFiles.length / Math.max(1, backendSources.length);
    if (uncovered.length >= 3) {
      add(
        "high",
        "tests",
        `${uncovered.length} of ${backendSources.length} backend modules have no test referencing them`,
        `Found ${backendSources.length} Convex/backend source modules and ${testFiles.length} test files. Modules with no test reference include: ${uncovered.slice(0, 6).map((u) => basename(u.rel)).join(", ")}${uncovered.length > 6 ? ", …" : ""}. Mutations in these modules can regress silently.`,
        `Add a *.test.ts for the highest-risk uncovered module first (prioritize mutations that write user data). Use convex-test + vitest per the project guidelines.`,
        uncovered[0]?.rel,
      );
    } else if (ratio < 0.2) {
      add("medium", "tests", `Low test-to-source ratio (${testFiles.length} tests / ${backendSources.length} sources)`, `Backend test coverage is thin relative to the number of modules.`, `Prioritize tests for mutating functions and auth-sensitive reads.`, backendSources[0]?.rel);
    }
  }

  // ── Check 2: deprecated fields still present in schema ────────────────────
  const schemaFile = files.find((f) => /convex\/schema\.ts$/.test(f.rel));
  if (schemaFile) {
    const lines = readFileSync(schemaFile.abs, "utf8").split("\n");
    lines.forEach((ln, i) => {
      if (/[Dd]eprecated/.test(ln)) {
        // find the next field definition
        let field = "";
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const m = lines[j].match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
          if (m) { field = m[1]; break; }
        }
        add(
          "medium",
          "dead-code",
          `Deprecated schema field${field ? ` "${field}"` : ""} never migrated`,
          `schema.ts marks a field deprecated (line ${i + 1}) but there is no migration removing it. New documents keep writing the empty value and it clutters the data model.`,
          `Run a one-shot migration to strip the field from existing documents, confirm no read path references it, then remove it from schema.ts.`,
          schemaFile.rel,
          i + 1,
        );
      }
    });
  }

  // ── Check 3: documentation staleness vs recent source changes ─────────────
  const apiDoc = files.find((f) => f.rel === "docs/remote-apis.md" || f.rel.endsWith("remote-apis.md"));
  if (apiDoc) {
    const docText = readFileSync(apiDoc.abs, "utf8");
    const m = docText.match(/[Ll]ast audited[^\d]*(\d{4}-\d{2}-\d{2})/);
    if (m) {
      const auditedMs = Date.parse(m[1]);
      const changedSince = files.filter((f) => (isBackendSource(f.rel) || /apps\/default\/lib\/.*\.ts$/.test(f.rel)) && f.mtimeMs > auditedMs);
      if (changedSince.length > 0 && !Number.isNaN(auditedMs)) {
        add(
          "high",
          "docs",
          `remote-API inventory stale — ${changedSince.length} source file(s) changed since "last audited ${m[1]}"`,
          `docs/remote-apis.md says it was last audited ${m[1]}, but these files changed after that date: ${changedSince.slice(0, 5).map((c) => `${c.rel} (${new Date(c.mtimeMs).toISOString().slice(0, 10)})`).join("; ")}${changedSince.length > 5 ? "; …" : ""}. The inventory's per-API claims may no longer match the code.`,
          `Re-run the inventory audit (the doc itself documents the grep command) and bump the "last audited" date.`,
          apiDoc.rel,
        );
      }
    }
  }

  // ── Check 4: broken file references in AGENTS.md / CLAUDE.md ──────────────
  for (const docRel of ["AGENTS.md", "CLAUDE.md"]) {
    const doc = files.find((f) => f.rel === docRel);
    if (!doc) continue;
    const text = readFileSync(doc.abs, "utf8");
    const refs = new Set<string>();
    const re = /`((?:apps|packages|docs|scripts|convex|hf-space)\/[A-Za-z0-9_\-./]+\.(?:ts|tsx|js|mjs|md|py|json))`/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text))) refs.add(mm[1]);
    for (const ref of refs) {
      const clean = ref.split("#")[0];
      if (!existsSync(join(root, clean))) {
        add(
          "medium",
          "docs",
          `${docRel} references a file that no longer exists: ${clean}`,
          `The doc points readers at \`${clean}\` but that path is missing from the repo. Onboarding readers hit a dead end.`,
          `Update or remove the reference in ${docRel}.`,
          docRel,
        );
      }
    }
  }

  // ── Check 5: secret hygiene ────────────────────────────────────────────────
  const gitignore = files.find((f) => f.rel === ".gitignore");
  const envFiles = files.filter((f) => /(^|\/)\.env(\..+)?$/.test(f.rel));
  if (gitignore) {
    const gi = readFileSync(gitignore.abs, "utf8");
    if (!/^\.env/m.test(gi) && envFiles.length > 0) {
      add("critical", "security", `.env file(s) present but ".env" is not in .gitignore`, `Found ${envFiles.length} .env file(s) and no .gitignore rule covering them — they may be committed with secrets.`, `Add .env patterns to .gitignore and rotate any keys already pushed.`, ".gitignore");
    }
  }
  // crude hardcoded-secret scan (high-entropy key shapes only)
  for (const f of files) {
    if (!/\.(ts|tsx|js|mjs|json|py|env)$/.test(f.rel)) continue;
    if (f.rel.includes("package-lock") || f.rel.includes("bun.lock")) continue;
    let text = "";
    try { text = readFileSync(f.abs, "utf8"); } catch { continue; }
    const hit = text.match(/(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})/);
    if (hit) {
      // Never echo secret material — report only the credential FAMILY, not the value.
      const raw = hit[1];
      const family = raw.startsWith("sk-") ? "an Anthropic/OpenAI-style key (sk-…)"
        : raw.startsWith("AKIA") ? "an AWS access key id (AKIA…)"
        : "a Slack token (xox…)";
      const lineNo = text.slice(0, hit.index ?? 0).split("\n").length;
      const tracked = isGitTracked(root, f.rel);
      if (tracked) {
        add(
          "critical",
          "security",
          `Committed secret in ${f.rel}`,
          `${family} at line ${lineNo} is tracked by git — it is exposed to anyone who can read the repo. The value is intentionally NOT shown here.`,
          `Remove the literal from history (git filter-repo), load it from an env var or secrets manager, and ROTATE the key immediately.`,
          f.rel,
          lineNo,
        );
      } else {
        add(
          "info",
          "security",
          `Local-only credential in ${f.rel} (correctly git-ignored)`,
          `${family} at line ${lineNo}. This file is NOT tracked by git, so the value is not publicly exposed. Flagging it only so the team knows the scanner is working — no action required unless the ignore rule changes.`,
          `No action needed while ${f.rel} stays git-ignored. Keep it that way.`,
          f.rel,
          lineNo,
        );
      }
    }
  }

  // ── Check 6: unbounded array fields in schema (heuristic) ─────────────────
  if (schemaFile) {
    const text = readFileSync(schemaFile.abs, "utf8");
    const lines = text.split("\n");
    lines.forEach((ln, i) => {
      const m = ln.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*v\.array\(/);
      if (m && /raw|sample|reading|log|event|history/i.test(m[1])) {
        add(
          "medium",
          "schema",
          `Possibly unbounded array field "${m[1]}" in schema`,
          `schema.ts line ${i + 1} defines \`${m[1]}\` as v.array(...). Per-event arrays grow without bound and can push a document toward Convex's 1MB limit.`,
          `Move per-event items to a child table with a foreign key; keep only a bounded summary on the parent document.`,
          schemaFile.rel,
          i + 1,
        );
      }
    });
  }

  // ── Sort + cap + stats ────────────────────────────────────────────────────
  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || (a.file || "").localeCompare(b.file || ""));
  const capped = findings.slice(0, 30);

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byCategory: Partial<Record<Category, number>> = {};
  for (const f of capped) {
    bySeverity[f.severity]++;
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  }

  const top = capped[0];
  const headline = top
    ? `${capped.length} finding(s). Top risk: ${top.title}.`
    : `No findings — the baseline audit came back clean.`;

  const narrative = buildNarrative(capped, bySeverity, files.length);
  const script = buildScript(repoName, capped);

  return {
    dateKey,
    repository: repoName,
    headline,
    narrative,
    transmission: { persona: pickPersona(byCategory), script },
    findings: capped,
    stats: { filesScanned: files.length, findingsTotal: capped.length, bySeverity, byCategory },
  };
}

function pickPersona(byCategory: Partial<Record<Category, number>>): string {
  const entries = Object.entries(byCategory) as [Category, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0]?.[0];
  switch (top) {
    case "security": return "The Sentinel";
    case "tests": return "The Underwriter";
    case "docs": return "The Archivist";
    case "schema":
    case "dead-code": return "The Groundskeeper";
    case "remote-api": return "The Operator";
    default: return "The Maintainer";
  }
}

function buildNarrative(findings: Finding[], bySeverity: Record<Severity, number>, fileCount: number): string {
  if (findings.length === 0) {
    return `The baseline audit scanned ${fileCount} files and found nothing to flag. That's a good day. Keep the ritual running so the next drift doesn't sneak past.`;
  }
  const p1 = `Scanned ${fileCount} files and surfaced ${findings.length} finding(s): ${bySeverity.critical} critical, ${bySeverity.high} high, ${bySeverity.medium} medium, ${bySeverity.low} low, ${bySeverity.info} info. The most urgent item is "${findings[0].title}" (${findings[0].file ?? "repo-wide"}).`;
  const cats = Object.keys(bySeverity).length ? findings.map((f) => f.category) : [];
  const uniq = [...new Set(cats)];
  const p2 = `The pattern across this pass is ${uniq.slice(0, 3).join(", ")}. These are the quiet, compounding issues — the kind that don't fail a build but cost hours later when context is gone and the fix is more expensive.`;
  const p3 = `The cheapest move that moves the needle: start with "${findings[0].title}". ${findings[0].fix} This is the static baseline; run the IBM Bob skill pass for the deeper, narrative-grade audit.`;
  return `${p1}\n\n${p2}\n\n${p3}`;
}

function buildScript(repo: string, findings: Finding[]): string {
  if (findings.length === 0) {
    return `Hey. It's ${repo}, six months from now. You kept me clean today — no findings on the baseline pass. Do this again tomorrow and I'll stay that way.`;
  }
  const f0 = findings[0];
  const f1 = findings[1];
  let s = `Hey. It's ${repo}, six months from now. I ran the numbers and I need to tell you about ${findings.length} thing${findings.length === 1 ? "" : "s"} before they get expensive.\n\n`;
  s += `The big one: ${f0.title.toLowerCase()}. ${f0.detail} If you leave it, future-you is the one who pays.\n\n`;
  if (f1) s += `Close behind: ${f1.title.toLowerCase()}. ${f1.fix}\n\n`;
  s += `Do this today: fix the top item, then run me again tomorrow. That's the ritual. That's how I stay healthy.`;
  return s;
}
