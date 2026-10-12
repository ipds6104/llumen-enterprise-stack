#!/usr/bin/env bash
# ==============================================================================
# Deterministic File Line Limit Checker (< 350 Lines per File)
# Enforces Interface-First, SOLID Architecture and Prevents Monolithic Bloat
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

MAX_LINES=350

echo "==> Running Deterministic File Line Check (< ${MAX_LINES} lines per file)..."

VIOLATIONS=$(find "${ROOT_DIR}" -type f \
    ! -path "*/.git/*" \
    ! -path "*/node_modules/*" \
    ! -path "*/vendor/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/target/*" \
    ! -path "*/bun.lockb" \
    ! -path "*/bun.lock" \
    ! -name "*.sqlite*" \
    ! -name "*.png" \
    ! -name "*.jpg" \
    ! -name "*.ico" \
    ! -name "*.webp" \
    -exec wc -l {} + | awk -v limit="${MAX_LINES}" '$1 >= limit && $2 != "total" {print $1, $2; failed=1} END {if (failed) exit 1}') || {
    echo "  [✗] FAILURE: The following files exceed the strict ${MAX_LINES}-line limit:"
    echo "${VIOLATIONS}"
    echo ""
    echo "Refactor required: Split monolithic code into modular submodules according to SOLID SRP."
    exit 1
}

echo "  [✓] SUCCESS: 100% of repository files are strictly within < ${MAX_LINES} lines."
exit 0
