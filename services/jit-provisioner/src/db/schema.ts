/**
 * SQLite Schema definitions for Llumen
 * Matches Llumen backend SeaORM entity: `user`
 * Includes CISO security blocklist table
 */

export const INIT_USER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  preference TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS "idx-user-name" ON user (name);

CREATE TABLE IF NOT EXISTS security_blocklist (
  username TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  blocked_by TEXT NOT NULL,
  blocked_at TEXT NOT NULL
);
`;

export const FIND_USER_BY_NAME_SQL = `
SELECT id, name, password, preference FROM user WHERE name = ? LIMIT 1;
`;

export const INSERT_USER_SQL = `
INSERT INTO user (name, password, preference) VALUES (?, ?, ?);
`;

export const DELETE_USER_SQL = `
DELETE FROM user WHERE name = ?;
`;

export const LIST_USERS_SQL = `
SELECT id, name, password, preference FROM user ORDER BY id ASC;
`;

export const INSERT_BLOCKLIST_SQL = `
INSERT OR REPLACE INTO security_blocklist (username, reason, blocked_by, blocked_at) VALUES (?, ?, ?, ?);
`;

export const FIND_BLOCKLIST_SQL = `
SELECT username, reason, blocked_by as blockedBy, blocked_at as blockedAt FROM security_blocklist WHERE username = ? LIMIT 1;
`;

export const DELETE_BLOCKLIST_SQL = `
DELETE FROM security_blocklist WHERE username = ?;
`;

export const LIST_BLOCKLIST_SQL = `
SELECT username, reason, blocked_by as blockedBy, blocked_at as blockedAt FROM security_blocklist ORDER BY blocked_at DESC;
`;
