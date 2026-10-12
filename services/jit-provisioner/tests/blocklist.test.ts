import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SqliteClient } from "../src/db/sqlite.ts";
import { BlocklistService } from "../src/services/blocklist.ts";
import { Logger } from "../src/utils/logger.ts";
import { unlinkSync, existsSync } from "node:fs";

const TEST_DB = "/tmp/test_blocklist.sqlite";

describe("BlocklistService (CISO Revocation & Emergency Controls)", () => {
  let db: SqliteClient;
  let service: BlocklistService;
  const logger = new Logger("error");

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = new SqliteClient(TEST_DB, logger);
    service = new BlocklistService(db, logger);
  });

  afterEach(() => {
    db.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it("blocks and verifies a compromised user", () => {
    const user = "leaked_nip_199503112022031001";
    expect(service.isBlocked(user)).toBe(false);

    service.blockUser(user, "Credential stuffing detected", "soc_analyst");
    expect(service.isBlocked(user)).toBe(true);

    const list = service.listBlocked();
    expect(list.length).toBe(1);
    expect(list[0].username).toBe(user);
    expect(list[0].reason).toBe("Credential stuffing detected");
    expect(list[0].blockedBy).toBe("soc_analyst");
  });

  it("unblocks a user after security remediation", () => {
    const user = "remediated_employee";
    service.blockUser(user, "Temporary freeze", "ciso");
    expect(service.isBlocked(user)).toBe(true);

    const unblocked = service.unblockUser(user);
    expect(unblocked).toBe(true);
    expect(service.isBlocked(user)).toBe(false);
  });
});
