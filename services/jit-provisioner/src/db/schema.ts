/**
 * SQLite Schema definitions for Llumen
 * Matches Llumen backend SeaORM entity: `user`
 */

export const INIT_USER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  preference TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS "idx-user-name" ON user (name);
`;

export const FIND_USER_BY_NAME_SQL = `
SELECT id, name, password, preference FROM user WHERE name = ? LIMIT 1;
`;

export const INSERT_USER_SQL = `
INSERT INTO user (name, password, preference) VALUES (?, ?, ?);
`;

export const LIST_USERS_SQL = `
SELECT id, name, password, preference FROM user ORDER BY id ASC;
`;
