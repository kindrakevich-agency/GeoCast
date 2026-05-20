#!/usr/bin/env bash
# Render docs/architecture.mmd → docs/architecture.png using Mermaid CLI.
#
# Why a script: the architecture diagram in the README should stay in sync
# as the system evolves. Source-of-truth is the .mmd file; PNG is just a
# rendered artifact. Run this after editing the .mmd.
#
# Usage:
#   bash infra/scripts/render-architecture.sh
#
# Requires Chromium (installed once via Playwright):
#   pnpm dlx playwright@latest install chromium
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/docs/architecture.mmd"
OUT="$ROOT/docs/architecture.png"

# mermaid-cli ships its own puppeteer, which is pinned to one exact Chrome
# version. If you've installed Chrome via a different puppeteer release the
# version IDs won't match — point mermaid at the binary you already have
# via a puppeteer config JSON. We auto-detect the newest Chrome-for-Testing
# under ~/.cache/puppeteer.
CHROME="$(ls -t "$HOME/.cache/puppeteer/chrome/"*"/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" 2>/dev/null | head -1 || true)"
PCONFIG_ARG=()
if [ -n "$CHROME" ] && [ -x "$CHROME" ]; then
  PCONFIG=$(mktemp)
  printf '{"executablePath":"%s","args":["--no-sandbox"]}' "$CHROME" > "$PCONFIG"
  PCONFIG_ARG=(-p "$PCONFIG")
  trap 'rm -f "$PCONFIG"' EXIT
fi

pnpm dlx @mermaid-js/mermaid-cli@latest \
    -i "$SRC" \
    -o "$OUT" \
    --width 1600 \
    --backgroundColor "#0a0e1a" \
    --scale 2 \
    "${PCONFIG_ARG[@]}"

echo ""
echo "→ wrote $OUT"
