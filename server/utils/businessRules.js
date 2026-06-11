const dayjs = require('dayjs');
const db = require('../db/database');

const EXPIRE_WARNING_DAYS = 15;
const EXPIRE_RECYCLE_DAYS = 30;

const LeaseStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  RENEWING: 'renewing',
  TERMINATED: 'terminated'
};

const RenewalStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

const ArrearsStatus = {
  UNSETTLED: 'unsettled',
  PARTIAL: 'partial',
  SETTLED: 'settled'
};

const SpaceStatus = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved'
};

async function checkTenantHasUnsettledArrears(tenantId) {
  const row = await db.prepare(`
    SELECT COUNT(*) as cnt FROM arrears_records
    WHERE tenant_id = ? AND status IN ('unsettled', 'partial')
  `).get(tenantId);
  return row.cnt > 0;
}

async function getUnsettledArrearsList(tenantId) {
  return await db.prepare(`
    SELECT ar.*, t.name as tenant_name, ps.space_no
    FROM arrears_records ar
    LEFT JOIN tenants t ON ar.tenant_id = t.id
    LEFT JOIN parking_spaces ps ON ar.space_id = ps.id
    WHERE ar.tenant_id = ? AND ar.status IN ('unsettled', 'partial')
    ORDER BY ar.created_at DESC
  `).all(tenantId);
}

async function checkSpaceIsFrozen(spaceId) {
  const row = await db.prepare('SELECT is_frozen FROM parking_spaces WHERE id = ?').get(spaceId);
  return row && row.is_frozen === 1;
}

async function getExpiringLeases(days = EXPIRE_WARNING_DAYS) {
  const today = dayjs().format('YYYY-MM-DD');
  const warningDate = dayjs().add(days, 'day').format('YYYY-MM-DD');

  return await db.prepare(`
    SELECT l.*, t.name as tenant_name, t.phone, t.license_plate, ps.space_no, ps.location,
      CAST((julianday(l.end_date) - julianday(?)) AS INTEGER) as days_left
    FROM leases l
    LEFT JOIN tenants t ON l.tenant_id = t.id
    LEFT JOIN parking_spaces ps ON l.space_id = ps.id
    WHERE l.status = 'active'
      AND l.end_date >= ?
      AND l.end_date <= ?
    ORDER BY l.end_date ASC
  `).all(today, today, warningDate);
}

async function recycleExpiredLeases() {
  const today = dayjs().format('YYYY-MM-DD');
  const recycleDate = dayjs().subtract(EXPIRE_RECYCLE_DAYS, 'day').format('YYYY-MM-DD');

  const expiredLeases = await db.prepare(`
    SELECT l.* FROM leases l
    WHERE l.status = 'active'
      AND l.end_date < ?
      AND l.is_expired_recycled = 0
  `).all(today);

  let recycledCount = 0;

  try {
    await db.transaction(async (tx) => {
      for (const lease of expiredLeases) {
        if (dayjs(lease.end_date).isBefore(recycleDate)) {
          const daysExpired = dayjs().diff(dayjs(lease.end_date), 'day');
          const monthlyAmount = lease.monthly_amount;
          const arrearsAmount = (daysExpired / 30) * monthlyAmount;

          await tx.prepare(`
            UPDATE leases SET status = 'expired', is_expired_recycled = 1, updated_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(lease.id);

          await tx.prepare(`
            UPDATE parking_spaces SET status = 'available', updated_at = datetime('now', 'localtime')
            WHERE id = ? AND status = 'occupied'
          `).run(lease.space_id);

          const recordNo = `AR${Date.now()}${Math.floor(Math.random() * 10000)}`;

          await tx.prepare(`
            INSERT INTO arrears_records (record_no, tenant_id, lease_id, space_id, amount, arrears_type, description, status, due_date)
            VALUES (?, ?, ?, ?, ?, 'lease_expired_arrears', ?, 'unsettled', ?)
          `).run(
            recordNo,
            lease.tenant_id,
            lease.id,
            lease.space_id,
            Math.round(arrearsAmount * 100) / 100,
            `租约过期${daysExpired}天欠费，已回收车位`,
            lease.end_date
          );

          recycledCount++;
        }
      }
    });
  } catch (e) {
    console.error('回收过期租约事务失败:', e);
  }

  return { recycled: recycledCount, checked: expiredLeases.length };
}

module.exports = {
  EXPIRE_WARNING_DAYS,
  EXPIRE_RECYCLE_DAYS,
  LeaseStatus,
  RenewalStatus,
  ArrearsStatus,
  SpaceStatus,
  checkTenantHasUnsettledArrears,
  getUnsettledArrearsList,
  checkSpaceIsFrozen,
  getExpiringLeases,
  recycleExpiredLeases
};
