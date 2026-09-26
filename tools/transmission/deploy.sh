#!/usr/bin/env bash
# Deploy the transmission demo to GitHub Pages on the `pages` branch.
#
# Usage:  bash tools/transmission/deploy.sh [commit message]
#
# Requirements: gh CLI authenticated (gh auth status), git.
# This script:
#   1. Renders the latest findings into demo/ (falls back to the fixture).
#   2. Commits demo/ onto an orphan `pages` branch.
#   3. Pushes `pages` to origin.
#   4. Enables GitHub Pages for the repo on branch=pages, path=/.
#
# Re-running is safe: it reuses the existing pages branch if present.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TOOL="$ROOT/tools/transmission"
MSG="${1:-chore(transmission): refresh GitHub Pages demo}"

cd "$ROOT"

# 1. Refresh demo output
echo "→ Rendering demo output..."
if [ -f "$TOOL/dist/findings-latest.json" ]; then
  bun "$TOOL/src/cli.ts" render "$TOOL/dist/findings-latest.json" --out "$TOOL/demo/example.html"
else
  bun "$TOOL/src/cli.ts" render "$TOOL/fixtures/findings.example.json" --out "$TOOL/demo/example.html"
fi
cp "$TOOL/slides/slide-"*.png "$TOOL/demo/slides/" 2>/dev/null || true

# 2. Build pages branch
echo "→ Assembling pages branch..."
DEFAULT_BRANCH="$(git symbolic-ref --short HEAD)"
STASH_NEEDED=0
if ! git diff --quiet || ! git diff --cached --quiet; then
  STASH_NEEDED=1
  git stash push -u -m "transmission-deploy-$$" >/dev/null
fi

if git show-ref --verify --quiet refs/heads/pages; then
  git checkout -q pages
  git merge -q "$DEFAULT_BRANCH" -m "merge $DEFAULT_BRANCH into pages" || git checkout --theirs . 2>/dev/null || true
else
  git checkout -q --orphan pages
  git rm -rf --cached . >/dev/null 2>&1 || true
  git clean -fd -e tools/transmission/demo >/dev/null 2>&1 || true
fi

# Keep only the demo folder content at repo root for Pages
mkdir -p .pages-tmp
cp -R "$TOOL/demo/." .pages-tmp/
find . -mindepth 1 -maxdepth 1 ! -name '.pages-tmp' ! -name '.git' -exec rm -rf {} + 2>/dev/null || true
cp -R .pages-tmp/. .
rm -rf .pages-tmp
git add -A
git commit -q -m "$MSG" || echo "  (nothing to commit)"

# 3. Push
echo "→ Pushing pages branch..."
git push -q origin pages

# 4. Enable Pages (idempotent)
echo "→ Enabling GitHub Pages..."
gh api -X PUT "repos/{owner}/{repo}/pages" -f "build_type=workflow" -f "source[branch]=pages" -f "source[path]=/" >/dev/null 2>&1 \
  || gh api -X POST "repos/{owner}/{repo}/pages" -f "source[branch]=pages" -f "source[path]=/" >/dev/null 2>&1 \
  || echo "  (Pages may already be enabled — check Settings > Pages)"

# 5. Return to original branch
git checkout -q "$DEFAULT_BRANCH"
if [ "$STASH_NEEDED" -eq 1 ]; then
  git stash pop -q || true
fi

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo ""
echo "✓ Deployed. Site will be live shortly at:"
echo "  https://${REPO%%/*}.github.io/${REPO##*/}/"
