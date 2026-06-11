const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', async (req, res) => {
  const { keyword } = req.query;
  let sql = 'SELECT * FROM tenants WHERE 1=1';
  const params = [];
  if (keyword) {
    sql += ' AND (name LIKE ? OR phone LIKE ? OR license_plate LIKE ? OR tenant_no LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw);
  }
  sql += ' ORDER BY id DESC';
  const list = await db.prepare(sql).all(...params);
  res.json({ code: 0, data: list });
});

router.get('/:id', async (req, res) => {
  const row = await db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!row) return res.json({ code: 404, message: '租户不存在' });
  res.json({ code: 0, data: row });
});

router.get('/:id/leases', async (req, res) => {
  const list = await db.prepare(`
    SELECT l.*, ps.space_no, ps.location
    FROM leases l
    LEFT JOIN parking_spaces ps ON l.space_id = ps.id
    WHERE l.tenant_id = ?
    ORDER BY l.created_at DESC
  `).all(req.params.id);
  res.json({ code: 0, data: list });
});

router.post('/', async (req, res) => {
  const { tenant_no, name, phone, license_plate, address } = req.body;
  if (!name) return res.json({ code: 400, message: '姓名必填' });
  const no = tenant_no || `T${Date.now()}`;
  try {
    const info = await db.prepare(
      'INSERT INTO tenants (tenant_no, name, phone, license_plate, address) VALUES (?, ?, ?, ?, ?)'
    ).run(no, name, phone || '', license_plate || '', address || '');
    res.json({ code: 0, data: { id: info.lastInsertRowid, tenant_no: no } });
  } catch (e) {
    res.json({ code: 500, message: '创建失败: ' + e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, phone, license_plate, address } = req.body;
  const info = await db.prepare(
    'UPDATE tenants SET name = ?, phone = ?, license_plate = ?, address = ? WHERE id = ?'
  ).run(name, phone || '', license_plate || '', address || '', req.params.id);
  if (info.changes === 0) return res.json({ code: 404, message: '租户不存在' });
  res.json({ code: 0, message: '更新成功' });
});

module.exports = router;
