const express = require('express');
const dayjs = require('dayjs');
const db = require('../db/database');
const {
  checkTenantHasUnsettledArrears,
  getUnsettledArrearsList,
  checkSpaceIsFrozen,
  recycleExpiredLeases
} = require('../utils/businessRules');

const router = express.Router();

router.get('/', async (req, res) => {
  const { status, tenant_id, lease_id } = req.query;
  let sql = `
    SELECT ra.*, t.name as tenant_name, t.phone, ps.space_no,
      l.start_date as original_start, l.end_date as original_end, l.monthly_amount
    FROM renewal_applications ra
    LEFT JOIN tenants t ON ra.tenant_id = t.id
    LEFT JOIN parking_spaces ps ON ra.space_id = ps.id
    LEFT JOIN leases l ON ra.lease_id = l.id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    sql += ' AND ra.status = ?';
    params.push(status);
  }
  if (tenant_id) {
    sql += ' AND ra.tenant_id = ?';
    params.push(tenant_id);
  }
  if (lease_id) {
    sql += ' AND ra.lease_id = ?';
    params.push(lease_id);
  }
  sql += ' ORDER BY ra.created_at DESC LIMIT 500';
  const list = await db.prepare(sql).all(...params);
  res.json({ code: 0, data: list });
});

router.get('/:id', async (req, res) => {
  const row = await db.prepare(`
    SELECT ra.*, t.name as tenant_name, t.phone, t.license_plate, ps.space_no, ps.location,
      l.start_date as original_start, l.end_date as original_end, l.monthly_amount, l.status as lease_status
    FROM renewal_applications ra
    LEFT JOIN tenants t ON ra.tenant_id = t.id
    LEFT JOIN parking_spaces ps ON ra.space_id = ps.id
    LEFT JOIN leases l ON ra.lease_id = l.id
    WHERE ra.id = ?
  `).get(req.params.id);
  if (!row) return res.json({ code: 404, message: '续费申请不存在' });
  res.json({ code: 0, data: row });
});

router.post('/:id/approve', async (req, res) => {
  await recycleExpiredLeases();

  const { operator } = req.body;
  const app = await db.prepare('SELECT * FROM renewal_applications WHERE id = ?').get(req.params.id);

  if (!app) return res.json({ code: 404, message: '续费申请不存在' });
  if (app.status !== 'pending') {
    return res.json({ code: 403, message: `当前申请状态为「${app.status}」，无法审批` });
  }

  if (await checkSpaceIsFrozen(app.space_id)) {
    return res.json({
      code: 403,
      block_type: 'SPACE_FROZEN',
      message: '该车位已被冻结，续费流程已被拦截。请先解除车位冻结。'
    });
  }

  if (await checkTenantHasUnsettledArrears(app.tenant_id)) {
    const arrears = await getUnsettledArrearsList(app.tenant_id);
    const total = arrears.reduce((s, a) => s + a.amount - (a.settled_amount || 0), 0);
    return res.json({
      code: 403,
      block_type: 'UNSETTLED_ARREARS',
      message: `该车主存在未结清欠费（¥${total.toFixed(2)}），续费审批被拦截。请先结清欠费后再操作。`,
      data: { arrears_list: arrears, total_arrears: total }
    });
  }

  try {
    await db.transaction(async (tx) => {
      await tx.prepare(`
        UPDATE renewal_applications
        SET status = 'approved', processed_time = datetime('now', 'localtime'),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(app.id);

      const lease = await tx.prepare('SELECT * FROM leases WHERE id = ?').get(app.lease_id);
      const currentEnd = dayjs(lease.end_date);
      const today = dayjs();
      const baseEnd = currentEnd.isBefore(today) ? today : currentEnd;
      const newEnd = baseEnd.add(app.months, 'month');

      await tx.prepare(`
        UPDATE leases
        SET end_date = ?, total_amount = total_amount + ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(newEnd.format('YYYY-MM-DD'), app.renewal_amount, app.lease_id);

      const payNo = `PAY-RENEW-${app.id}-${Date.now()}`;
      await tx.prepare(`
        INSERT INTO payments (payment_no, tenant_id, lease_id, arrears_id, amount, payment_method, remark, operator)
        VALUES (?, ?, ?, NULL, ?, 'offline', ?, ?)
      `).run(
        payNo,
        app.tenant_id,
        app.lease_id,
        app.renewal_amount,
        `租约续费${app.months}个月至${newEnd.format('YYYY-MM-DD')}`,
        operator || '前台操作员'
      );
    });

    res.json({ code: 0, message: '续费审批通过，租约已续期' });
  } catch (e) {
    res.json({ code: 500, message: '审批失败: ' + e.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  const { reject_reason } = req.body;
  const info = await db.prepare(`
    UPDATE renewal_applications
    SET status = 'rejected', reject_reason = ?, processed_time = datetime('now', 'localtime'),
        updated_at = datetime('now', 'localtime')
    WHERE id = ? AND status = 'pending'
  `).run(reject_reason || '不符合续费条件', req.params.id);
  if (info.changes === 0) return res.json({ code: 404, message: '申请不存在或状态不正确' });
  res.json({ code: 0, message: '已驳回续费申请' });
});

router.post('/:id/cancel', async (req, res) => {
  const info = await db.prepare(`
    UPDATE renewal_applications
    SET status = 'cancelled', updated_at = datetime('now', 'localtime')
    WHERE id = ? AND status = 'pending'
  `).run(req.params.id);
  if (info.changes === 0) return res.json({ code: 404, message: '申请不存在或状态不正确' });
  res.json({ code: 0, message: '已取消续费申请' });
});

module.exports = router;
