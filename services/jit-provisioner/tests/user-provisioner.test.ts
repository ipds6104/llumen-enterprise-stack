import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SqliteClient } from "../src/db/sqlite.ts";
import { UserProvisioner } from "../src/services/user-provisioner.ts";
import { Logger } from "../src/utils/logger.ts";
import type { AppConfig } from "../src/types/index.ts";
import { unlinkSync, existsSync } from "node:fs";

const TEST_DB = "/tmp/test_llumen_user.sqlite";

describe("UserProvisioner (EIP Content Enricher)", () => {
  let db: SqliteClient;
  let provisioner: UserProvisioner;
  const logger = new Logger("error");

  const mockConfig: AppConfig = {
    port: 3001,
    sqlitePath: TEST_DB,
    authGatewayUrl: "http://localhost:4180",
    trustedHeader: "X-Forwarded-User",
    autoProvision: true,
    defaultPreference: "{}",
    logLevel: "error",
  };

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = new SqliteClient(TEST_DB, logger);
    provisioner = new UserProvisioner(db, mockConfig, logger);
  });

  afterEach(() => {
    provisioner.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it("provisions a new enterprise user via JIT", async () => {
    const nip = "199503112022031001";
    const result = await provisioner.ensureUser(nip);

    expect(result.isNew).toBe(true);
    expect(result.user.name).toBe(nip);
    expect(result.user.id).toBeGreaterThan(0);
    expect(result.user.password).toContain("$argon2id$");

    // Second call should return existing user without re-inserting
    const secondCall = await provisioner.ensureUser(nip);
    expect(secondCall.isNew).toBe(false);
    expect(secondCall.user.id).toBe(result.user.id);
  });

  it("sanitizes username containing whitespace and control characters", async () => {
    const messyUser = "  199812152021021002\r\n ";
    const result = await provisioner.ensureUser(messyUser);

    expect(result.user.name).toBe("199812152021021002");
  });

  it("throws error when username is empty", async () => {
    expect(provisioner.ensureUser("   ")).rejects.toThrow("Username cannot be empty");
  });

  it("rejects provisioning when autoProvision is disabled", async () => {
    const strictConfig = { ...mockConfig, autoProvision: false };
    const strictProvisioner = new UserProvisioner(db, strictConfig, logger);

    expect(strictProvisioner.ensureUser("unauthorized_user")).rejects.toThrow("auto-provisioning is disabled");
  });
});
