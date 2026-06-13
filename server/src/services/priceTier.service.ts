import { db } from '../database';
import { PriceTier } from '../types';
import { generateId, now, auditLog } from '../utils';

export class PriceTierService {
  static getAll(activeOnly: boolean = false): PriceTier[] {
    let sql = 'SELECT * FROM price_tiers';
    if (activeOnly) {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY min_months ASC';
    const stmt = db.prepare(sql);
    return stmt.all() as PriceTier[];
  }

  static getById(id: string): PriceTier | undefined {
    const stmt = db.prepare('SELECT * FROM price_tiers WHERE id = ?');
    return stmt.get(id) as PriceTier | undefined;
  }

  static getApplicableTier(months: number): PriceTier | undefined {
    const tiers = this.getAll(true);
    for (let i = tiers.length - 1; i >= 0; i--) {
      const tier = tiers[i];
      if (months >= tier.min_months) {
        if (tier.max_months === undefined || tier.max_months === null || months <= tier.max_months) {
          return tier;
        }
      }
    }
    return undefined;
  }

  static create(data: Partial<PriceTier>): PriceTier {
    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO price_tiers (id, name, min_months, max_months, discount_rate, monthly_price, description, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.name,
      data.min_months,
      data.max_months || null,
      data.discount_rate || 1,
      data.monthly_price || null,
      data.description || null,
      data.is_active !== undefined ? data.is_active : 1,
      time
    );
    auditLog('admin', 'create', 'price_tier', id, null, data, '创建阶梯价');
    return this.getById(id)!;
  }

  static update(id: string, data: Partial<PriceTier>): PriceTier | undefined {
    const before = this.getById(id);
    if (!before) return undefined;

    const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at');
    if (fields.length === 0) return before;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (data as any)[f]);
    values.push(id);

    const stmt = db.prepare(`UPDATE price_tiers SET ${setClause} WHERE id = ?`);
    stmt.run(...values);

    const after = this.getById(id);
    auditLog('admin', 'update', 'price_tier', id, before, after, '更新阶梯价');
    return after;
  }

  static delete(id: string): boolean {
    const before = this.getById(id);
    const stmt = db.prepare('DELETE FROM price_tiers WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      auditLog('admin', 'delete', 'price_tier', id, before, null, '删除阶梯价');
    }
    return result.changes > 0;
  }
}
