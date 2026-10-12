import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SqliteClient } from "../src/db/sqlite.ts";
import { UserProvisioner } from "../src/services/user-provisioner.ts";
import { BlocklistService } from "../src/services/blocklist.ts";
import { SecurityAuditLogger } from "../src/services/audit-logger.ts";
import { HierarchicalRbacEngine } from "../src/services/rbac-engine.ts";
import { ForwardAuthMediator } from "../src/services/forward-auth.ts";
import { Logger } from "../src/utils/logger.ts";
import type { AppConfig } from "../src/types/index.ts";
import { unlinkSync, existsSync } from "node:fs";

const TEST_DB = "/tmp/test_forward_auth.sqlite";

describe("ForwardAuthMediator (EIP Message Translator & CISO Controls)", () => {
  let db: SqliteClient;
  let provisioner: UserProvisioner;
  let blocklist: BlocklistService;
  let auditLogger: SecurityAuditLogger;
  let rbacEngine: HierarchicalRbacEngine;
  let mediator: ForwardAuthMediator;
  const logger = new Logger("error");

  const mockConfig: AppConfig = {
    port: 3001,
    sqlitePath: TEST_DB,
    authGatewayUrl: "http://localhost:4180",
    trustedHeader: "X-Forwarded-User",
    autoProvision: true,
    defaultPreference: "{}",
    defaultRole: "member",
    logLevel: "error",
    allowedGroups: [],
    allowedTenants: [],
    killswitchEnabled: false,
  };

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = new SqliteClient(TEST_DB, logger);
    provisioner = new UserProvisioner(db, mockConfig, logger);
    blocklist = new BlocklistService(db, logger);
    auditLogger = new SecurityAuditLogger();
    rbacEngine = new HierarchicalRbacEngine(mockConfig.defaultRole);
    mediator = new ForwardAuthMediator(
      provisioner,
      blocklist,
      auditLogger,
      rbacEngine,
      mockConfig,
      logger
    );
  });

  afterEach(() => {
    provisioner.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it("authenticates and enriches request with X-Auth-Request-User and RBAC headers", async () => {
    const headers = new Headers();
    headers.set("x-auth-request-user", "199503112022031001");
    headers.set("x-auth-request-email", "pegawai@bps.go.id");
    headers.set("x-auth-request-groups", "pegawai");

    const result = await mediator.verifyAndEnrich(headers);

    expect(result.authenticated).toBe(true);
    expect(result.status).toBe(200);
    expect(result.headers["X-Forwarded-User"]).toBe("199503112022031001");
    expect(result.headers["X-Forwarded-Email"]).toBe("pegawai@bps.go.id");
    expect(result.headers["X-User-Provisioned"]).toBe("true");
    expect(result.headers["X-Forwarded-Role"]).toBe("member");
    expect(result.headers["X-User-Role-Level"]).toBe("2");
    expect(result.headers["X-Forwarded-Tier"]).toContain("tier_standard");

    const userInDb = await provisioner.getUser("199503112022031001");
    expect(userInDb).not.toBeNull();
    expect(userInDb?.name).toBe("199503112022031001");
  });

  it("returns 401 when request lacks all authentication headers", async () => {
    const headers = new Headers();
    const result = await mediator.verifyAndEnrich(headers);

    expect(result.authenticated).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain("Unauthenticated");
  });

  it("blocks user revoked in security blocklist with 403 Forbidden", async () => {
    const revokedUser = "compromised_employee";
    blocklist.blockUser(revokedUser, "Security incident #1234", "soc_lead");

    const headers = new Headers();
    headers.set("x-auth-request-user", revokedUser);

    const result = await mediator.verifyAndEnrich(headers);
    expect(result.authenticated).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain("revoked by Enterprise Security");
  });

  it("enforces RBAC group constraints (allowedGroups)", async () => {
    const rbacConfig: AppConfig = { ...mockConfig, allowedGroups: ["6104", "super_admin"] };
    const rbacMediator = new ForwardAuthMediator(
      provisioner,
      blocklist,
      auditLogger,
      rbacEngine,
      rbacConfig,
      logger
    );

    // 1. User with unauthorized group -> 403
    const badHeaders = new Headers();
    badHeaders.set("x-auth-request-user", "user_satker_other");
    badHeaders.set("x-auth-request-groups", "satker_6101,operator");

    const badResult = await rbacMediator.verifyAndEnrich(badHeaders);
    expect(badResult.authenticated).toBe(false);
    expect(badResult.status).toBe(403);
    expect(badResult.error).toContain("not authorized in required enterprise RBAC group");

    // 2. User with authorized group -> 200
    const goodHeaders = new Headers();
    goodHeaders.set("x-auth-request-user", "199503112022031001");
    goodHeaders.set("x-auth-request-groups", "satker_6104,6104");

    const goodResult = await rbacMediator.verifyAndEnrich(goodHeaders);
    expect(goodResult.authenticated).toBe(true);
    expect(goodResult.status).toBe(200);
  });

  it("denies access when member tries to execute reasoning model without clearance", async () => {
    const headers = new Headers();
    headers.set("x-auth-request-user", "standard_employee");
    headers.set("x-auth-request-groups", "member");
    headers.set("x-requested-model", "deepseek-r1");

    const result = await mediator.verifyAndEnrich(headers);
    expect(result.authenticated).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain("lacks clearance for model 'deepseek-r1'");
  });

  it("permits access when power_user/developer executes reasoning model", async () => {
    const headers = new Headers();
    headers.set("x-auth-request-user", "ai_developer");
    headers.set("x-auth-request-groups", "developer"); // alias of power_user
    headers.set("x-requested-model", "deepseek-r1");

    const result = await mediator.verifyAndEnrich(headers);
    expect(result.authenticated).toBe(true);
    expect(result.status).toBe(200);
    expect(result.headers["X-Forwarded-Role"]).toBe("power_user");
    expect(result.headers["X-User-Role-Level"]).toBe("3");
  });

  it("triggers emergency killswitch with 503 Service Unavailable", async () => {
    const killswitchConfig: AppConfig = { ...mockConfig, killswitchEnabled: true };
    const ksMediator = new ForwardAuthMediator(
      provisioner,
      blocklist,
      auditLogger,
      rbacEngine,
      killswitchConfig,
      logger
    );

    const headers = new Headers();
    headers.set("x-auth-request-user", "199503112022031001");

    const result = await ksMediator.verifyAndEnrich(headers);
    expect(result.authenticated).toBe(false);
    expect(result.status).toBe(503);
    expect(result.error).toContain("Emergency AI Gateway Killswitch Active");
  });
});
