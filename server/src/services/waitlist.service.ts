import { db } from '../database';
import { WaitlistEntry } from '../types';
import { generateId, now, today, auditLog } from '../utils';
import { TenantService } from './tenant.service';
import { VehicleService } from './vehicle.service';
import { ParkingSpaceService } from './parkingSpace.service';
import { LeaseService } from './lease.service';

export class WaitlistService {
  static getAll(params?: { status?: string; tenant_id?: string; page?: number; pageSize?: number }): { list: WaitlistEntry[]; total: number } {
    let countSql = 'SELECT COUNT(*) as count FROM waitlist WHERE 1=1';
    let dataSql = 'SELECT * FROM waitlist WHERE 1=1';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.status) {
      conditions.push('status = ?');
      values.push(params.status);
    }
    if (params?.tenant_id) {
      conditions.push('tenant_id = ?');
      values.push(params.tenant_id);
    }

    const whereClause = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
    countSql += whereClause;
    dataSql += whereClause + ' ORDER BY priority DESC, created_at ASC';

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    dataSql += ` LIMIT ${pageSize} OFFSET ${offset}`;

    const countStmt = db.prepare(countSql);
    const total = (countStmt.get(...values) as any).count;

    const dataStmt = db.prepare(dataSql);
    const list = dataStmt.all(...values) as WaitlistEntry[];

    return { list, total };
  }

  static getById(id: string): WaitlistEntry | undefined {
    const stmt = db.prepare('SELECT * FROM waitlist WHERE id = ?');
    return stmt.get(id) as WaitlistEntry | undefined;
  }

  static getWaitingList(): WaitlistEntry[] {
    const stmt = db.prepare("SELECT * FROM waitlist WHERE status = 'waiting' ORDER BY priority DESC, created_at ASC");
    return stmt.all() as WaitlistEntry[];
  }

  static create(data: {
    tenant_id: string;
    vehicle_id: string;
    preferred_type?: string;
    preferred_location?: string;
    priority?: number;
    remark?: string;
  }): { success: boolean; entry?: WaitlistEntry; message?: string } {
    const tenant = TenantService.getById(data.tenant_id);
    if (!tenant) {
      return { success: false, message: '租户不存在' };
    }
    if (tenant.is_blacklisted) {
      return { success: false, message: '租户在黑名单中，无法加入候补' };
    }

    const vehicle = VehicleService.getById(data.vehicle_id);
    if (!vehicle) {
      return { success: false, message: '车辆不存在' };
    }
    if (vehicle.tenant_id !== data.tenant_id) {
      return { success: false, message: '车辆不属于该租户' };
    }

    const existingStmt = db.prepare("SELECT id FROM waitlist WHERE tenant_id = ? AND vehicle_id = ? AND status = 'waiting'");
    const existing = existingStmt.get(data.tenant_id, data.vehicle_id);
    if (existing) {
      return { success: false, message: '该租户的该车辆已在候补列表中' };
    }

    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO waitlist (id, tenant_id, vehicle_id, preferred_type, preferred_location, status, priority, remark, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.tenant_id,
      data.vehicle_id,
      data.preferred_type || null,
      data.preferred_location || null,
      data.priority || 0,
      data.remark || null,
      time,
      time
    );

    auditLog('admin', 'create', 'waitlist', id, null, data, '创建候补');

    return { success: true, entry: this.getById(id)! };
  }

  static cancel(id: string): { success: boolean; entry?: WaitlistEntry; message?: string } {
    const entry = this.getById(id);
    if (!entry) {
      return { success: false, message: '候补记录不存在' };
    }
    if (entry.status !== 'waiting') {
      return { success: false, message: '只能取消等待中的候补记录' };
    }

    const time = now();
    const stmt = db.prepare("UPDATE waitlist SET status = 'cancelled', updated_at = ? WHERE id = ?");
    stmt.run(time, id);

    const after = this.getById(id);
    auditLog('admin', 'cancel', 'waitlist', id, entry, after, '取消候补');

    return { success: true, entry: after! };
  }

  static assignSpace(id: string, spaceId: string): { success: boolean; entry?: WaitlistEntry; message?: string } {
    const entry = this.getById(id);
    if (!entry) {
      return { success: false, message: '候补记录不存在' };
    }
    if (entry.status !== 'waiting') {
      return { success: false, message: '只能为等待中的候补记录分配车位' };
    }

    const space = ParkingSpaceService.getById(spaceId);
    if (!space) {
      return { success: false, message: '车位不存在' };
    }
    if (space.status !== 'available') {
      return { success: false, message: '车位不可用' };
    }

    const leaseResult = LeaseService.create({
      space_id: spaceId,
      tenant_id: entry.tenant_id,
      vehicle_id: entry.vehicle_id,
      start_date: today(),
      end_date: '',
      monthly_price: 0,
      remark: '候补自动分配',
    });

    if (!leaseResult.success) {
      return { success: false, message: leaseResult.message || '创建租约失败' };
    }

    const time = now();
    const stmt = db.prepare("UPDATE waitlist SET status = 'assigned', assigned_space_id = ?, assigned_at = ?, updated_at = ? WHERE id = ?");
    stmt.run(spaceId, time, time, id);

    const after = this.getById(id);
    auditLog('admin', 'assign', 'waitlist', id, entry, after, `候补分配车位: ${spaceId}`);

    return { success: true, entry: after! };
  }

  static autoAssign(): number {
    const waitingList = this.getWaitingList();
    let count = 0;

    for (const entry of waitingList) {
      let availableSpaces = ParkingSpaceService.getAvailableSpaces();

      if (entry.preferred_type) {
        availableSpaces = availableSpaces.filter(s => s.type === entry.preferred_type);
      }
      if (entry.preferred_location) {
        availableSpaces = availableSpaces.filter(s => s.location === entry.preferred_location);
      }

      if (availableSpaces.length === 0) continue;

      const result = this.assignSpace(entry.id, availableSpaces[0].id);
      if (result.success) {
        count++;
      }
    }

    if (count > 0) {
      auditLog('system', 'auto_assign', 'waitlist', undefined, undefined, { count }, `自动分配${count}个候补`);
    }

    return count;
  }

  static delete(id: string): boolean {
    const entry = this.getById(id);
    if (!entry) return false;

    if (entry.status !== 'cancelled') {
      return false;
    }

    const stmt = db.prepare('DELETE FROM waitlist WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'waitlist', id, entry, null, '删除候补记录');
    }
    return result.changes > 0;
  }
}
