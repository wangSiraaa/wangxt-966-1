import { db } from '../database';
import { AdjustmentOrder } from '../types';
import { generateId, now, auditLog } from '../utils';

export class AdjustmentOrderService {
  static getAll(params?: {
    lease_id?: string;
    order_type?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): { list: AdjustmentOrder[]; total: number } {
    let countSql = 'SELECT COUNT(*) as count FROM adjustment_orders WHERE 1=1';
    let dataSql = 'SELECT * FROM adjustment_orders WHERE 1=1';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.lease_id) {
      conditions.push('lease_id = ?');
      values.push(params.lease_id);
    }
    if (params?.order_type) {
      conditions.push('order_type = ?');
      values.push(params.order_type);
    }
    if (params?.status) {
      conditions.push('status = ?');
      values.push(params.status);
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
    const list = dataStmt.all(...values) as AdjustmentOrder[];

    return { list, total };
  }

  static getById(id: string): AdjustmentOrder | undefined {
    const stmt = db.prepare('SELECT * FROM adjustment_orders WHERE id = ?');
    return stmt.get(id) as AdjustmentOrder | undefined;
  }

  static getByLease(leaseId: string): AdjustmentOrder[] {
    const stmt = db.prepare('SELECT * FROM adjustment_orders WHERE lease_id = ? ORDER BY created_at DESC');
    return stmt.all(leaseId) as AdjustmentOrder[];
  }

  static getPendingByPeriod(periodId: string): AdjustmentOrder[] {
    const stmt = db.prepare('SELECT * FROM adjustment_orders WHERE status = ? AND fiscal_period_id = ? ORDER BY created_at DESC');
    return stmt.all('pending', periodId) as AdjustmentOrder[];
  }

  static create(data: {
    lease_id: string;
    tenant_id: string;
    space_id: string;
    order_type: 'price_diff' | 'refund' | 'late_fee';
    amount: number;
    reason?: string;
    fiscal_period_id?: string;
    remark?: string;
  }): AdjustmentOrder {
    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO adjustment_orders (id, lease_id, tenant_id, space_id, order_type, amount, reason, status, fiscal_period_id, remark, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.lease_id,
      data.tenant_id,
      data.space_id,
      data.order_type,
      data.amount,
      data.reason || null,
      data.fiscal_period_id || null,
      data.remark || null,
      time,
      time
    );
    auditLog('admin', 'create', 'adjustment_order', id, null, data, '创建调整单');
    return this.getById(id)!;
  }

  static approve(id: string, approvedBy: string, remark?: string): AdjustmentOrder | undefined {
    const before = this.getById(id);
    if (!before || before.status !== 'pending') return before;

    const time = now();
    let finalAmount = before.amount;
    if (before.order_type === 'late_fee' && finalAmount > 0) {
      const interestRate = 0.05;
      finalAmount = Math.round((finalAmount * (1 + interestRate)) * 100) / 100;
    }

    const stmt = db.prepare(`
      UPDATE adjustment_orders SET status = 'approved', amount = ?, approved_by = ?, approved_at = ?, remark = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(finalAmount, approvedBy, time, remark || before.remark || null, time, id);

    const after = this.getById(id);
    auditLog(approvedBy, 'approve', 'adjustment_order', id, before, after, '审批通过调整单');
    return after;
  }

  static reject(id: string, approvedBy: string, remark?: string): AdjustmentOrder | undefined {
    const before = this.getById(id);
    if (!before || before.status !== 'pending') return before;

    const time = now();
    const stmt = db.prepare(`
      UPDATE adjustment_orders SET status = 'rejected', approved_by = ?, approved_at = ?, remark = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(approvedBy, time, remark || before.remark || null, time, id);

    const after = this.getById(id);
    auditLog(approvedBy, 'reject', 'adjustment_order', id, before, after, '驳回调整单');
    return after;
  }

  static complete(id: string): AdjustmentOrder | undefined {
    const before = this.getById(id);
    if (!before || before.status !== 'approved') return before;

    const time = now();
    const stmt = db.prepare(`
      UPDATE adjustment_orders SET status = 'completed', updated_at = ? WHERE id = ?
    `);
    stmt.run(time, id);

    const after = this.getById(id);
    auditLog('admin', 'complete', 'adjustment_order', id, before, after, '完成调整单');
    return after;
  }

  static delete(id: string): boolean {
    const before = this.getById(id);
    if (!before || before.status !== 'pending') return false;

    const stmt = db.prepare('DELETE FROM adjustment_orders WHERE id = ? AND status = ?');
    const result = stmt.run(id, 'pending');
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'adjustment_order', id, before, null, '删除调整单');
    }
    return result.changes > 0;
  }
}
