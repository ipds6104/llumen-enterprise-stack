import type { AppConfig } from "./types/index.ts";

/**
 * Loads and validates configuration from environment variables.
 * Enforces SOLID Single Responsibility Principle for configuration management.
 */
export function loadConfig(): AppConfig {
  const port = parseInt(process.env.JIT_PORT || "3001", 10);
  const sqlitePath = process.env.JIT_SQLITE_PATH || "/data/db.sqlite";
  const authGatewayUrl = process.env.JIT_AUTH_GATEWAY_URL || "http://auth-gateway:4180";
  const trustedHeader = process.env.LLUMEN_TRUSTED_HEADER || "X-Forwarded-User";
  const autoProvision = (process.env.JIT_AUTO_PROVISION || "true").toLowerCase() === "true";
  const defaultPreference = process.env.JIT_DEFAULT_PREFERENCE || "{}";
  const logLevel = process.env.JIT_LOG_LEVEL || "info";

  // CISO RBAC & Guardrail Controls
  const allowedGroups = process.env.ALLOWED_GROUPS
    ? process.env.ALLOWED_GROUPS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const allowedTenants = process.env.ALLOWED_TENANTS
    ? process.env.ALLOWED_TENANTS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const killswitchEnabled =
    (process.env.KILLSWITCH_ENABLED || "false").toLowerCase() === "true";

  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid JIT_PORT configuration: ${process.env.JIT_PORT}`);
  }

  return {
    port,
    sqlitePath,
    authGatewayUrl,
    trustedHeader,
    autoProvision,
    defaultPreference,
    logLevel,
    allowedGroups,
    allowedTenants,
    killswitchEnabled,
  };
}
