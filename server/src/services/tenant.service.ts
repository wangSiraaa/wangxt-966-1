import { db } from '../database';
import { Tenant, Vehicle } from '../types';
import { generateId, now, auditLog } from '../utils';

export class TenantService {
  static getAll(params?: { keyword?: string; blacklisted?: boolean }): Tenant[] {
    let sql = 'SELECT * FROM tenants WHERE 1=1';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.keyword) {
      conditions.push('(name LIKE ? OR phone LIKE ?)');
      values.push(`%${params.keyword}%`, `%${params.keyword}%`);
    }
    if (params?.blacklisted !== undefined) {
      conditions.push('is_blacklisted = ?');
      values.push(params.blacklisted ? 1 : 0);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const stmt = db.prepare(sql);
    return stmt.all(...values) as Tenant[];
  }

  static getById(id: string): Tenant | undefined {
    const stmt = db.prepare('SELECT * FROM tenants WHERE id = ?');
    return stmt.get(id) as Tenant | undefined;
  }

  static getByPhone(phone: string): Tenant | undefined {
    const stmt = db.prepare('SELECT * FROM tenants WHERE phone = ?');
    return stmt.get(phone) as Tenant | undefined;
  }

  static create(data: Partial<Tenant>): Tenant {
    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO tenants (id, name, phone, id_card, address, is_blacklisted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.name,
      data.phone,
      data.id_card || null,
      data.address || null,
      data.is_blacklisted || 0,
      time,
      time
    );
    auditLog('admin', 'create', 'tenant', id, null, data, '创建租户');
    return this.getById(id)!;
  }

  static update(id: string, data: Partial<Tenant>): Tenant | undefined {
    const before = this.getById(id);
    if (!before) return undefined;

    const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at');
    if (fields.length === 0) return before;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (data as any)[f]);
    values.push(now(), id);

    const stmt = db.prepare(`UPDATE tenants SET ${setClause}, updated_at = ? WHERE id = ?`);
    stmt.run(...values);

    const after = this.getById(id);
    auditLog('admin', 'update', 'tenant', id, before, after, '更新租户');
    return after;
  }

  static addToBlacklist(id: string, reason: string): Tenant | undefined {
    const tenant = this.getById(id);
    if (!tenant) return undefined;
    if (tenant.is_blacklisted) return tenant;

    return this.update(id, { is_blacklisted: 1, blacklist_reason: reason } as any);
  }

  static removeFromBlacklist(id: string): Tenant | undefined {
    const tenant = this.getById(id);
    if (!tenant) return undefined;
    if (!tenant.is_blacklisted) return tenant;

    return this.update(id, { is_blacklisted: 0, blacklist_reason: null } as any);
  }

  static delete(id: string): boolean {
    const before = this.getById(id);
    const stmt = db.prepare('DELETE FROM tenants WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'tenant', id, before, null, '删除租户');
    }
    return result.changes > 0;
  }

  static getVehicles(tenantId: string): Vehicle[] {
    const stmt = db.prepare('SELECT * FROM vehicles WHERE tenant_id = ? ORDER BY created_at DESC');
    return stmt.all(tenantId) as Vehicle[];
  }
}
