import sqlite3 from "sqlite3";
import path from "path";
import crypto from "crypto";
import { logger } from "./logger";

// Initialize the database connection
const dbPath = path.resolve(process.cwd(), "local.db");
const db = new sqlite3.Database(dbPath);



// Pure JS Password Hashing using Node's standard crypto library
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === originalHash;
}

// Promise-based wrappers for sqlite3
export function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export function queryOne<T>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  });
}

export function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Database schema setup
export async function initDatabase() {
  logger.info(`Initializing database at: ${dbPath}`);

  // 1. Create Users Table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add username column if not exists (migration for existing DBs)
  await run(`ALTER TABLE users ADD COLUMN username TEXT`).catch(() => {});
  await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

  // 2. Create Chats Table
  await run(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 3. Create Messages Table
  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      file_name TEXT,
      file_type TEXT,
      file_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )
  `);
  // Migration: add file_data to existing databases
  await run(`ALTER TABLE messages ADD COLUMN file_data TEXT`).catch(() => {});

  // 4. Create Shelf Table
  await run(`
    CREATE TABLE IF NOT EXISTS shelf_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      item_type TEXT NOT NULL,
      data TEXT NOT NULL,
      size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 5. Create Settings Table
  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Seed default model settings
  await run("INSERT OR IGNORE INTO settings (key, value) VALUES ('gemini_model', 'gemini-2.0-flash')");
  await run("INSERT OR IGNORE INTO settings (key, value) VALUES ('claude_model', 'claude-3-5-sonnet-latest')");

  // 6. Seed admin from env vars
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    logger.error("ADMIN_EMAIL and ADMIN_PASSWORD env vars not set — skipping admin seed.");
  } else {
    const existingAdmin = await queryOne<{ id: number }>(
      "SELECT id FROM users WHERE email = ?",
      [adminEmail]
    );
    if (!existingAdmin) {
      const hash = hashPassword(adminPassword);
      await run(
        "INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, ?, ?)",
        [adminEmail, hash, "admin", "active"]
      );
      logger.info(`Admin user seeded: ${adminEmail}`);
    } else {
      logger.debug(`Admin user already exists: ${adminEmail}`);
    }
  }
}
