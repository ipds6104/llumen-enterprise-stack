#!/usr/bin/env bash
# ==============================================================================
# Enterprise Container Stack Healthcheck Monitor
# ==============================================================================

set -euo pipefail

echo "==> Auditing Llumen Enterprise Stack Container Status..."

SERVICES=("llumen-ingress" "llumen-auth-gateway" "llumen-jit-provisioner" "llumen-core" "llumen-valkey")

ALL_HEALTHY=true

for SVC in "${SERVICES[@]}"; do
    STATUS=$(docker inspect --format='{{json .State.Health.Status}}' "${SVC}" 2>/dev/null || echo "\"not-running\"")
    STATUS_CLEAN=$(echo "${STATUS}" | tr -d '"')

    if [[ "${STATUS_CLEAN}" == "healthy" ]]; then
        echo "  [✓] ${SVC}: healthy"
    elif [[ "${STATUS_CLEAN}" == "not-running" ]]; then
        STATE=$(docker inspect --format='{{json .State.Status}}' "${SVC}" 2>/dev/null || echo "\"missing\"")
        echo "  [!] ${SVC}: ${STATE}"
        ALL_HEALTHY=false
    else
        echo "  [✗] ${SVC}: ${STATUS_CLEAN}"
        ALL_HEALTHY=false
    fi
done

if [[ "${ALL_HEALTHY}" == "true" ]]; then
    echo "==> All enterprise services are healthy!"
    exit 0
else
    echo "==> Warning: Some containers are not healthy or not running."
    exit 1
fi
