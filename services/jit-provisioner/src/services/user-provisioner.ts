import type { IUserProvisioner, LlumenUser, ProvisionResult, AppConfig } from "../types/index.ts";
import { SqliteClient } from "../db/sqlite.ts";
import { Logger } from "../utils/logger.ts";

/**
 * Enterprise JIT User Provisioner implementation.
 * Implements EIP Content Enricher pattern and SCIM user de-provisioning.
 */
export class UserProvisioner implements IUserProvisioner {
  private db: SqliteClient;
  private config: AppConfig;
  private logger: Logger;

  constructor(db: SqliteClient, config: AppConfig, logger: Logger) {
    this.db = db;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Generates a non-guessable synthetic argon2id-like hash for SSO accounts.
   * Prevents password attacks on local table while authenticating purely via IdP.
   */
  private generateSyntheticPasswordHash(): string {
    const randomHex = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    return `$argon2id$v=19$m=65536,t=3,p=4$sso_${randomHex.slice(0, 16)}$${randomHex}`;
  }

  /**
   * Sanitizes and normalizes enterprise usernames (e.g. NIP 18 digits or email).
   */
  public sanitizeUsername(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error("Username cannot be empty");
    }
    // Remove control characters and whitespace
    return trimmed.replace(/[\x00-\x1F\x7F]/g, "");
  }

  async ensureUser(rawUsername: string): Promise<ProvisionResult> {
    const username = this.sanitizeUsername(rawUsername);

    // 1. Check existing record
    const existing = this.db.findUserByName(username);
    if (existing) {
      this.logger.debug("Existing enterprise user verified", { username, id: existing.id });
      return { user: existing, isNew: false };
    }

    // 2. Provision new user if auto-provisioning is allowed
    if (!this.config.autoProvision) {
      this.logger.warn("User does not exist and JIT auto-provisioning is disabled", { username });
      throw new Error(`User '${username}' not authorized and auto-provisioning is disabled`);
    }

    this.logger.info("JIT Auto-provisioning new enterprise user into Llumen", { username });
    const dummyHash = this.generateSyntheticPasswordHash();
    const newUser = this.db.insertUser(username, dummyHash, this.config.defaultPreference);

    this.logger.info("Enterprise user successfully provisioned in SQLite", {
      username,
      userId: newUser.id,
    });

    return { user: newUser, isNew: true };
  }

  async getUser(username: string): Promise<LlumenUser | null> {
    const sanitized = this.sanitizeUsername(username);
    return this.db.findUserByName(sanitized);
  }

  async deactivateUser(username: string): Promise<boolean> {
    const sanitized = this.sanitizeUsername(username);
    this.logger.warn("Deactivating/De-provisioning user from Llumen database", { username: sanitized });
    return this.db.deleteUser(sanitized);
  }

  async listUsers(): Promise<LlumenUser[]> {
    return this.db.listUsers();
  }

  close(): void {
    this.db.close();
  }
}
