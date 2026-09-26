/**
 * render.ts — produces a single, self-contained HTML transmission from a Findings document.
 *
 * The output is intentionally print/share-friendly: no external CSS, no external JS, no network calls.
 * Drop the file into Slack, attach it to a PR, open it from disk — it works the same.
 *
 * The visual language borrows from the Future Selves app (deep-space palette, indigo/violet glow,
 * streak counters, persona voice card) so the tool reads as part of the same product surface.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Category =
  | "remote-api"
  | "backend"
  | "docs"
  | "tests"
  | "security"
  | "schema"
  | "dead-code";

export type Finding = {
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  detail: string;
  file?: string;
  line?: number;
  fix: string;
};

export type Findings = {
  dateKey: string;
  repository: string;
  headline: string;
  narrative: string;
  transmission: {
    persona: string;
    script: string;
  };
  findings: Finding[];
  stats: {
    filesScanned: number;
    findingsTotal: number;
    bySeverity: Record<Severity, number>;
    byCategory: Partial<Record<Category, number>>;
  };
};

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];
const CATEGORIES: Category[] = [
  "remote-api",
  "backend",
  "docs",
  "tests",
  "security",
  "schema",
  "dead-code",
];

export function validateFindings(input: unknown): string[] {
  const issues: string[] = [];
  if (!input || typeof input !== "object") {
    issues.push("root must be an object");
    return issues;
  }
  const f = input as Partial<Findings>;
  if (!f.dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(f.dateKey)) issues.push("dateKey must be YYYY-MM-DD");
  if (!f.repository) issues.push("repository is required");
  if (!f.headline) issues.push("headline is required");
  if (!f.narrative) issues.push("narrative is required");
  if (!f.transmission?.persona) issues.push("transmission.persona is required");
  if (!f.transmission?.script) issues.push("transmission.script is required");
  if (!Array.isArray(f.findings)) {
    issues.push("findings must be an array");
  } else {
    f.findings.forEach((fnd, i) => {
      if (!fnd.id) issues.push(`findings[${i}].id missing`);
      if (!SEVERITIES.includes(fnd.severity))
        issues.push(`findings[${i}].severity invalid: ${fnd.severity}`);
      if (!CATEGORIES.includes(fnd.category))
        issues.push(`findings[${i}].category invalid: ${fnd.category}`);
      if (!fnd.title) issues.push(`findings[${i}].title missing`);
      if (!fnd.detail) issues.push(`findings[${i}].detail missing`);
      if (!fnd.fix) issues.push(`findings[${i}].fix missing`);
    });
  }
  if (!f.stats) issues.push("stats is required");
  return issues;
}

// ─── Visual helpers ──────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#ff4d6d",
  high: "#ff8c42",
  medium: "#ffd166",
  low: "#7dd3fc",
  info: "#a78bfa",
};

const SEVERITY_GLOW: Record<Severity, string> = {
  critical: "rgba(255,77,109,0.45)",
  high: "rgba(255,140,66,0.35)",
  medium: "rgba(255,209,102,0.30)",
  low: "rgba(125,211,252,0.30)",
  info: "rgba(167,139,250,0.30)",
};

const CATEGORY_ICON: Record<Category, string> = {
  "remote-api": "🌐",
  backend: "⚙️",
  docs: "📖",
  tests: "🧪",
  security: "🔒",
  schema: "🗂️",
  "dead-code": "🪦",
};

const CATEGORY_LABEL: Record<Category, string> = {
  "remote-api": "remote-api",
  backend: "backend",
  docs: "docs",
  tests: "tests",
  security: "security",
  schema: "schema",
  "dead-code": "dead-code",
};

function escapeHtml(s: string): string {
  const ENT = {
    amp: "\u0026" + "amp;",
    lt: "\u0026" + "lt;",
    gt: "\u0026" + "gt;",
    quot: "\u0026" + "quot;",
    apos: "\u0026" + "#39;",
  };
  return s
    .replace(/&/g, ENT.amp)
    .replace(/</g, ENT.lt)
    .replace(/>/g, ENT.gt)
    .replace(/"/g, ENT.quot)
    .replace(/'/g, ENT.apos);
}

function sortFindings(findings: Finding[]): Finding[] {
  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return [...findings].sort((a, b) => {
    const sev = order[a.severity] - order[b.severity];
    if (sev !== 0) return sev;
    return (a.file || "").localeCompare(b.file || "") || (a.line || 0) - (b.line || 0);
  });
}

// ─── CSS (embedded, no external deps) ────────────────────────────────────────

const CSS = `
:root {
  --bg-0: #07061a;
  --bg-1: #0c0a2e;
  --bg-2: #1a1545;
  --fg-0: #f5f3ff;
  --fg-1: #cbd5e1;
  --fg-2: #94a3b8;
  --fg-3: #64748b;
  --accent: #a78bfa;
  --accent-2: #7c3aed;
  --accent-3: #f0abfc;
  --border: rgba(167,139,250,0.18);
  --card: rgba(255,255,255,0.035);
  --card-strong: rgba(255,255,255,0.06);
  --glow: 0 0 60px rgba(124,58,237,0.25);
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background:
    radial-gradient(1200px 800px at 80% -10%, rgba(124,58,237,0.18), transparent 50%),
    radial-gradient(900px 700px at -10% 30%, rgba(56,189,248,0.10), transparent 60%),
    linear-gradient(180deg, var(--bg-0), var(--bg-1) 60%, var(--bg-0));
  color: var(--fg-0);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
body::before {
  content: "";
  position: fixed; inset: 0;
  background-image:
    radial-gradient(1px 1px at 12% 24%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 78% 18%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 38% 70%, rgba(255,255,255,0.35), transparent),
    radial-gradient(1px 1px at 88% 80%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 22% 88%, rgba(255,255,255,0.3), transparent),
    radial-gradient(1.5px 1.5px at 55% 35%, rgba(255,255,255,0.45), transparent),
    radial-gradient(1.5px 1.5px at 8% 50%, rgba(255,255,255,0.4), transparent);
  pointer-events: none;
  z-index: 0;
  opacity: 0.6;
}
.wrap { position: relative; z-index: 1; max-width: 1080px; margin: 0 auto; padding: 48px 24px 96px; }

/* Header */
header.brand {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
  backdrop-filter: blur(8px);
  margin-bottom: 28px;
}
header.brand .left { display: flex; align-items: center; gap: 14px; }
header.brand .mark {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, var(--accent-2), var(--accent-3));
  box-shadow: 0 0 24px rgba(167,139,250,0.4);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 18px;
}
header.brand h1 {
  margin: 0; font-size: 15px; font-weight: 600; letter-spacing: 0.02em;
  text-transform: uppercase; color: var(--fg-1);
}
header.brand .repo { font-size: 13px; color: var(--fg-2); margin-top: 2px; }
header.brand .right { text-align: right; font-size: 12px; color: var(--fg-2); }
header.brand .right strong { color: var(--fg-0); font-weight: 600; }

/* Hero (the transmission card) */
.hero {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 36px 36px 32px;
  background:
    radial-gradient(600px 400px at 100% 0%, rgba(167,139,250,0.18), transparent 60%),
    var(--card-strong);
  backdrop-filter: blur(12px);
  box-shadow: var(--glow);
  margin-bottom: 32px;
  overflow: hidden;
}
.hero::after {
  content: "";
  position: absolute; right: -80px; top: -80px;
  width: 240px; height: 240px;
  background: radial-gradient(circle, var(--accent-2), transparent 70%);
  opacity: 0.35; pointer-events: none;
}
.hero .badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(167,139,250,0.15); border: 1px solid rgba(167,139,250,0.3);
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--accent); font-weight: 600;
}
.hero h2 {
  margin: 14px 0 6px; font-size: 28px; font-weight: 700; letter-spacing: -0.01em;
}
.hero .headline { color: var(--fg-1); font-size: 16px; margin-bottom: 22px; max-width: 70ch; }
.hero .persona {
  display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
  font-size: 13px; color: var(--fg-2); text-transform: uppercase; letter-spacing: 0.1em;
}
.hero .persona .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent-3);
  box-shadow: 0 0 12px var(--accent-3);
}
.hero .script {
  margin: 0; padding: 20px 22px; border-radius: 12px;
  background: rgba(0,0,0,0.35); border-left: 3px solid var(--accent);
  font-size: 15.5px; line-height: 1.7; color: var(--fg-0);
  font-family: "Iowan Old Style", Georgia, serif;
}

/* Two-column body */
.body-grid { display: grid; grid-template-columns: 1fr 280px; gap: 24px; }
@media (max-width: 880px) { .body-grid { grid-template-columns: 1fr; } }

.narrative h3 {
  margin: 0 0 12px; font-size: 13px; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--fg-2); font-weight: 600;
}
.narrative .prose p {
  margin: 0 0 14px; font-size: 14.5px; line-height: 1.7; color: var(--fg-1);
  max-width: 68ch;
}

/* Sidebar stats */
.stats {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px;
  background: var(--card);
  backdrop-filter: blur(8px);
  align-self: start;
}
.stats h3 {
  margin: 0 0 14px; font-size: 13px; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--fg-2); font-weight: 600;
}
.stats .row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.stats .row:last-child { border-bottom: 0; }
.stats .row .label { color: var(--fg-2); text-transform: capitalize; }
.stats .row .val { font-weight: 600; color: var(--fg-0); font-variant-numeric: tabular-nums; }
.stats .pill {
  display: inline-block; padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 600; min-width: 24px; text-align: center;
}
.stats .hero-num {
  font-size: 42px; font-weight: 700; letter-spacing: -0.02em; line-height: 1;
  background: linear-gradient(135deg, var(--accent-3), var(--accent));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* Findings list */
.findings { margin-top: 36px; }
.findings h3 {
  margin: 0 0 14px; font-size: 13px; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--fg-2); font-weight: 600;
}
.finding {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px 20px;
  background: var(--card);
  margin-bottom: 12px;
  position: relative;
  border-left-width: 3px;
}
.finding[data-sev="critical"] { border-left-color: ${SEVERITY_COLOR.critical}; box-shadow: 0 0 24px ${SEVERITY_GLOW.critical}; }
.finding[data-sev="high"]     { border-left-color: ${SEVERITY_COLOR.high}; box-shadow: 0 0 18px ${SEVERITY_GLOW.high}; }
.finding[data-sev="medium"]   { border-left-color: ${SEVERITY_COLOR.medium}; }
.finding[data-sev="low"]      { border-left-color: ${SEVERITY_COLOR.low}; }
.finding[data-sev="info"]     { border-left-color: ${SEVERITY_COLOR.info}; }

.finding .meta {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 10px; font-size: 11px;
}
.sev-pill {
  padding: 3px 9px; border-radius: 999px;
  font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  font-size: 10px;
}
.sev-pill[data-sev="critical"] { background: rgba(255,77,109,0.18); color: ${SEVERITY_COLOR.critical}; }
.sev-pill[data-sev="high"]     { background: rgba(255,140,66,0.18); color: ${SEVERITY_COLOR.high}; }
.sev-pill[data-sev="medium"]   { background: rgba(255,209,102,0.18); color: ${SEVERITY_COLOR.medium}; }
.sev-pill[data-sev="low"]      { background: rgba(125,211,252,0.18); color: ${SEVERITY_COLOR.low}; }
.sev-pill[data-sev="info"]     { background: rgba(167,139,250,0.18); color: ${SEVERITY_COLOR.info}; }

.cat-pill {
  padding: 3px 9px; border-radius: 6px;
  background: rgba(255,255,255,0.05); color: var(--fg-1);
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
}
.finding h4 { margin: 0 0 6px; font-size: 16px; font-weight: 600; color: var(--fg-0); }
.finding .detail { margin: 0 0 12px; font-size: 13.5px; color: var(--fg-1); line-height: 1.6; }
.finding .ref {
  font-family: "SF Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  font-size: 11.5px; color: var(--fg-2);
  padding: 6px 10px; border-radius: 6px;
  background: rgba(0,0,0,0.35); display: inline-block;
  margin-bottom: 10px;
}
.finding .fix {
  border-top: 1px solid var(--border);
  padding-top: 10px; margin-top: 8px;
  font-size: 13px; color: var(--fg-1);
}
.finding .fix .label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--accent); margin-right: 6px; font-weight: 600;
}

/* Footer */
footer.foot {
  margin-top: 48px; padding-top: 24px;
  border-top: 1px solid var(--border);
  font-size: 12px; color: var(--fg-3);
  display: flex; justify-content: space-between; align-items: center;
}
footer.foot .links a { color: var(--fg-2); text-decoration: none; margin-left: 12px; }
footer.foot .links a:hover { color: var(--accent); }

/* Print-friendly */
@media print {
  body { background: white; color: #111; }
  .finding, .hero, .stats { background: white; border-color: #ddd; box-shadow: none; }
}
`;

// ─── HTML template ──────────────────────────────────────────────────────────

export function renderFindings(f: Findings): string {
  const sorted = sortFindings(f.findings);
  const sevTotal = SEVERITIES.reduce((sum, s) => sum + (f.stats.bySeverity[s] || 0), 0);
  const catEntries = CATEGORIES.filter((c) => (f.stats.byCategory[c] || 0) > 0);
  const findingsHtml = sorted
    .map((fnd) => {
      const ref = fnd.file
        ? `<div class="ref">${escapeHtml(fnd.file)}${fnd.line ? `:${fnd.line}` : ""}</div>`
        : "";
      return `
        <div class="finding" data-sev="${fnd.severity}">
          <div class="meta">
            <span class="sev-pill" data-sev="${fnd.severity}">${fnd.severity}</span>
            <span class="cat-pill">${CATEGORY_ICON[fnd.category]} ${CATEGORY_LABEL[fnd.category]}</span>
            <span style="color: var(--fg-3); font-family: ui-monospace, monospace;">${escapeHtml(fnd.id)}</span>
          </div>
          <h4>${escapeHtml(fnd.title)}</h4>
          <p class="detail">${escapeHtml(fnd.detail)}</p>
          ${ref}
          <div class="fix"><span class="label">Fix</span>${escapeHtml(fnd.fix)}</div>
        </div>`;
    })
    .join("\n");

  const statsHtml = `
    <div class="stats">
      <h3>Today</h3>
      <div style="display:flex; align-items:baseline; gap:8px; margin-bottom: 18px;">
        <span class="hero-num">${sevTotal}</span>
        <span style="color: var(--fg-2); font-size: 13px;">findings across ${f.stats.filesScanned} files</span>
      </div>
      <div class="row"><span class="label">Critical</span><span class="val" style="color:${SEVERITY_COLOR.critical}">${f.stats.bySeverity.critical || 0}</span></div>
      <div class="row"><span class="label">High</span><span class="val" style="color:${SEVERITY_COLOR.high}">${f.stats.bySeverity.high || 0}</span></div>
      <div class="row"><span class="label">Medium</span><span class="val" style="color:${SEVERITY_COLOR.medium}">${f.stats.bySeverity.medium || 0}</span></div>
      <div class="row"><span class="label">Low</span><span class="val" style="color:${SEVERITY_COLOR.low}">${f.stats.bySeverity.low || 0}</span></div>
      <div class="row"><span class="label">Info</span><span class="val" style="color:${SEVERITY_COLOR.info}">${f.stats.bySeverity.info || 0}</span></div>
      <h3 style="margin-top: 20px;">By Category</h3>
      ${catEntries
        .map((c) => `<div class="row"><span class="label">${CATEGORY_ICON[c]} ${c}</span><span class="val">${f.stats.byCategory[c] || 0}</span></div>`)
        .join("\n")}
    </div>
  `;

  const narrativeHtml = f.narrative
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(f.repository)} — transmission ${escapeHtml(f.dateKey)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="brand">
    <div class="left">
      <div class="mark">T</div>
      <div>
        <h1>Transmission</h1>
        <div class="repo">${escapeHtml(f.repository)}</div>
      </div>
    </div>
    <div class="right">
      <strong>${escapeHtml(f.dateKey)}</strong><br>
      daily code-health ritual
    </div>
  </header>

  <section class="hero">
    <span class="badge">◉ Live from your codebase, six months out</span>
    <h2>${escapeHtml(f.headline)}</h2>
    <div class="persona"><span class="dot"></span>${escapeHtml(f.transmission.persona)}</div>
    <blockquote class="script">${escapeHtml(f.transmission.script)}</blockquote>
  </section>

  <div class="body-grid">
    <section class="narrative">
      <h3>Narrative</h3>
      <div class="prose">${narrativeHtml}</div>
    </section>
    ${statsHtml}
  </div>

  <section class="findings">
    <h3>Findings · ${sorted.length}</h3>
    ${findingsHtml}
  </section>

  <footer class="foot">
    <div>transmission v0.1.0 · powered by IBM Bob 2.0</div>
    <div class="links">
      <a href="https://bob.ibm.com/docs/">Bob docs</a>
      <a href="https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon">IBM Bob 2.0 hackathon</a>
    </div>
  </footer>
</div>
</body>
</html>`;
}
