const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'parking.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

async function initDatabase() {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS parking_spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_no TEXT NOT NULL UNIQUE,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      is_frozen INTEGER NOT NULL DEFAULT 0,
      freeze_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_no TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      license_plate TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS leases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lease_no TEXT NOT NULL UNIQUE,
      tenant_id INTEGER NOT NULL,
      space_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      monthly_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      is_expired_recycled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (space_id) REFERENCES parking_spaces(id)
    );

    CREATE TABLE IF NOT EXISTS renewal_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_no TEXT NOT NULL UNIQUE,
      lease_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      space_id INTEGER NOT NULL,
      months INTEGER NOT NULL,
      renewal_amount REAL NOT NULL,
      new_end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      submit_time TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      processed_time TEXT,
      reject_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (lease_id) REFERENCES leases(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (space_id) REFERENCES parking_spaces(id)
    );

    CREATE TABLE IF NOT EXISTS arrears_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT NOT NULL UNIQUE,
      tenant_id INTEGER NOT NULL,
      lease_id INTEGER,
      space_id INTEGER,
      amount REAL NOT NULL,
      arrears_type TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'unsettled',
      due_date TEXT,
      settled_amount REAL NOT NULL DEFAULT 0,
      settled_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (lease_id) REFERENCES leases(id),
      FOREIGN KEY (space_id) REFERENCES parking_spaces(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT NOT NULL UNIQUE,
      tenant_id INTEGER NOT NULL,
      lease_id INTEGER,
      arrears_id INTEGER,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      remark TEXT,
      operator TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (lease_id) REFERENCES leases(id),
      FOREIGN KEY (arrears_id) REFERENCES arrears_records(id)
    );
  `);

  console.log('数据库初始化完成');
  return db;
}

function prepare(sql) {
  return {
    async get(...params) {
      return db.get(sql, ...params);
    },
    async all(...params) {
      return db.all(sql, ...params);
    },
    async run(...params) {
      const stmt = await db.run(sql, ...params);
      return {
        changes: stmt.changes,
        lastInsertRowid: stmt.lastID
      };
    }
  };
}

async function exec(sql) {
  return db.exec(sql);
}

async function transaction(fn) {
  try {
    await db.run('BEGIN');
    const result = await fn({ prepare, run: (s, p) => prepare(s).run(p), all: (s, p) => prepare(s).all(p), get: (s, p) => prepare(s).get(p) });
    await db.run('COMMIT');
    return result;
  } catch (e) {
    await db.run('ROLLBACK');
    throw e;
  }
}

module.exports = {
  initDatabase,
  prepare,
  exec,
  transaction,
  getDb: () => db
};
