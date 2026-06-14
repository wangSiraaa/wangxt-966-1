import { db } from '../database';
import { SpaceSwap } from '../types';
import { generateId, now, today, auditLog, addLeaseTimeline } from '../utils';
import { LeaseService } from './lease.service';
import { ParkingSpaceService } from './parkingSpace.service';
import { LifecycleService } from './lifecycle.service';

export class SpaceSwapService {
  static getAll(params?: {
    status?: string;
    tenant_id?: string;
    lease_id?: string;
    page?: number;
    pageSize?: number;
  }): { list: SpaceSwap[]; total: number } {
    let countSql = 'SELECT COUNT(*) as count FROM space_swaps WHERE 1=1';
    let dataSql = 'SELECT * FROM space_swaps WHERE 1=1';
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
    if (params?.lease_id) {
      conditions.push('lease_id = ?');
      values.push(params.lease_id);
    }

    const whereClause = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
    countSql += whereClause;
    dataSql += whereClause + ' ORDER BY created_at DESC';

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    dataSql += ` LIMIT ${pageSize} OFFSET ${offset}`;

    const countStmt = db.prepare(countSql);
    const total = (countStmt.get(...values) as any).count;

    const dataStmt = db.prepare(dataSql);
    const list = dataStmt.all(...values) as SpaceSwap[];

    return { list, total };
  }

  static getById(id: string): SpaceSwap | undefined {
    const stmt = db.prepare('SELECT * FROM space_swaps WHERE id = ?');
    return stmt.get(id) as SpaceSwap | undefined;
  }

  static create(data: {
    lease_id: string;
    old_space_id: string;
    new_space_id: string;
    tenant_id: string;
    reason?: string;
    effective_date?: string;
  }): { success: boolean; swap?: SpaceSwap; message?: string } {
    const lease = LeaseService.getById(data.lease_id);
    if (!lease) {
      return { success: false, message: '租约不存在' };
    }
    if (lease.status !== 'active') {
      return { success: false, message: '仅生效租约可申请调换' };
    }

    const newSpace = ParkingSpaceService.getById(data.new_space_id);
    if (!newSpace) {
      return { success: false, message: '目标车位不存在' };
    }
    if (newSpace.status === 'frozen') {
      return { success: false, message: '目标车位已冻结' };
    }
    if (newSpace.status === 'rented') {
      return { success: false, message: '目标车位已被租用' };
    }

    const oldSpace = ParkingSpaceService.getById(data.old_space_id);
    if (!oldSpace || oldSpace.id !== lease.space_id) {
      return { success: false, message: '原车位于租约不符' };
    }

    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO space_swaps (id, lease_id, old_space_id, new_space_id, tenant_id, reason, status, effective_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `);
    stmt.run(
      id,
      data.lease_id,
      data.old_space_id,
      data.new_space_id,
      data.tenant_id,
      data.reason || null,
      data.effective_date || today(),
      time,
      time
    );

    auditLog('admin', 'create', 'space_swap', id, null, data, '申请车位调换');
    addLeaseTimeline(data.lease_id, 'swap_request', { swap_id: id, new_space_id: data.new_space_id }, 'admin', '申请车位调换');
    LifecycleService.addSpaceLifecycleEvent(
      data.old_space_id, 'swap_request',
      { swap_id: id, new_space_id: data.new_space_id, reason: data.reason },
      data.lease_id, data.tenant_id, 'admin', `申请调换至车位`
    );

    return { success: true, swap: this.getById(id)! };
  }

  static approve(id: string, approver: string, remark?: string): { success: boolean; swap?: SpaceSwap; message?: string } {
    const swap = this.getById(id);
    if (!swap) {
      return { success: false, message: '调换申请不存在' };
    }
    if (swap.status !== 'pending') {
      return { success: false, message: '申请状态不正确' };
    }

    const newSpace = ParkingSpaceService.getById(swap.new_space_id);
    if (!newSpace || newSpace.status !== 'available') {
      return { success: false, message: '目标车位已不可用' };
    }

    const stmt = db.prepare(`
      UPDATE space_swaps 
      SET status = 'approved', approver = ?, approve_remark = ?, approved_at = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(approver, remark || null, now(), now(), id);

    const lease = LeaseService.getById(swap.lease_id);
    if (lease) {
      const leaseStmt = db.prepare(`
        UPDATE leases SET space_id = ?, updated_at = ? WHERE id = ?
      `);
      leaseStmt.run(swap.new_space_id, now(), swap.lease_id);

      ParkingSpaceService.update(swap.old_space_id, { status: 'available' } as any);
      ParkingSpaceService.update(swap.new_space_id, { status: 'rented' } as any);

      const compStmt = db.prepare(`
        UPDATE space_swaps SET status = 'completed', updated_at = ? WHERE id = ?
      `);
      compStmt.run(now(), id);

      addLeaseTimeline(swap.lease_id, 'swap_completed', { 
        old_space_id: swap.old_space_id, 
        new_space_id: swap.new_space_id 
      }, approver, '车位调换完成');

      LifecycleService.addSpaceLifecycleEvent(
        swap.old_space_id, 'swap_completed',
        { direction: 'release', new_space_id: swap.new_space_id, swap_id: id },
        swap.lease_id, swap.tenant_id, approver, '调换释放车位'
      );
      LifecycleService.addSpaceLifecycleEvent(
        swap.new_space_id, 'swap_completed',
        { direction: 'occupy', old_space_id: swap.old_space_id, swap_id: id },
        swap.lease_id, swap.tenant_id, approver, '调换占用新车位'
      );
    }

    auditLog(approver, 'approve', 'space_swap', id, swap, this.getById(id), remark || '审批通过');

    return { success: true, swap: this.getById(id)! };
  }

  static reject(id: string, approver: string, remark?: string): { success: boolean; swap?: SpaceSwap; message?: string } {
    const swap = this.getById(id);
    if (!swap) {
      return { success: false, message: '调换申请不存在' };
    }
    if (swap.status !== 'pending') {
      return { success: false, message: '申请状态不正确' };
    }

    const stmt = db.prepare(`
      UPDATE space_swaps 
      SET status = 'rejected', approver = ?, approve_remark = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(approver, remark || null, now(), id);

    addLeaseTimeline(swap.lease_id, 'swap_rejected', { reason: remark }, approver, '车位调换被驳回');
    LifecycleService.addSpaceLifecycleEvent(
      swap.old_space_id, 'swap_rejected',
      { swap_id: id, reason: remark },
      swap.lease_id, swap.tenant_id, approver, `调换驳回: ${remark || '无原因'}`
    );
    auditLog(approver, 'reject', 'space_swap', id, swap, this.getById(id), remark || '审批驳回');

    return { success: true, swap: this.getById(id)! };
  }

  static delete(id: string): boolean {
    const before = this.getById(id);
    const stmt = db.prepare('DELETE FROM space_swaps WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'space_swap', id, before, null, '删除调换申请');
    }
    return result.changes > 0;
  }

  static getDetail(id: string): any {
    const swap = this.getById(id);
    if (!swap) return null;

    const lease = LeaseService.getById(swap.lease_id);
    const oldSpace = ParkingSpaceService.getById(swap.old_space_id);
    const newSpace = ParkingSpaceService.getById(swap.new_space_id);

    return {
      ...swap,
      lease,
      old_space: oldSpace,
      new_space: newSpace,
    };
  }
}
