#!/usr/bin/env bash
# ==============================================================================
# Enterprise Secrets Initialization Script
# Generates cryptographically secure secrets and initializes .env
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Initializing Llumen Enterprise Stack Environment..."

cd "${ROOT_DIR}"

# 1. Ensure target directories exist
mkdir -p services/ingress/certs data
touch services/ingress/certs/acme.json
chmod 600 services/ingress/certs/acme.json || true

# 2. Check or create .env from .env.example
if [[ ! -f .env ]]; then
    echo "==> Creating .env from .env.example..."
    cp .env.example .env

    # Generate 32-byte base64 string for cookie encryption
    COOKIE_SECRET=$(openssl rand -base64 32)
    # Generate 24-byte random password for Valkey
    VALKEY_PASS=$(openssl rand -hex 16)

    # Replace placeholders in .env
    sed -i "s|COOKIE_SECRET=replace-with-openssl-rand-base64-32|COOKIE_SECRET=${COOKIE_SECRET}|g" .env
    sed -i "s|VALKEY_PASSWORD=replace-with-strong-valkey-password|VALKEY_PASSWORD=${VALKEY_PASS}|g" .env

    echo "==> Cryptographically secure secrets successfully injected into .env!"
    echo "    - COOKIE_SECRET: Generated (32-byte base64)"
    echo "    - VALKEY_PASSWORD: Generated (128-bit hex)"
else
    echo "==> .env file already exists. Skipping secret overwrite."
fi

echo "==> Initialization complete. Review .env to set your OIDC_CLIENT_SECRET and OPENROUTER_API_KEY."
