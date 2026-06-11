const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', async (req, res) => {
  const { tenant_id, lease_id } = req.query;
  let sql = `
    SELECT p.*, t.name as tenant_name, l.lease_no, ps.space_no, a.record_no as arrears_record_no
    FROM payments p
    LEFT JOIN tenants t ON p.tenant_id = t.id
    LEFT JOIN leases l ON p.lease_id = l.id
    LEFT JOIN parking_spaces ps ON l.space_id = ps.id
    LEFT JOIN arrears_records a ON p.arrears_id = a.id
    WHERE 1=1
  `;
  const params = [];
  if (tenant_id) {
    sql += ' AND p.tenant_id = ?';
    params.push(tenant_id);
  }
  if (lease_id) {
    sql += ' AND p.lease_id = ?';
    params.push(lease_id);
  }
  sql += ' ORDER BY p.created_at DESC LIMIT 500';

  const list = await db.prepare(sql).all(...params);
  res.json({ code: 0, data: list });
});

router.get('/:id', async (req, res) => {
  const row = await db.prepare(`
    SELECT p.*, t.name as tenant_name, t.phone, l.lease_no, ps.space_no
    FROM payments p
    LEFT JOIN tenants t ON p.tenant_id = t.id
    LEFT JOIN leases l ON p.lease_id = l.id
    LEFT JOIN parking_spaces ps ON l.space_id = ps.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!row) return res.json({ code: 404, message: '支付记录不存在' });
  res.json({ code: 0, data: row });
});

router.get('/stats/daily', async (req, res) => {
  const { date } = req.query;
  let whereDate = '';
  const params = [];
  if (date) {
    whereDate = 'WHERE DATE(created_at) = ?';
    params.push(date);
  }
  const total = await db.prepare(`SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as cnt FROM payments ${whereDate}`).get(...params);
  const byMethod = await db.prepare(`
    SELECT payment_method, COALESCE(SUM(amount),0) as total, COUNT(*) as cnt
    FROM payments ${whereDate}
    GROUP BY payment_method
  `).all(...params);
  res.json({
    code: 0,
    data: {
      total_amount: Math.round(total.total * 100) / 100,
      total_count: total.cnt,
      by_method: byMethod
    }
  });
});

module.exports = router;
