import { db } from '../database';
import { Vehicle, Tenant } from '../types';
import { generateId, now, auditLog } from '../utils';

export class VehicleService {
  static getAll(params?: { tenant_id?: string; plate_no?: string; is_family?: boolean }): Vehicle[] {
    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.tenant_id) {
      conditions.push('tenant_id = ?');
      values.push(params.tenant_id);
    }
    if (params?.plate_no) {
      conditions.push('plate_no LIKE ?');
      values.push(`%${params.plate_no}%`);
    }
    if (params?.is_family !== undefined) {
      conditions.push('is_family = ?');
      values.push(params.is_family ? 1 : 0);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const stmt = db.prepare(sql);
    return stmt.all(...values) as Vehicle[];
  }

  static getById(id: string): Vehicle | undefined {
    const stmt = db.prepare('SELECT * FROM vehicles WHERE id = ?');
    return stmt.get(id) as Vehicle | undefined;
  }

  static getByPlateNo(plateNo: string): Vehicle | undefined {
    const stmt = db.prepare('SELECT * FROM vehicles WHERE plate_no = ?');
    return stmt.get(plateNo) as Vehicle | undefined;
  }

  static create(data: Partial<Vehicle>): Vehicle {
    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO vehicles (id, tenant_id, plate_no, plate_color, vehicle_type, is_family, is_whitelisted, remark, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.tenant_id,
      data.plate_no,
      data.plate_color || 'blue',
      data.vehicle_type || 'sedan',
      data.is_family || 0,
      data.is_whitelisted !== undefined ? data.is_whitelisted : 1,
      data.remark || null,
      time,
      time
    );
    auditLog('admin', 'create', 'vehicle', id, null, data, '添加车辆');
    return this.getById(id)!;
  }

  static update(id: string, data: Partial<Vehicle>): Vehicle | undefined {
    const before = this.getById(id);
    if (!before) return undefined;

    const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at' && k !== 'tenant_id');
    if (fields.length === 0) return before;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (data as any)[f]);
    values.push(now(), id);

    const stmt = db.prepare(`UPDATE vehicles SET ${setClause}, updated_at = ? WHERE id = ?`);
    stmt.run(...values);

    const after = this.getById(id);
    auditLog('admin', 'update', 'vehicle', id, before, after, '更新车辆');
    return after;
  }

  static setWhitelist(id: string, whitelisted: boolean): Vehicle | undefined {
    return this.update(id, { is_whitelisted: whitelisted ? 1 : 0 } as any);
  }

  static setFamily(id: string, isFamily: boolean): Vehicle | undefined {
    return this.update(id, { is_family: isFamily ? 1 : 0 } as any);
  }

  static delete(id: string): boolean {
    const before = this.getById(id);
    const stmt = db.prepare('DELETE FROM vehicles WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'vehicle', id, before, null, '删除车辆');
    }
    return result.changes > 0;
  }

  static getTenant(id: string): Tenant | undefined {
    const vehicle = this.getById(id);
    if (!vehicle) return undefined;
    const stmt = db.prepare('SELECT * FROM tenants WHERE id = ?');
    return stmt.get(vehicle.tenant_id) as Tenant | undefined;
  }
}
