const express = require('express');
const db = require('../db/database');
const { checkTenantHasUnsettledArrears, getUnsettledArrearsList } = require('../utils/businessRules');

const router = express.Router();

router.get('/', async (req, res) => {
  const { status, tenant_id } = req.query;
  let sql = `
    SELECT ar.*, t.name as tenant_name, t.phone, ps.space_no, l.lease_no
    FROM arrears_records ar
    LEFT JOIN tenants t ON ar.tenant_id = t.id
    LEFT JOIN parking_spaces ps ON ar.space_id = ps.id
    LEFT JOIN leases l ON ar.lease_id = l.id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    sql += ' AND ar.status = ?';
    params.push(status);
  }
  if (tenant_id) {
    sql += ' AND ar.tenant_id = ?';
    params.push(tenant_id);
  }
  sql += ' ORDER BY ar.created_at DESC LIMIT 500';
  const list = await db.prepare(sql).all(...params);
  res.json({ code: 0, data: list });
});

router.get('/tenant/:tenantId/unsettled', async (req, res) => {
  const list = await getUnsettledArrearsList(req.params.tenantId);
  const total = list.reduce((s, a) => s + a.amount - (a.settled_amount || 0), 0);
  res.json({ code: 0, data: list, total_arrears: total });
});

router.get('/:id', async (req, res) => {
  const row = await db.prepare(`
    SELECT ar.*, t.name as tenant_name, t.phone, ps.space_no, l.lease_no
    FROM arrears_records ar
    LEFT JOIN tenants t ON ar.tenant_id = t.id
    LEFT JOIN parking_spaces ps ON ar.space_id = ps.id
    LEFT JOIN leases l ON ar.lease_id = l.id
    WHERE ar.id = ?
  `).get(req.params.id);
  if (!row) return res.json({ code: 404, message: '欠费记录不存在' });
  res.json({ code: 0, data: row });
});

router.post('/:id/pay', async (req, res) => {
  const { amount, payment_method, operator, remark } = req.body;
  if (!amount || amount <= 0) return res.json({ code: 400, message: '支付金额必须大于0' });

  const record = await db.prepare('SELECT * FROM arrears_records WHERE id = ?').get(req.params.id);
  if (!record) return res.json({ code: 404, message: '欠费记录不存在' });

  const remaining = record.amount - (record.settled_amount || 0);
  const payAmount = Math.min(parseFloat(amount), remaining);
  const newSettled = (record.settled_amount || 0) + payAmount;
  const newStatus = newSettled >= record.amount ? 'settled' : 'partial';

  try {
    await db.transaction(async (tx) => {
      await tx.prepare(`
        UPDATE arrears_records
        SET status = ?, settled_amount = ?,
            settled_time = CASE WHEN ? = 'settled' THEN datetime('now', 'localtime') ELSE settled_time END,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(newStatus, newSettled, newStatus, record.id);

      const payNo = `PAY-AR-${record.id}-${Date.now()}`;
      await tx.prepare(`
        INSERT INTO payments (payment_no, tenant_id, lease_id, arrears_id, amount, payment_method, remark, operator)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payNo,
        record.tenant_id,
        record.lease_id,
        record.id,
        payAmount,
        payment_method || 'cash',
        remark || `欠费结清支付${newStatus === 'settled' ? '（全额）' : '（部分）'}`,
        operator || '财务人员'
      );
    });

    const blocked = await checkTenantHasUnsettledArrears(record.tenant_id);
    res.json({
      code: 0,
      message: `缴费成功，已支付 ¥${payAmount.toFixed(2)}${newStatus === 'settled' ? '，欠费已全部结清' : `，尚欠 ¥${(record.amount - newSettled).toFixed(2)}`}`,
      data: {
        new_status: newStatus,
        paid_amount: payAmount,
        settled_amount: newSettled,
        remaining_amount: record.amount - newSettled,
        has_other_arrears: blocked
      }
    });
  } catch (e) {
    res.json({ code: 500, message: '缴费失败: ' + e.message });
  }
});

router.get('/stats/overview', async (req, res) => {
  const totalCount = (await db.prepare('SELECT COUNT(*) as cnt FROM arrears_records').get()).cnt;
  const unsettledList = await db.prepare("SELECT amount, settled_amount FROM arrears_records WHERE status IN ('unsettled','partial')").all();
  const unsettledCount = unsettledList.length;
  const unsettledAmount = unsettledList.reduce((s, a) => s + a.amount - (a.settled_amount || 0), 0);
  const settledCount = (await db.prepare("SELECT COUNT(*) as cnt FROM arrears_records WHERE status = 'settled'").get()).cnt;
  const settledAmount = (await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM arrears_records WHERE status = 'settled'").get()).total;
  res.json({
    code: 0,
    data: {
      total_count: totalCount,
      unsettled_count: unsettledCount,
      unsettled_amount: Math.round(unsettledAmount * 100) / 100,
      settled_count: settledCount,
      settled_amount: Math.round(settledAmount * 100) / 100
    }
  });
});

module.exports = router;
