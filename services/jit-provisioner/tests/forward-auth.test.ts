import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SqliteClient } from "../src/db/sqlite.ts";
import { UserProvisioner } from "../src/services/user-provisioner.ts";
import { ForwardAuthMediator } from "../src/services/forward-auth.ts";
import { Logger } from "../src/utils/logger.ts";
import type { AppConfig } from "../src/types/index.ts";
import { unlinkSync, existsSync } from "node:fs";

const TEST_DB = "/tmp/test_forward_auth.sqlite";

describe("ForwardAuthMediator (EIP Message Translator)", () => {
  let db: SqliteClient;
  let provisioner: UserProvisioner;
  let mediator: ForwardAuthMediator;
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
    mediator = new ForwardAuthMediator(provisioner, mockConfig, logger);
  });

  afterEach(() => {
    provisioner.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it("authenticates and enriches request with X-Auth-Request-User header", async () => {
    const headers = new Headers();
    headers.set("x-auth-request-user", "199503112022031001");
    headers.set("x-auth-request-email", "pegawai@bps.go.id");

    const result = await mediator.verifyAndEnrich(headers);

    expect(result.authenticated).toBe(true);
    expect(result.status).toBe(200);
    expect(result.headers["X-Forwarded-User"]).toBe("199503112022031001");
    expect(result.headers["X-Forwarded-Email"]).toBe("pegawai@bps.go.id");
    expect(result.headers["X-User-Provisioned"]).toBe("true");

    // Verify user actually exists in database
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
});
