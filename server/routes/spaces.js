const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', async (req, res) => {
  const { status, is_frozen, location } = req.query;
  let sql = 'SELECT * FROM parking_spaces WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (is_frozen !== undefined) {
    sql += ' AND is_frozen = ?';
    params.push(is_frozen === 'true' || is_frozen === '1' ? 1 : 0);
  }
  if (location) {
    sql += ' AND location LIKE ?';
    params.push(`%${location}%`);
  }
  sql += ' ORDER BY space_no ASC';

  const list = await db.prepare(sql).all(...params);
  res.json({ code: 0, data: list });
});

router.get('/:id', async (req, res) => {
  const row = await db.prepare('SELECT * FROM parking_spaces WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.json({ code: 404, message: '车位不存在' });
  }
  res.json({ code: 0, data: row });
});

router.post('/', async (req, res) => {
  const { space_no, location } = req.body;
  if (!space_no) {
    return res.json({ code: 400, message: '车位编号必填' });
  }
  try {
    const info = await db.prepare(
      'INSERT INTO parking_spaces (space_no, location, status, is_frozen) VALUES (?, ?, ?, 0)'
    ).run(space_no, location || '', 'available');
    res.json({ code: 0, data: { id: info.lastInsertRowid } });
  } catch (e) {
    res.json({ code: 500, message: '创建失败: ' + e.message });
  }
});

router.put('/:id/freeze', async (req, res) => {
  const { is_frozen, freeze_reason } = req.body;
  const frozen = is_frozen ? 1 : 0;
  const info = await db.prepare(
    'UPDATE parking_spaces SET is_frozen = ?, freeze_reason = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
  ).run(frozen, freeze_reason || '', req.params.id);
  if (info.changes === 0) {
    return res.json({ code: 404, message: '车位不存在' });
  }
  res.json({ code: 0, message: frozen ? '已冻结' : '已解冻' });
});

router.get('/stats/overview', async (req, res) => {
  const total = (await db.prepare('SELECT COUNT(*) as cnt FROM parking_spaces').get()).cnt;
  const occupied = (await db.prepare("SELECT COUNT(*) as cnt FROM parking_spaces WHERE status = 'occupied'").get()).cnt;
  const available = (await db.prepare("SELECT COUNT(*) as cnt FROM parking_spaces WHERE status = 'available'").get()).cnt;
  const frozen = (await db.prepare('SELECT COUNT(*) as cnt FROM parking_spaces WHERE is_frozen = 1').get()).cnt;
  res.json({
    code: 0,
    data: { total, occupied, available, frozen, utilization: total ? Math.round(occupied / total * 100) : 0 }
  });
});

module.exports = router;
