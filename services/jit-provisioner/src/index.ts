import type { EnterpriseRole } from "./types/index.ts";
import { loadConfig } from "./config.ts";
import { Logger } from "./utils/logger.ts";
import { SqliteClient } from "./db/sqlite.ts";
import { UserProvisioner } from "./services/user-provisioner.ts";
import { BlocklistService } from "./services/blocklist.ts";
import { SecurityAuditLogger } from "./services/audit-logger.ts";
import { HierarchicalRbacEngine } from "./services/rbac-engine.ts";
import { ForwardAuthMediator } from "./services/forward-auth.ts";

const config = loadConfig();
const logger = new Logger(config.logLevel);

logger.info("Initializing Llumen Enterprise JIT Provisioner & Security Gateway", {
  port: config.port,
  sqlitePath: config.sqlitePath,
  authGateway: config.authGatewayUrl,
  autoProvision: config.autoProvision,
  defaultRole: config.defaultRole,
  allowedGroups: config.allowedGroups,
  killswitchEnabled: config.killswitchEnabled,
});

// Dependency Injection (SOLID DIP)
const db = new SqliteClient(config.sqlitePath, logger);
const provisioner = new UserProvisioner(db, config, logger);
const blocklist = new BlocklistService(db, logger);
const auditLogger = new SecurityAuditLogger();
const rbacEngine = new HierarchicalRbacEngine(config.defaultRole);
const authMediator = new ForwardAuthMediator(
  provisioner,
  blocklist,
  auditLogger,
  rbacEngine,
  config,
  logger
);

let authSuccessCount = 0;
let authFailureCount = 0;

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        uptime: process.uptime(),
        killswitch: config.killswitchEnabled,
        autoProvision: config.autoProvision,
        timestamp: new Date().toISOString(),
      });
    }

    // Metrics endpoint
    if (url.pathname === "/metrics") {
      const users = await provisioner.listUsers();
      const blocked = blocklist.listBlocked();
      return Response.json({
        auth_success_total: authSuccessCount,
        auth_failure_total: authFailureCount,
        total_provisioned_users: users.length,
        total_blocked_users: blocked.length,
        killswitch_active: config.killswitchEnabled,
      });
    }

    // List users (internal admin only)
    if (url.pathname === "/api/users" && req.method === "GET") {
      const users = await provisioner.listUsers();
      return Response.json({
        total: users.length,
        users: users.map((u) => ({ id: u.id, name: u.name, preference: u.preference })),
      });
    }

    // Manual provisioning hook
    if (url.pathname === "/api/users/provision" && req.method === "POST") {
      try {
        const body = (await req.json()) as { username?: string };
        if (!body.username) {
          return Response.json({ error: "Missing 'username' in request body" }, { status: 400 });
        }
        const result = await provisioner.ensureUser(body.username);
        return Response.json({
          status: "ok",
          user: { id: result.user.id, name: result.user.name },
          isNew: result.isNew,
        });
      } catch (err) {
        return Response.json({ error: String(err) }, { status: 500 });
      }
    }

    // SCIM / De-provisioning endpoint (Offboarding)
    if (url.pathname === "/api/users/deactivate" && req.method === "POST") {
      try {
        const body = (await req.json()) as { username?: string };
        if (!body.username) {
          return Response.json({ error: "Missing 'username'" }, { status: 400 });
        }
        const deactivated = await provisioner.deactivateUser(body.username);
        auditLogger.logEvent("USER_DEACTIVATED", "WARN", body.username, {
          action: "deactivate",
          success: deactivated,
        });
        return Response.json({ status: "ok", username: body.username, deactivated });
      } catch (err) {
        return Response.json({ error: String(err) }, { status: 500 });
      }
    }

    // CISO Security Blocklist Management
    if (url.pathname === "/api/admin/blocklist") {
      if (req.method === "GET") {
        return Response.json({ blocked: blocklist.listBlocked() });
      }
      if (req.method === "POST") {
        try {
          const body = (await req.json()) as { username?: string; reason?: string; admin?: string };
          if (!body.username) {
            return Response.json({ error: "Missing 'username'" }, { status: 400 });
          }
          blocklist.blockUser(body.username, body.reason || "Manual SOC action", body.admin || "ciso");
          return Response.json({ status: "blocked", username: body.username });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 500 });
        }
      }
    }

    if (url.pathname.startsWith("/api/admin/blocklist/") && req.method === "DELETE") {
      const username = decodeURIComponent(url.pathname.replace("/api/admin/blocklist/", ""));
      const unblocked = blocklist.unblockUser(username);
      auditLogger.logEvent("USER_UNBLOCKED", "INFO", username, { action: "unblock", success: unblocked });
      return Response.json({ status: "unblocked", username, success: unblocked });
    }

    // CISO Emergency Killswitch Toggle
    if (url.pathname === "/api/admin/killswitch" && req.method === "POST") {
      try {
        const body = (await req.json()) as { enable?: boolean };
        if (typeof body.enable === "boolean") {
          config.killswitchEnabled = body.enable;
        } else {
          config.killswitchEnabled = !config.killswitchEnabled;
        }
        logger.warn("Killswitch status toggled", { enabled: config.killswitchEnabled });
        return Response.json({ status: "ok", killswitchEnabled: config.killswitchEnabled });
      } catch (err) {
        return Response.json({ error: String(err) }, { status: 500 });
      }
    }

    // Enterprise RBAC Inspection
    if (url.pathname === "/api/admin/roles" && req.method === "GET") {
      const roles: EnterpriseRole[] = [
        "super_admin",
        "tenant_admin",
        "power_user",
        "member",
        "guest",
      ];
      return Response.json({
        roles: roles.map((r) => ({
          role: r,
          level: rbacEngine.getRoleLevel(r),
          allowedTiers: rbacEngine.listAllowedModelTiers(r),
        })),
        defaultRole: config.defaultRole,
      });
    }

    // ForwardAuth verification endpoint (called by Traefik / Ingress)
    if (url.pathname === "/auth" || url.pathname === "/verify") {
      const result = await authMediator.verifyAndEnrich(req.headers);

      if (result.authenticated) {
        authSuccessCount++;
        return new Response(null, {
          status: 200,
          headers: result.headers,
        });
      } else {
        authFailureCount++;
        return Response.json(
          { error: result.error || "Unauthorized" },
          {
            status: result.status,
            headers: result.headers,
          }
        );
      }
    }

    return Response.json({ error: "Endpoint not found" }, { status: 404 });
  },
});

logger.info(`Server listening on http://0.0.0.0:${server.port}`);

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, closing resources...");
  provisioner.close();
  server.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Received SIGINT, closing resources...");
  provisioner.close();
  server.stop();
  process.exit(0);
});
