import { db } from '../database';
import { Invoice } from '../types';
import { generateId, now, auditLog } from '../utils';

export class InvoiceService {
  static getAll(params?: {
    tenant_id?: string;
    lease_id?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): { list: Invoice[]; total: number } {
    let countSql = 'SELECT COUNT(*) as count FROM invoices WHERE 1=1';
    let dataSql = 'SELECT * FROM invoices WHERE 1=1';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.tenant_id) {
      conditions.push('tenant_id = ?');
      values.push(params.tenant_id);
    }
    if (params?.lease_id) {
      conditions.push('lease_id = ?');
      values.push(params.lease_id);
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
    const list = dataStmt.all(...values) as Invoice[];

    return { list, total };
  }

  static getById(id: string): Invoice | undefined {
    const stmt = db.prepare('SELECT * FROM invoices WHERE id = ?');
    return stmt.get(id) as Invoice | undefined;
  }

  static create(data: {
    lease_id: string;
    tenant_id: string;
    title: string;
    tax_no?: string;
    amount: number;
    invoice_type?: string;
    remark?: string;
  }): Invoice {
    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO invoices (id, lease_id, tenant_id, title, tax_no, amount, invoice_type, status, remark, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `);
    stmt.run(
      id,
      data.lease_id,
      data.tenant_id,
      data.title,
      data.tax_no || null,
      data.amount,
      data.invoice_type || 'general',
      data.remark || null,
      time,
      time
    );
    auditLog('admin', 'create', 'invoice', id, null, data, '创建发票申请');
    return this.getById(id)!;
  }

  static issue(id: string): Invoice | undefined {
    const before = this.getById(id);
    if (!before || before.status !== 'pending') return before;

    const stmt = db.prepare(`
      UPDATE invoices SET status = 'issued', issued_date = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(now(), now(), id);

    const after = this.getById(id);
    auditLog('admin', 'issue', 'invoice', id, before, after, '开具发票');
    return after;
  }

  static cancel(id: string): Invoice | undefined {
    const before = this.getById(id);
    if (!before || before.status === 'cancelled') return before;

    const stmt = db.prepare(`
      UPDATE invoices SET status = 'cancelled', updated_at = ? WHERE id = ?
    `);
    stmt.run(now(), id);

    const after = this.getById(id);
    auditLog('admin', 'cancel', 'invoice', id, before, after, '作废发票');
    return after;
  }

  static delete(id: string): boolean {
    const before = this.getById(id);
    const stmt = db.prepare('DELETE FROM invoices WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'invoice', id, before, null, '删除发票');
    }
    return result.changes > 0;
  }
}
