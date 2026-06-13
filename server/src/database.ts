import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'parking.db');

let SQL: SqlJsStatic;
let database: Database | null = null;
let initPromise: Promise<void> | null = null;

class StatementWrapper {
  private stmt: any;
  private sql: string;

  constructor(stmt: any, sql: string) {
    this.stmt = stmt;
    this.sql = sql;
  }

  run(...params: any[]): { changes: number; lastInsertRowid?: number } {
    if (!database) throw new Error('Database not initialized');
    try {
      const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      this.stmt.bind(bindParams);
      this.stmt.step();
    } finally {
      try {
        this.stmt.reset();
      } catch (e) {}
    }
    saveDatabase();
    return { changes: (database as any).getRowsModified() };
  }

  get(...params: any[]): any {
    if (!database) throw new Error('Database not initialized');
    try {
      const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      this.stmt.bind(bindParams);
      if (this.stmt.step()) {
        return this.stmt.getAsObject();
      }
      return undefined;
    } finally {
      try {
        this.stmt.reset();
      } catch (e) {}
    }
  }

  all(...params: any[]): any[] {
    if (!database) throw new Error('Database not initialized');
    const results: any[] = [];
    try {
      const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      this.stmt.bind(bindParams);
      while (this.stmt.step()) {
        results.push(this.stmt.getAsObject());
      }
    } finally {
      try {
        this.stmt.reset();
      } catch (e) {}
    }
    return results;
  }
}

function prepare(sql: string): StatementWrapper {
  if (!database) throw new Error('Database not initialized');
  const stmt = database.prepare(sql);
  return new StatementWrapper(stmt, sql);
}

function exec(sql: string): void {
  if (!database) throw new Error('Database not initialized');
  database.run(sql);
  saveDatabase();
}

function pragma(_sql: string): void {
}

let saveTimeout: NodeJS.Timeout | null = null;

function saveDatabase() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    try {
      if (!database) return;
      const data = database.export();
      const buffer = Buffer.from(data);
      const tmpPath = dbPath + '.tmp';
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, dbPath);
    } catch (e) {
      console.error('Failed to save database:', e);
    }
  }, 100);
}

export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    SQL = await initSqlJs();

    if (fs.existsSync(dbPath)) {
      try {
        const buffer = fs.readFileSync(dbPath);
        database = new SQL.Database(buffer);
      } catch (e) {
        console.error('Failed to load database, creating new one:', e);
        database = new SQL.Database();
      }
    } else {
      database = new SQL.Database();
    }

    database.run(`
      CREATE TABLE IF NOT EXISTS parking_spaces (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        location TEXT,
        type TEXT DEFAULT 'standard',
        status TEXT NOT NULL DEFAULT 'available',
        lock_status TEXT NOT NULL DEFAULT 'unlocked',
        temp_occupied INTEGER NOT NULL DEFAULT 0,
        frozen_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        id_card TEXT,
        address TEXT,
        is_blacklisted INTEGER NOT NULL DEFAULT 0,
        blacklist_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        plate_no TEXT NOT NULL UNIQUE,
        plate_color TEXT DEFAULT 'blue',
        vehicle_type TEXT DEFAULT 'sedan',
        is_family INTEGER NOT NULL DEFAULT 0,
        is_whitelisted INTEGER NOT NULL DEFAULT 1,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS leases (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        monthly_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        contract_status TEXT NOT NULL DEFAULT 'unconfirmed',
        source TEXT DEFAULT 'new',
        parent_lease_id TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (space_id) REFERENCES parking_spaces(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      );

      CREATE INDEX IF NOT EXISTS idx_leases_space ON leases(space_id);
      CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);
      CREATE INDEX IF NOT EXISTS idx_leases_dates ON leases(start_date, end_date);

      CREATE TABLE IF NOT EXISTS arrears (
        id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        amount REAL NOT NULL,
        arrears_type TEXT NOT NULL DEFAULT 'rent',
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unpaid',
        paid_date TEXT,
        age_days INTEGER NOT NULL DEFAULT 0,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (lease_id) REFERENCES leases(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        title TEXT NOT NULL,
        tax_no TEXT,
        amount REAL NOT NULL,
        invoice_type TEXT DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'pending',
        issued_date TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (lease_id) REFERENCES leases(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS space_swaps (
        id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        old_space_id TEXT NOT NULL,
        new_space_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        approver TEXT,
        approve_remark TEXT,
        approved_at TEXT,
        effective_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (lease_id) REFERENCES leases(id),
        FOREIGN KEY (old_space_id) REFERENCES parking_spaces(id),
        FOREIGN KEY (new_space_id) REFERENCES parking_spaces(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS price_tiers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        min_months INTEGER NOT NULL,
        max_months INTEGER,
        discount_rate REAL NOT NULL DEFAULT 1,
        monthly_price REAL,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        operator TEXT NOT NULL,
        action TEXT NOT NULL,
        module TEXT NOT NULL,
        target_id TEXT,
        before_data TEXT,
        after_data TEXT,
        ip TEXT,
        remark TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

      CREATE TABLE IF NOT EXISTS lease_timeline (
        id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT,
        operator TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (lease_id) REFERENCES leases(id)
      );

      CREATE TABLE IF NOT EXISTS fiscal_periods (
        id TEXT PRIMARY KEY,
        period_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        closed_by TEXT,
        closed_at TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS adjustment_orders (
        id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        space_id TEXT NOT NULL,
        order_type TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        fiscal_period_id TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (lease_id) REFERENCES leases(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (space_id) REFERENCES parking_spaces(id)
      );

      CREATE TABLE IF NOT EXISTS waitlist (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        preferred_type TEXT,
        preferred_location TEXT,
        status TEXT NOT NULL DEFAULT 'waiting',
        priority INTEGER NOT NULL DEFAULT 0,
        assigned_space_id TEXT,
        assigned_at TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      );

      CREATE TABLE IF NOT EXISTS space_lifecycle_log (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT,
        lease_id TEXT,
        tenant_id TEXT,
        operator TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (space_id) REFERENCES parking_spaces(id)
      );

      CREATE TABLE IF NOT EXISTS plate_change_logs (
        id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        old_plate_no TEXT NOT NULL,
        new_plate_no TEXT NOT NULL,
        reason TEXT,
        operator TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (lease_id) REFERENCES leases(id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      );

      CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_fiscal_periods_status ON fiscal_periods(status);
      CREATE INDEX IF NOT EXISTS idx_adjustment_orders_lease ON adjustment_orders(lease_id);
      CREATE INDEX IF NOT EXISTS idx_adjustment_orders_type ON adjustment_orders(order_type);
      CREATE INDEX IF NOT EXISTS idx_adjustment_orders_status ON adjustment_orders(status);
      CREATE INDEX IF NOT EXISTS idx_waitlist_tenant ON waitlist(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
      CREATE INDEX IF NOT EXISTS idx_space_lifecycle_space ON space_lifecycle_log(space_id);
      CREATE INDEX IF NOT EXISTS idx_space_lifecycle_time ON space_lifecycle_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_plate_change_lease ON plate_change_logs(lease_id);
    `);

    saveDatabase();
  })();

  return initPromise;
}

export const db = {
  prepare,
  exec,
  pragma,
  getDatabase: () => database,
  save: saveDatabase,
  isInitialized: () => database !== null,
};

export default db;
