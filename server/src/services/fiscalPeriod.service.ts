import { db } from '../database';
import { FiscalPeriod } from '../types';
import { generateId, now, auditLog } from '../utils';

export class FiscalPeriodService {
  static getAll(): FiscalPeriod[] {
    const stmt = db.prepare('SELECT * FROM fiscal_periods ORDER BY start_date DESC');
    return stmt.all() as FiscalPeriod[];
  }

  static getById(id: string): FiscalPeriod | undefined {
    const stmt = db.prepare('SELECT * FROM fiscal_periods WHERE id = ?');
    return stmt.get(id) as FiscalPeriod | undefined;
  }

  static getByDate(date: string): FiscalPeriod | undefined {
    const stmt = db.prepare('SELECT * FROM fiscal_periods WHERE start_date <= ? AND end_date >= ?');
    return stmt.get(date, date) as FiscalPeriod | undefined;
  }

  static isPeriodClosed(date: string): boolean {
    const period = this.getByDate(date);
    return period?.status === 'closed';
  }

  static create(data: {
    period_name: string;
    start_date: string;
    end_date: string;
    remark?: string;
  }): FiscalPeriod {
    const overlapStmt = db.prepare(`
      SELECT COUNT(*) as count FROM fiscal_periods
      WHERE (start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?)
    `);
    const overlap = (overlapStmt.get(data.end_date, data.start_date, data.end_date, data.start_date) as any).count;
    if (overlap > 0) {
      throw new Error('存在重叠的会计期间');
    }

    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO fiscal_periods (id, period_name, start_date, end_date, status, remark, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?)
    `);
    stmt.run(id, data.period_name, data.start_date, data.end_date, data.remark || null, time, time);
    auditLog('admin', 'create', 'fiscal_period', id, null, data, '创建会计期间');
    return this.getById(id)!;
  }

  static closePeriod(id: string, closedBy: string): FiscalPeriod {
    const before = this.getById(id);
    if (!before) {
      throw new Error('会计期间不存在');
    }
    if (before.status === 'closed') {
      throw new Error('会计期间已关闭');
    }

    const pendingStmt = db.prepare(`
      SELECT COUNT(*) as count FROM adjustment_orders
      WHERE fiscal_period_id = ? AND status = 'pending'
    `);
    const pendingCount = (pendingStmt.get(id) as any).count;
    if (pendingCount > 0) {
      throw new Error('该期间存在未处理的调整单，无法关账');
    }

    const time = now();
    const stmt = db.prepare(`
      UPDATE fiscal_periods SET status = 'closed', closed_by = ?, closed_at = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(closedBy, time, time, id);

    const after = this.getById(id)!;
    auditLog('admin', 'close', 'fiscal_period', id, before, after, '关闭会计期间');
    return after;
  }

  static reopenPeriod(id: string): FiscalPeriod {
    const before = this.getById(id);
    if (!before) {
      throw new Error('会计期间不存在');
    }
    if (before.status === 'open') {
      throw new Error('会计期间已处于开启状态');
    }

    const subsequentStmt = db.prepare(`
      SELECT COUNT(*) as count FROM fiscal_periods
      WHERE start_date > ? AND status = 'closed'
    `);
    const subsequentClosed = (subsequentStmt.get(before.end_date) as any).count;
    if (subsequentClosed > 0) {
      throw new Error('存在后续已关闭的会计期间，无法重开');
    }

    const stmt = db.prepare(`
      UPDATE fiscal_periods SET status = 'open', closed_by = NULL, closed_at = NULL, updated_at = ? WHERE id = ?
    `);
    stmt.run(now(), id);

    const after = this.getById(id)!;
    auditLog('admin', 'reopen', 'fiscal_period', id, before, after, '重开会计期间');
    return after;
  }

  static delete(id: string): boolean {
    const before = this.getById(id);
    if (!before) {
      throw new Error('会计期间不存在');
    }
    if (before.status === 'closed') {
      throw new Error('已关闭的会计期间不允许删除');
    }

    const stmt = db.prepare('DELETE FROM fiscal_periods WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'fiscal_period', id, before, null, '删除会计期间');
    }
    return result.changes > 0;
  }
}
