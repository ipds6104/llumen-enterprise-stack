import { Database } from "bun:sqlite";
import {
  INIT_USER_TABLE_SQL,
  FIND_USER_BY_NAME_SQL,
  INSERT_USER_SQL,
  LIST_USERS_SQL,
} from "./schema.ts";
import type { LlumenUser } from "../types/index.ts";
import { Logger } from "../utils/logger.ts";

/**
 * Manages SQLite database operations for Llumen data store.
 * Adheres to SOLID Single Responsibility Principle.
 */
export class SqliteClient {
  private db: Database;
  private logger: Logger;

  constructor(dbPath: string, logger: Logger) {
    this.logger = logger;
    this.logger.info(`Opening Llumen SQLite database at ${dbPath}`);
    this.db = new Database(dbPath, { create: true });
    this.initSchema();
  }

  private initSchema(): void {
    try {
      this.db.run("PRAGMA journal_mode = WAL;");
      this.db.run("PRAGMA busy_timeout = 5000;");
      this.db.run(INIT_USER_TABLE_SQL);
      this.logger.debug("SQLite database schema initialized successfully");
    } catch (err) {
      this.logger.error("Failed to initialize SQLite schema", { error: String(err) });
      throw err;
    }
  }

  findUserByName(name: string): LlumenUser | null {
    const query = this.db.query(FIND_USER_BY_NAME_SQL);
    const result = query.get(name) as LlumenUser | null;
    return result || null;
  }

  insertUser(name: string, passwordHash: string, preference: string): LlumenUser {
    const insertQuery = this.db.query(INSERT_USER_SQL);
    insertQuery.run(name, passwordHash, preference);

    const user = this.findUserByName(name);
    if (!user) {
      throw new Error(`Failed to retrieve newly inserted user: ${name}`);
    }
    return user;
  }

  listUsers(): LlumenUser[] {
    const query = this.db.query(LIST_USERS_SQL);
    return query.all() as LlumenUser[];
  }

  close(): void {
    this.db.close();
    this.logger.info("SQLite database connection closed");
  }
}
