#!/usr/bin/env bash
# Install git hooks for this repo.
# Run once after cloning: bash scripts/install-hooks.sh

set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="$REPO_ROOT/.git/hooks"
SRC_DIR="$REPO_ROOT/scripts/hooks"

mkdir -p "$HOOK_DIR"

for hook in "$SRC_DIR"/*; do
  name="$(basename "$hook")"
  cp "$hook" "$HOOK_DIR/$name"
  chmod +x "$HOOK_DIR/$name"
  echo "Installed $name hook"
done

echo "Done. All hooks installed."
