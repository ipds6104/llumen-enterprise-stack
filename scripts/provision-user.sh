#!/usr/bin/env bash
# ==============================================================================
# Enterprise CLI: Pre-provision or Audit User in Llumen SQLite
# ==============================================================================

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <username_or_nip> [preference_json]"
    echo "Example: $0 199503112022031001"
    exit 1
fi

USERNAME="$1"
PREF="${2:-"{}"}"

DB_PATH="${JIT_SQLITE_PATH:-./data/db.sqlite}"

if [[ ! -f "${DB_PATH}" ]]; then
    echo "Error: SQLite database not found at ${DB_PATH}"
    exit 1
fi

echo "==> Checking user '${USERNAME}' in ${DB_PATH}..."

# Check if user exists
EXISTING=$(sqlite3 "${DB_PATH}" "SELECT id, name FROM user WHERE name='${USERNAME}';")

if [[ -n "${EXISTING}" ]]; then
    echo "==> User already exists in database: ${EXISTING}"
    exit 0
fi

echo "==> Pre-provisioning user '${USERNAME}'..."
DUMMY_HASH="\$argon2id\$v=19\$m=65536,t=3,p=4\$sso_$(openssl rand -hex 8)\$$(openssl rand -hex 16)"

sqlite3 "${DB_PATH}" "INSERT INTO user (name, password, preference) VALUES ('${USERNAME}', '${DUMMY_HASH}', '${PREF}');"

NEW_ID=$(sqlite3 "${DB_PATH}" "SELECT id FROM user WHERE name='${USERNAME}';")
echo "==> Successfully provisioned user '${USERNAME}' (ID: ${NEW_ID})"
