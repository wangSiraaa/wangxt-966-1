const express = require('express');
const dayjs = require('dayjs');
const db = require('../db/database');
const {
  EXPIRE_WARNING_DAYS,
  EXPIRE_RECYCLE_DAYS,
  checkTenantHasUnsettledArrears,
  getUnsettledArrearsList,
  checkSpaceIsFrozen,
  getExpiringLeases,
  recycleExpiredLeases
} = require('../utils/businessRules');

const router = express.Router();

router.get('/expiring', async (req, res) => {
  const days = parseInt(req.query.days) || EXPIRE_WARNING_DAYS;
  await recycleExpiredLeases();
  const list = await getExpiringLeases(days);
  res.json({ code: 0, data: list, warning_days: days });
});

router.get('/recycle-expired', async (req, res) => {
  const result = await recycleExpiredLeases();
  res.json({ code: 0, data: result, recycle_days: EXPIRE_RECYCLE_DAYS });
});

router.get('/', async (req, res) => {
  const { status, tenant_id, space_id } = req.query;
  let sql = `
    SELECT l.*, t.name as tenant_name, t.phone, t.license_plate, ps.space_no, ps.location, ps.is_frozen
    FROM leases l
    LEFT JOIN tenants t ON l.tenant_id = t.id
    LEFT JOIN parking_spaces ps ON l.space_id = ps.id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    sql += ' AND l.status = ?';
    params.push(status);
  }
  if (tenant_id) {
    sql += ' AND l.tenant_id = ?';
    params.push(tenant_id);
  }
  if (space_id) {
    sql += ' AND l.space_id = ?';
    params.push(space_id);
  }
  sql += ' ORDER BY l.created_at DESC LIMIT 500';
  const list = await db.prepare(sql).all(...params);
  res.json({ code: 0, data: list });
});

router.get('/:id', async (req, res) => {
  const row = await db.prepare(`
    SELECT l.*, t.name as tenant_name, t.phone, t.license_plate, ps.space_no, ps.location, ps.is_frozen
    FROM leases l
    LEFT JOIN tenants t ON l.tenant_id = t.id
    LEFT JOIN parking_spaces ps ON l.space_id = ps.id
    WHERE l.id = ?
  `).get(req.params.id);
  if (!row) return res.json({ code: 404, message: '租约不存在' });
  res.json({ code: 0, data: row });
});

router.post('/create', async (req, res) => {
  const { tenant_id, space_id, start_date, months, monthly_amount } = req.body;

  if (!tenant_id || !space_id || !start_date || !months || !monthly_amount) {
    return res.json({ code: 400, message: '参数不完整' });
  }

  if (await checkSpaceIsFrozen(space_id)) {
    return res.json({
      code: 403,
      block_type: 'SPACE_FROZEN',
      message: '该车位已被冻结，无法创建新租约。请联系管理员处理车位冻结问题。'
    });
  }

  if (await checkTenantHasUnsettledArrears(tenant_id)) {
    const arrears = await getUnsettledArrearsList(tenant_id);
    const total = arrears.reduce((s, a) => s + a.amount - (a.settled_amount || 0), 0);
    return res.json({
      code: 403,
      block_type: 'UNSETTLED_ARREARS',
      message: `该租户存在未结清欠费（共计 ¥${total.toFixed(2)}），请先结清欠费后再创建租约。`,
      data: { arrears_list: arrears, total_arrears: total }
    });
  }

  const space = await db.prepare('SELECT * FROM parking_spaces WHERE id = ?').get(space_id);
  if (!space) return res.json({ code: 404, message: '车位不存在' });
  if (space.status === 'occupied') {
    return res.json({ code: 403, message: '该车位已被占用' });
  }

  const startDate = dayjs(start_date);
  const endDate = startDate.add(months, 'month');

  try {
    const leaseId = await db.transaction(async (tx) => {
      const leaseNo = `L${tenant_id}-${space_id}-${Date.now()}`;
      const info = await tx.prepare(`
        INSERT INTO leases (lease_no, tenant_id, space_id, start_date, end_date, monthly_amount, total_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        leaseNo,
        tenant_id,
        space_id,
        startDate.format('YYYY-MM-DD'),
        endDate.format('YYYY-MM-DD'),
        monthly_amount,
        monthly_amount * months
      );

      await tx.prepare("UPDATE parking_spaces SET status = 'occupied', updated_at = datetime('now', 'localtime') WHERE id = ?").run(space_id);

      const payNo = `PAY-NEW-${info.lastInsertRowid}-${Date.now()}`;
      await tx.prepare(`
        INSERT INTO payments (payment_no, tenant_id, lease_id, arrears_id, amount, payment_method, remark, operator)
        VALUES (?, ?, ?, NULL, ?, 'offline', ?, '前台操作员')
      `).run(payNo, tenant_id, info.lastInsertRowid, monthly_amount * months, `新租约${months}个月租金`);

      return info.lastInsertRowid;
    });

    res.json({ code: 0, data: { id: leaseId, message: '租约创建成功' } });
  } catch (e) {
    res.json({ code: 500, message: '创建失败: ' + e.message });
  }
});

router.post('/submit-renewal', async (req, res) => {
  const { lease_id, months } = req.body;

  if (!lease_id || !months) {
    return res.json({ code: 400, message: '参数不完整' });
  }

  const lease = await db.prepare(`
    SELECT l.*, t.name as tenant_name, ps.space_no, ps.is_frozen
    FROM leases l
    LEFT JOIN tenants t ON l.tenant_id = t.id
    LEFT JOIN parking_spaces ps ON l.space_id = ps.id
    WHERE l.id = ?
  `).get(lease_id);

  if (!lease) return res.json({ code: 404, message: '租约不存在' });
  if (lease.status !== 'active') {
    return res.json({ code: 403, message: `当前租约状态为「${lease.status}」，无法申请续费` });
  }

  if (await checkSpaceIsFrozen(lease.space_id)) {
    return res.json({
      code: 403,
      block_type: 'SPACE_FROZEN',
      message: `车位「${lease.space_no}」已被冻结，无法办理续费。请先联系管理处解除车位冻结状态。`
    });
  }

  if (await checkTenantHasUnsettledArrears(lease.tenant_id)) {
    const arrears = await getUnsettledArrearsList(lease.tenant_id);
    const total = arrears.reduce((s, a) => s + a.amount - (a.settled_amount || 0), 0);
    return res.json({
      code: 403,
      block_type: 'UNSETTLED_ARREARS',
      message: `车主「${lease.tenant_name}」存在 ¥${total.toFixed(2)} 未结清欠费，续费流程已被拦截。请先前往「欠费管理」结清所有欠费后再提交续费申请。`,
      data: { arrears_list: arrears, total_arrears: total }
    });
  }

  const pendingApplication = await db.prepare(`
    SELECT * FROM renewal_applications
    WHERE lease_id = ? AND status = 'pending'
  `).get(lease_id);
  if (pendingApplication) {
    return res.json({
      code: 403,
      message: '该租约已有待处理的续费申请，请等待处理或取消后再提交'
    });
  }

  const baseEndDate = dayjs(lease.end_date).isBefore(dayjs()) ? dayjs() : dayjs(lease.end_date);
  const newEndDate = baseEndDate.add(months, 'month');
  const renewalAmount = lease.monthly_amount * months;
  const applicationNo = `RA-${lease_id}-${Date.now()}`;

  try {
    const info = await db.prepare(`
      INSERT INTO renewal_applications
        (application_no, lease_id, tenant_id, space_id, months, renewal_amount, new_end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      applicationNo,
      lease_id,
      lease.tenant_id,
      lease.space_id,
      months,
      renewalAmount,
      newEndDate.format('YYYY-MM-DD')
    );
    res.json({
      code: 0,
      data: {
        id: info.lastInsertRowid,
        application_no: applicationNo,
        renewal_amount: renewalAmount,
        new_end_date: newEndDate.format('YYYY-MM-DD')
      },
      message: '续费申请已提交，请联系前台确认并缴纳费用'
    });
  } catch (e) {
    res.json({ code: 500, message: '提交失败: ' + e.message });
  }
});

module.exports = router;
