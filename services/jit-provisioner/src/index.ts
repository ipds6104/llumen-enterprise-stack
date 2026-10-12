import { loadConfig } from "./config.ts";
import { Logger } from "./utils/logger.ts";
import { SqliteClient } from "./db/sqlite.ts";
import { UserProvisioner } from "./services/user-provisioner.ts";
import { ForwardAuthMediator } from "./services/forward-auth.ts";

const config = loadConfig();
const logger = new Logger(config.logLevel);

logger.info("Initializing Llumen Enterprise JIT Provisioner Service", {
  port: config.port,
  sqlitePath: config.sqlitePath,
  authGateway: config.authGatewayUrl,
  autoProvision: config.autoProvision,
});

// Dependency Injection (SOLID DIP)
const db = new SqliteClient(config.sqlitePath, logger);
const provisioner = new UserProvisioner(db, config, logger);
const authMediator = new ForwardAuthMediator(provisioner, config, logger);

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
        autoProvision: config.autoProvision,
        timestamp: new Date().toISOString(),
      });
    }

    // Metrics endpoint
    if (url.pathname === "/metrics") {
      const users = await provisioner.listUsers();
      return Response.json({
        auth_success_total: authSuccessCount,
        auth_failure_total: authFailureCount,
        total_provisioned_users: users.length,
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

// Graceful shutdown handling
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
