import type { IBlocklistService, BlockedUserEntry } from "../types/index.ts";
import { SqliteClient } from "../db/sqlite.ts";
import { Logger } from "../utils/logger.ts";

/**
 * Enterprise CISO Blocklist & Emergency Killswitch Service.
 * Allows SOC / CISO teams to instantly revoke individual access.
 */
export class BlocklistService implements IBlocklistService {
  private db: SqliteClient;
  private logger: Logger;

  constructor(db: SqliteClient, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  isBlocked(username: string): boolean {
    const blocked = this.db.isUserBlocked(username);
    if (blocked) {
      this.logger.warn("Access attempt by blocked user", { username });
    }
    return blocked;
  }

  blockUser(username: string, reason: string, admin: string): void {
    this.logger.warn("Blocking user via CISO Security Action", { username, reason, admin });
    this.db.blockUser(username, reason, admin);
  }

  unblockUser(username: string): boolean {
    this.logger.info("Unblocking user via CISO Action", { username });
    return this.db.unblockUser(username);
  }

  listBlocked(): BlockedUserEntry[] {
    return this.db.listBlockedUsers();
  }
}
