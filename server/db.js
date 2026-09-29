/**
 * Database - SQLite (built into Node 22+) with one file per install.
 *
 * Every ticket belongs to a company, and every query in the API filters by
 * the logged-in user's company_id, so companies only ever see their own data.
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), 'data')
const dbPath = process.env.DB_PATH || join(dataDir, 'relay.db')

if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true })

export const db = new DatabaseSync(dbPath)

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS companies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Users log in to the portal. Every user can also be assigned as a responder.
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Only a SHA-256 of the session token is stored, never the token itself.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    message             TEXT NOT NULL,
    category            TEXT NOT NULL,
    urgency             TEXT NOT NULL CHECK (urgency IN ('High', 'Medium', 'Low')),
    recommended_action  TEXT,
    reasoning           TEXT,
    status              TEXT NOT NULL DEFAULT 'Open'
                        CHECK (status IN ('Open', 'Pending', 'Resolved')),
    responder_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolution          TEXT,
    created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    resolved_at         TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets(company_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
`)
