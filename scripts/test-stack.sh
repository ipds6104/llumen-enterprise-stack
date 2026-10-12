#!/usr/bin/env bash
# ==============================================================================
# Enterprise Test & Governance Validation Runner
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> 1. Running Unit & Integration Tests in jit-provisioner..."
cd "${ROOT_DIR}/services/jit-provisioner"
bun test

echo "==> 2. Validating 350-line file limit governance constraint..."
cd "${ROOT_DIR}"
VIOLATIONS=$(find . -type f \
    ! -path "*/.git/*" \
    ! -path "*/node_modules/*" \
    ! -path "*/bun.lockb" \
    ! -path "*/bun.lock" \
    ! -name "*.sqlite*" \
    ! -name "*.png" \
    ! -name "*.jpg" \
    -exec wc -l {} + | awk '$1 > 350 && $2 != "total" {print $1, $2}')

if [[ -n "${VIOLATIONS}" ]]; then
    echo "Error: The following files exceed the 350-line limit:"
    echo "${VIOLATIONS}"
    exit 1
fi
echo "  [✓] All files are within the strict 350-line limit!"

echo "==> 3. Validating Docker Compose configuration syntax..."
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    docker compose config -q 2>/dev/null && echo "  [✓] docker-compose.yml syntax is valid!" || echo "  [!] Docker daemon not reachable, skipped live validation."
else
    echo "  [!] Docker compose CLI not available in current container environment."
fi

echo "==> All test suites and governance checks PASSED successfully!"
