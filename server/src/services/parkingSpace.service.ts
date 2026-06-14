import { db } from '../database';
import { ParkingSpace } from '../types';
import { generateId, now, auditLog } from '../utils';
import { LifecycleService } from './lifecycle.service';

export class ParkingSpaceService {
  static getAll(params?: { status?: string; type?: string; keyword?: string }): ParkingSpace[] {
    let sql = 'SELECT * FROM parking_spaces WHERE 1=1';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.status) {
      conditions.push('status = ?');
      values.push(params.status);
    }
    if (params?.type) {
      conditions.push('type = ?');
      values.push(params.type);
    }
    if (params?.keyword) {
      conditions.push('(code LIKE ? OR location LIKE ?)');
      values.push(`%${params.keyword}%`, `%${params.keyword}%`);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY code';

    const stmt = db.prepare(sql);
    return stmt.all(...values) as ParkingSpace[];
  }

  static getById(id: string): ParkingSpace | undefined {
    const stmt = db.prepare('SELECT * FROM parking_spaces WHERE id = ?');
    return stmt.get(id) as ParkingSpace | undefined;
  }

  static getByCode(code: string): ParkingSpace | undefined {
    const stmt = db.prepare('SELECT * FROM parking_spaces WHERE code = ?');
    return stmt.get(code) as ParkingSpace | undefined;
  }

  static create(data: Partial<ParkingSpace>): ParkingSpace {
    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO parking_spaces (id, code, location, type, status, lock_status, temp_occupied, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.code,
      data.location || null,
      data.type || 'standard',
      data.status || 'available',
      data.lock_status || 'unlocked',
      data.temp_occupied || 0,
      time,
      time
    );
    auditLog('admin', 'create', 'parking_space', id, null, data, '创建车位');
    LifecycleService.addSpaceLifecycleEvent(id, 'space_created', { code: data.code, type: data.type, location: data.location }, undefined, undefined, 'admin', '车位创建入库');
    return this.getById(id)!;
  }

  static update(id: string, data: Partial<ParkingSpace>): ParkingSpace | undefined {
    const before = this.getById(id);
    if (!before) return undefined;

    const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at');
    if (fields.length === 0) return before;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (data as any)[f]);
    values.push(now(), id);

    const stmt = db.prepare(`UPDATE parking_spaces SET ${setClause}, updated_at = ? WHERE id = ?`);
    stmt.run(...values);

    const after = this.getById(id);
    auditLog('admin', 'update', 'parking_space', id, before, after, '更新车位');
    return after;
  }

  static freeze(id: string, reason: string): ParkingSpace | undefined {
    const space = this.getById(id);
    if (!space) return undefined;
    if (space.status === 'frozen') return space;

    const result = this.update(id, { status: 'frozen', frozen_reason: reason } as any);
    LifecycleService.addSpaceLifecycleEvent(id, 'space_frozen', { reason }, undefined, undefined, 'admin', `车位冻结: ${reason}`);
    return result;
  }

  static unfreeze(id: string): ParkingSpace | undefined {
    const space = this.getById(id);
    if (!space) return undefined;
    if (space.status !== 'frozen') return space;

    const result = this.update(id, { status: 'available', frozen_reason: null } as any);
    LifecycleService.addSpaceLifecycleEvent(id, 'space_unfrozen', {}, undefined, undefined, 'admin', '车位解冻');
    return result;
  }

  static setLock(id: string, lockStatus: 'locked' | 'unlocked'): ParkingSpace | undefined {
    return this.update(id, { lock_status: lockStatus } as any);
  }

  static setTempOccupied(id: string, occupied: boolean): ParkingSpace | undefined {
    return this.update(id, { temp_occupied: occupied ? 1 : 0 } as any);
  }

  static delete(id: string): boolean {
    const before = this.getById(id);
    const stmt = db.prepare('DELETE FROM parking_spaces WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'parking_space', id, before, null, '删除车位');
    }
    return result.changes > 0;
  }

  static getAvailableSpaces(): ParkingSpace[] {
    return this.getAll({ status: 'available' });
  }

  static getPoolStats() {
    const stmt = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM parking_spaces
      GROUP BY status
    `);
    const rows = stmt.all() as any[];
    const stats: any = { total: 0, available: 0, rented: 0, frozen: 0, temporary: 0 };
    rows.forEach(row => {
      stats[row.status] = row.count;
      stats.total += row.count;
    });
    return stats;
  }
}
