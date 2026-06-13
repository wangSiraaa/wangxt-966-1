import { db } from '../database';
import { AuditLog } from '../types';

export class AuditLogService {
  static getAll(params?: {
    module?: string;
    action?: string;
    operator?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    pageSize?: number;
  }): { list: AuditLog[]; total: number } {
    let countSql = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
    let dataSql = 'SELECT * FROM audit_logs WHERE 1=1';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.module) {
      conditions.push('module = ?');
      values.push(params.module);
    }
    if (params?.action) {
      conditions.push('action = ?');
      values.push(params.action);
    }
    if (params?.operator) {
      conditions.push('operator LIKE ?');
      values.push(`%${params.operator}%`);
    }
    if (params?.start_date) {
      conditions.push('created_at >= ?');
      values.push(params.start_date);
    }
    if (params?.end_date) {
      conditions.push('created_at <= ?');
      values.push(params.end_date + ' 23:59:59');
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
    const list = dataStmt.all(...values) as AuditLog[];

    return { list, total };
  }

  static getById(id: string): AuditLog | undefined {
    const stmt = db.prepare('SELECT * FROM audit_logs WHERE id = ?');
    return stmt.get(id) as AuditLog | undefined;
  }

  static getByModule(module: string, limit: number = 50): AuditLog[] {
    const stmt = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE module = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(module, limit) as AuditLog[];
  }

  static getByTarget(targetId: string, limit: number = 50): AuditLog[] {
    const stmt = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE target_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(targetId, limit) as AuditLog[];
  }

  static getStats(): {
    today: number;
    thisWeek: number;
    byModule: { module: string; count: number }[];
  } {
    const todayStmt = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE date(created_at) = date('now')
    `);
    const today = (todayStmt.get() as any).count;

    const weekStmt = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE created_at >= datetime('now', '-7 days')
    `);
    const thisWeek = (weekStmt.get() as any).count;

    const moduleStmt = db.prepare(`
      SELECT module, COUNT(*) as count FROM audit_logs 
      GROUP BY module 
      ORDER BY count DESC 
      LIMIT 10
    `);
    const byModule = moduleStmt.all() as { module: string; count: number }[];

    return { today, thisWeek, byModule };
  }
}
