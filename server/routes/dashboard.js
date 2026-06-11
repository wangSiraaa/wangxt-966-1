const express = require('express');
const db = require('../db/database');
const { recycleExpiredLeases, getExpiringLeases, EXPIRE_WARNING_DAYS, EXPIRE_RECYCLE_DAYS } = require('../utils/businessRules');

const router = express.Router();

router.get('/overview', async (req, res) => {
  await recycleExpiredLeases();

  const spaceStats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN is_frozen = 1 THEN 1 ELSE 0 END) as frozen
    FROM parking_spaces
  `).get();

  const leaseStats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
    FROM leases
  `).get();

  const arrearsStats = await db.prepare(`
    SELECT
      COUNT(*) as total_count,
      COALESCE(SUM(CASE WHEN status IN ('unsettled','partial') THEN amount - settled_amount ELSE 0 END), 0) as unsettled_amount,
      SUM(CASE WHEN status IN ('unsettled','partial') THEN 1 ELSE 0 END) as unsettled_count
    FROM arrears_records
  `).get();

  const renewalStats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN renewal_amount ELSE 0 END), 0) as approved_amount
    FROM renewal_applications
  `).get();

  const expiringLeases = await getExpiringLeases(EXPIRE_WARNING_DAYS);

  const todayPayments = await db.prepare(`
    SELECT COALESCE(SUM(amount),0) as today_amount, COUNT(*) as today_count
    FROM payments WHERE DATE(created_at) = DATE('now', 'localtime')
  `).get();

  res.json({
    code: 0,
    data: {
      spaces: {
        ...spaceStats,
        utilization: spaceStats.total ? Math.round(spaceStats.occupied / spaceStats.total * 100) : 0
      },
      leases: leaseStats,
      arrears: {
        total_count: arrearsStats.total_count,
        unsettled_count: arrearsStats.unsettled_count,
        unsettled_amount: Math.round(arrearsStats.unsettled_amount * 100) / 100
      },
      renewals: {
        ...renewalStats,
        approved_amount: Math.round(renewalStats.approved_amount * 100) / 100
      },
      expiring_leases: expiringLeases.slice(0, 10),
      expiring_total: expiringLeases.length,
      today_payments: {
        amount: Math.round(todayPayments.today_amount * 100) / 100,
        count: todayPayments.today_count
      },
      constants: {
        expire_warning_days: EXPIRE_WARNING_DAYS,
        expire_recycle_days: EXPIRE_RECYCLE_DAYS
      }
    }
  });
});

router.get('/init', async (req, res) => {
  const { initDemoData } = require('../scripts/initData');
  await initDemoData();
  res.json({ code: 0, message: '数据初始化完成' });
});

router.get('/recycle-check', async (req, res) => {
  const result = await recycleExpiredLeases();
  res.json({
    code: 0,
    data: {
      ...result,
      recycle_days: EXPIRE_RECYCLE_DAYS,
      message: `检查了${result.checked}个过期租约，回收了${result.recycled}个超过${EXPIRE_RECYCLE_DAYS}天的租约并释放车位`
    }
  });
});

module.exports = router;
