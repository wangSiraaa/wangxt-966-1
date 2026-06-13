import { db } from '../database';
import { Arrears } from '../types';
import { generateId, now, today, daysBetween, auditLog } from '../utils';
import { LeaseService } from './lease.service';

export class ArrearsService {
  static getAll(params?: {
    tenant_id?: string;
    status?: string;
    lease_id?: string;
    min_age?: number;
    page?: number;
    pageSize?: number;
  }): { list: Arrears[]; total: number } {
    let countSql = 'SELECT COUNT(*) as count FROM arrears WHERE 1=1';
    let dataSql = 'SELECT * FROM arrears WHERE 1=1';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.tenant_id) {
      conditions.push('tenant_id = ?');
      values.push(params.tenant_id);
    }
    if (params?.status) {
      conditions.push('status = ?');
      values.push(params.status);
    }
    if (params?.lease_id) {
      conditions.push('lease_id = ?');
      values.push(params.lease_id);
    }
    if (params?.min_age) {
      conditions.push('age_days >= ?');
      values.push(params.min_age);
    }

    const whereClause = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
    countSql += whereClause;
    dataSql += whereClause + ' ORDER BY due_date ASC';

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    dataSql += ` LIMIT ${pageSize} OFFSET ${offset}`;

    const countStmt = db.prepare(countSql);
    const total = (countStmt.get(...values) as any).count;

    const dataStmt = db.prepare(dataSql);
    const list = dataStmt.all(...values) as Arrears[];

    return { list, total };
  }

  static getById(id: string): Arrears | undefined {
    const stmt = db.prepare('SELECT * FROM arrears WHERE id = ?');
    return stmt.get(id) as Arrears | undefined;
  }

  static getUnpaidByTenant(tenantId: string): Arrears[] {
    const stmt = db.prepare(`
      SELECT * FROM arrears 
      WHERE tenant_id = ? AND status != 'paid'
      ORDER BY due_date ASC
    `);
    return stmt.all(tenantId) as Arrears[];
  }

  static getByLease(leaseId: string): Arrears[] {
    const stmt = db.prepare(`
      SELECT * FROM arrears 
      WHERE lease_id = ? 
      ORDER BY due_date ASC
    `);
    return stmt.all(leaseId) as Arrears[];
  }

  static create(data: {
    lease_id: string;
    tenant_id: string;
    amount: number;
    arrears_type?: string;
    due_date: string;
    remark?: string;
  }): Arrears {
    const id = generateId();
    const time = now();
    const ageDays = daysBetween(today(), data.due_date);
    
    const stmt = db.prepare(`
      INSERT INTO arrears (id, lease_id, tenant_id, amount, arrears_type, due_date, status, age_days, remark, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.lease_id,
      data.tenant_id,
      data.amount,
      data.arrears_type || 'rent',
      data.due_date,
      Math.max(0, -ageDays),
      data.remark || null,
      time,
      time
    );

    auditLog('admin', 'create', 'arrears', id, null, data, '创建欠费记录');
    return this.getById(id)!;
  }

  static pay(id: string, amount?: number): { success: boolean; arrears?: Arrears; message?: string } {
    const arrears = this.getById(id);
    if (!arrears) {
      return { success: false, message: '欠费记录不存在' };
    }
    if (arrears.status === 'paid') {
      return { success: false, message: '欠费已结清' };
    }

    const payAmount = amount || arrears.amount;
    const newPaidAmount = (arrears.amount - payAmount);
    const newStatus = newPaidAmount <= 0 ? 'paid' : 'partial';

    const stmt = db.prepare(`
      UPDATE arrears SET status = ?, paid_date = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(
      newStatus,
      newStatus === 'paid' ? today() : null,
      now(),
      id
    );

    const result = this.getById(id);
    auditLog('admin', 'pay', 'arrears', id, arrears, result, `支付欠费: ${payAmount}`);
    return { success: true, arrears: result };
  }

  static updateAgeDays(): number {
    const stmt = db.prepare(`
      UPDATE arrears 
      SET age_days = CAST(julianday('now') - julianday(due_date) AS INTEGER),
          updated_at = ?
      WHERE status != 'paid'
    `);
    const result = stmt.run(now());
    return result.changes || 0;
  }

  static getAgingStats(): {
    total: number;
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  } {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN age_days <= 30 THEN 1 ELSE 0 END) as '0-30',
        SUM(CASE WHEN age_days > 30 AND age_days <= 60 THEN 1 ELSE 0 END) as '31-60',
        SUM(CASE WHEN age_days > 60 AND age_days <= 90 THEN 1 ELSE 0 END) as '61-90',
        SUM(CASE WHEN age_days > 90 THEN 1 ELSE 0 END) as '90+'
      FROM arrears 
      WHERE status != 'paid'
    `);
    return stmt.get() as any;
  }

  static delete(id: string): boolean {
    const before = this.getById(id);
    const stmt = db.prepare('DELETE FROM arrears WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'arrears', id, before, null, '删除欠费记录');
    }
    return result.changes > 0;
  }
}
