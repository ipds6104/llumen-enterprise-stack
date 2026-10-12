#!/usr/bin/env bash
# ==============================================================================
# Enterprise CISO SOC Tool: Emergency Revocation, Blocklist & Killswitch CLI
# ==============================================================================

set -euo pipefail

JIT_API="${JIT_API_URL:-http://127.0.0.1:3001}"
DB_PATH="${JIT_SQLITE_PATH:-./data/db.sqlite}"

usage() {
    echo "Usage: $0 <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  block <username> [reason]   - Instantly block a compromised account from AI access"
    echo "  unblock <username>          - Restore account access after incident remediation"
    echo "  list                        - List all currently blocked users"
    echo "  deactivate <username>       - De-provision/delete user from SQLite (SCIM offboarding)"
    echo "  killswitch [on|off]         - Toggle global emergency killswitch"
    exit 1
}

if [[ $# -lt 1 ]]; then
    usage
fi

CMD="$1"

case "${CMD}" in
    block)
        if [[ $# -lt 2 ]]; then
            echo "Error: Missing username. Usage: $0 block <username> [reason]"
            exit 1
        fi
        USER="$2"
        REASON="${3:-"Manual SOC Action"}"
        echo "==> [SOC ACTION] Blocking user '${USER}' (Reason: ${REASON})..."
        if curl -s -f -X POST "${JIT_API}/api/admin/blocklist" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"${USER}\",\"reason\":\"${REASON}\",\"admin\":\"soc_analyst\"}" 2>/dev/null; then
            echo "==> Successfully blocked user '${USER}' via JIT Security API."
        elif [[ -f "${DB_PATH}" ]]; then
            sqlite3 "${DB_PATH}" "INSERT OR REPLACE INTO security_blocklist VALUES ('${USER}', '${REASON}', 'soc_cli', datetime('now'));"
            echo "==> Successfully injected blocklist record directly into ${DB_PATH}."
        else
            echo "Error: Unable to reach JIT API and database not found."
            exit 1
        fi
        ;;

    unblock)
        if [[ $# -lt 2 ]]; then
            echo "Error: Missing username. Usage: $0 unblock <username>"
            exit 1
        fi
        USER="$2"
        echo "==> [SOC ACTION] Unblocking user '${USER}'..."
        if curl -s -f -X DELETE "${JIT_API}/api/admin/blocklist/${USER}" 2>/dev/null; then
            echo "==> Successfully unblocked '${USER}' via JIT Security API."
        elif [[ -f "${DB_PATH}" ]]; then
            sqlite3 "${DB_PATH}" "DELETE FROM security_blocklist WHERE username='${USER}';"
            echo "==> Successfully removed blocklist record directly from ${DB_PATH}."
        else
            echo "Error: Unable to reach JIT API and database not found."
            exit 1
        fi
        ;;

    list)
        echo "==> Current Security Blocklist Records:"
        if curl -s -f "${JIT_API}/api/admin/blocklist" 2>/dev/null | jq . 2>/dev/null; then
            exit 0
        elif [[ -f "${DB_PATH}" ]]; then
            sqlite3 -header -column "${DB_PATH}" "SELECT username, reason, blocked_by, blocked_at FROM security_blocklist;"
        else
            echo "No active records found."
        fi
        ;;

    deactivate)
        if [[ $# -lt 2 ]]; then
            echo "Error: Missing username. Usage: $0 deactivate <username>"
            exit 1
        fi
        USER="$2"
        echo "==> [SCIM ACTION] De-provisioning user '${USER}'..."
        if curl -s -f -X POST "${JIT_API}/api/users/deactivate" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"${USER}\"}" 2>/dev/null; then
            echo "==> Successfully de-provisioned '${USER}'."
        elif [[ -f "${DB_PATH}" ]]; then
            sqlite3 "${DB_PATH}" "DELETE FROM user WHERE name='${USER}';"
            echo "==> Successfully purged user record from ${DB_PATH}."
        fi
        ;;

    killswitch)
        STATE="${2:-"status"}"
        if [[ "${STATE}" == "on" ]]; then
            curl -s -X POST "${JIT_API}/api/admin/killswitch" -H "Content-Type: application/json" -d '{"enable": true}' | jq .
        elif [[ "${STATE}" == "off" ]]; then
            curl -s -X POST "${JIT_API}/api/admin/killswitch" -H "Content-Type: application/json" -d '{"enable": false}' | jq .
        else
            curl -s "${JIT_API}/health" | jq .killswitch
        fi
        ;;

    *)
        usage
        ;;
esac
