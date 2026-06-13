import { db } from '../database';
import { Lease, ParkingSpace, Tenant, Vehicle, Arrears, PriceTier } from '../types';
import { generateId, now, today, addMonths, daysBetween, isExpired, isExpiredOver30Days, auditLog, addLeaseTimeline } from '../utils';
import { ParkingSpaceService } from './parkingSpace.service';
import { TenantService } from './tenant.service';
import { VehicleService } from './vehicle.service';
import { ArrearsService } from './arrears.service';
import { PriceTierService } from './priceTier.service';
import { LifecycleService } from './lifecycle.service';
import { FiscalPeriodService } from './fiscalPeriod.service';

export class LeaseService {
  static getAll(params?: {
    status?: string;
    tenant_id?: string;
    space_id?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): { list: Lease[]; total: number } {
    let countSql = 'SELECT COUNT(*) as count FROM leases WHERE 1=1';
    let dataSql = 'SELECT * FROM leases WHERE 1=1';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.status) {
      conditions.push('status = ?');
      values.push(params.status);
    }
    if (params?.tenant_id) {
      conditions.push('tenant_id = ?');
      values.push(params.tenant_id);
    }
    if (params?.space_id) {
      conditions.push('space_id = ?');
      values.push(params.space_id);
    }
    if (params?.keyword) {
      conditions.push(`(
        id IN (SELECT l.id FROM leases l 
               JOIN tenants t ON l.tenant_id = t.id 
               JOIN parking_spaces s ON l.space_id = s.id 
               WHERE t.name LIKE ? OR t.phone LIKE ? OR s.code LIKE ?)
      )`);
      values.push(`%${params.keyword}%`, `%${params.keyword}%`, `%${params.keyword}%`);
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
    const list = dataStmt.all(...values) as Lease[];

    return { list, total };
  }

  static getById(id: string): Lease | undefined {
    const stmt = db.prepare('SELECT * FROM leases WHERE id = ?');
    return stmt.get(id) as Lease | undefined;
  }

  static getActiveLeaseBySpace(spaceId: string): Lease | undefined {
    const stmt = db.prepare(`
      SELECT * FROM leases 
      WHERE space_id = ? AND status = 'active' AND contract_status = 'confirmed'
      ORDER BY start_date DESC LIMIT 1
    `);
    return stmt.get(spaceId) as Lease | undefined;
  }

  static getActiveLeaseByTenant(tenantId: string): Lease[] {
    const stmt = db.prepare(`
      SELECT * FROM leases 
      WHERE tenant_id = ? AND status = 'active'
      ORDER BY start_date DESC
    `);
    return stmt.all(tenantId) as Lease[];
  }

  static getExpiringSoon(days: number = 30): Lease[] {
    const targetDate = addMonths(today(), 0);
    const stmt = db.prepare(`
      SELECT * FROM leases 
      WHERE status = 'active' 
        AND date(end_date) <= date(?, '+${days} days')
        AND date(end_date) >= date(?)
      ORDER BY end_date ASC
    `);
    return stmt.all(today(), today()) as Lease[];
  }

  static getExpiredLeases(): Lease[] {
    const stmt = db.prepare(`
      SELECT * FROM leases 
      WHERE status = 'active' AND date(end_date) < date(?)
      ORDER BY end_date ASC
    `);
    return stmt.all(today()) as Lease[];
  }

  static hasOverlappingLease(spaceId: string, startDate: string, endDate: string, excludeLeaseId?: string): boolean {
    let sql = `
      SELECT COUNT(*) as count FROM leases 
      WHERE space_id = ? 
        AND status IN ('active', 'pending')
        AND date(start_date) <= date(?) 
        AND date(end_date) >= date(?)
    `;
    const values: any[] = [spaceId, endDate, startDate];
    
    if (excludeLeaseId) {
      sql += ' AND id != ?';
      values.push(excludeLeaseId);
    }
    
    const stmt = db.prepare(sql);
    const result = stmt.get(...values) as any;
    return result.count > 0;
  }

  static canRenew(leaseId: string): { can: boolean; reason?: string } {
    const lease = this.getById(leaseId);
    if (!lease) {
      return { can: false, reason: '租约不存在' };
    }

    if (lease.status === 'cancelled') {
      return { can: false, reason: '租约已取消' };
    }

    const tenant = TenantService.getById(lease.tenant_id);
    if (!tenant) {
      return { can: false, reason: '租户不存在' };
    }

    if (tenant.is_blacklisted) {
      return { can: false, reason: '租户在黑名单中，无法续费' };
    }

    if (lease.contract_status !== 'confirmed') {
      return { can: false, reason: '合同未确认，无法续费' };
    }

    const unpaidArrears = ArrearsService.getUnpaidByTenant(lease.tenant_id);
    if (unpaidArrears.length > 0) {
      return { can: false, reason: '存在未结清欠费，无法续费' };
    }

    const space = ParkingSpaceService.getById(lease.space_id);
    if (space && space.status === 'frozen') {
      return { can: false, reason: '车位已冻结，无法续费' };
    }

    if (FiscalPeriodService.isPeriodClosed(lease.end_date)) {
      return { can: false, reason: '租约结束日期所在会计期间已关账，无法续费' };
    }

    return { can: true };
  }

  static validateRenew(leaseId: string) {
    return LifecycleService.validateForRenew(leaseId);
  }

  static create(data: {
    space_id: string;
    tenant_id: string;
    vehicle_id: string;
    start_date: string;
    end_date: string;
    monthly_price: number;
    source?: string;
    parent_lease_id?: string;
    remark?: string;
  }): { success: boolean; lease?: Lease; message?: string } {
    const space = ParkingSpaceService.getById(data.space_id);
    if (!space) {
      return { success: false, message: '车位不存在' };
    }
    if (space.status === 'frozen') {
      return { success: false, message: '车位已冻结，不能创建租约' };
    }

    const tenant = TenantService.getById(data.tenant_id);
    if (!tenant) {
      return { success: false, message: '租户不存在' };
    }
    if (tenant.is_blacklisted) {
      return { success: false, message: '租户在黑名单中' };
    }

    const vehicle = VehicleService.getById(data.vehicle_id);
    if (!vehicle) {
      return { success: false, message: '车辆不存在' };
    }
    if (vehicle.tenant_id !== data.tenant_id) {
      return { success: false, message: '车辆不属于该租户' };
    }

    if (this.hasOverlappingLease(data.space_id, data.start_date, data.end_date)) {
      return { success: false, message: '该车位在所选周期内已有生效租约' };
    }

    const monthCount = this.calculateMonths(data.start_date, data.end_date);
    const totalAmount = data.monthly_price * monthCount;

    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO leases (id, space_id, tenant_id, vehicle_id, start_date, end_date, monthly_price, total_amount, paid_amount, status, contract_status, source, parent_lease_id, remark, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unconfirmed', ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.space_id,
      data.tenant_id,
      data.vehicle_id,
      data.start_date,
      data.end_date,
      data.monthly_price,
      totalAmount,
      0,
      data.source || 'new',
      data.parent_lease_id || null,
      data.remark || null,
      time,
      time
    );

    addLeaseTimeline(id, 'create', data, 'admin', '创建租约');
    auditLog('admin', 'create', 'lease', id, null, { ...data, total_amount: totalAmount }, '创建租约');

    LifecycleService.addSpaceLifecycleEvent(data.space_id, 'lease_create', { lease_id: id, monthly_price: data.monthly_price }, id, data.tenant_id, 'admin', '创建租约');

    return { success: true, lease: this.getById(id)! };
  }

  static renew(leaseId: string, months: number): { success: boolean; lease?: Lease; message?: string } {
    const checkResult = this.canRenew(leaseId);
    if (!checkResult.can) {
      return { success: false, message: checkResult.reason };
    }

    const lease = this.getById(leaseId)!;
    const startDate = isExpired(lease.end_date) ? today() : lease.end_date;
    const endDate = addMonths(startDate, months);

    if (this.hasOverlappingLease(lease.space_id, startDate, endDate, leaseId)) {
      return { success: false, message: '该车位在续费周期内已有其他生效租约' };
    }

    const tier = PriceTierService.getApplicableTier(months);
    const monthlyPrice = tier && tier.monthly_price ? tier.monthly_price : lease.monthly_price;
    const totalAmount = monthlyPrice * months * (tier?.discount_rate || 1);

    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO leases (id, space_id, tenant_id, vehicle_id, start_date, end_date, monthly_price, total_amount, paid_amount, status, contract_status, source, parent_lease_id, remark, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unconfirmed', 'renew', ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      lease.space_id,
      lease.tenant_id,
      lease.vehicle_id,
      startDate,
      endDate,
      monthlyPrice,
      totalAmount,
      0,
      leaseId,
      `续费${months}个月`,
      time,
      time
    );

    addLeaseTimeline(id, 'renew', { months, total_amount: totalAmount }, 'admin', '续费租约');
    addLeaseTimeline(leaseId, 'renewed', { new_lease_id: id, months }, 'admin', '被续费');
    auditLog('admin', 'renew', 'lease', id, null, { parent_lease_id: leaseId, months, total_amount: totalAmount }, '租约续费');

    LifecycleService.addSpaceLifecycleEvent(lease.space_id, 'lease_renew', { new_lease_id: id, months, total_amount: totalAmount }, id, lease.tenant_id, 'admin', '续费租约');

    return { success: true, lease: this.getById(id)! };
  }

  static confirmContract(leaseId: string): { success: boolean; lease?: Lease; message?: string } {
    const lease = this.getById(leaseId);
    if (!lease) {
      return { success: false, message: '租约不存在' };
    }
    if (lease.contract_status === 'confirmed') {
      return { success: false, message: '合同已确认' };
    }

    const stmt = db.prepare(`
      UPDATE leases SET contract_status = 'confirmed', status = 'active', updated_at = ? WHERE id = ?
    `);
    stmt.run(now(), leaseId);

    ParkingSpaceService.update(lease.space_id, { status: 'rented' } as any);

    VehicleService.setWhitelist(lease.vehicle_id, true);

    addLeaseTimeline(leaseId, 'confirm_contract', null, 'admin', '确认合同');
    auditLog('admin', 'confirm', 'lease', leaseId, lease, this.getById(leaseId), '确认合同');

    LifecycleService.addSpaceLifecycleEvent(lease.space_id, 'contract_confirmed', { lease_id: leaseId }, leaseId, lease.tenant_id, 'admin', '确认合同');

    return { success: true, lease: this.getById(leaseId)! };
  }

  static cancelLease(leaseId: string, reason?: string): { success: boolean; lease?: Lease; message?: string } {
    const lease = this.getById(leaseId);
    if (!lease) {
      return { success: false, message: '租约不存在' };
    }
    if (lease.status === 'cancelled') {
      return { success: false, message: '租约已取消' };
    }

    const stmt = db.prepare(`
      UPDATE leases SET status = 'cancelled', updated_at = ? WHERE id = ?
    `);
    stmt.run(now(), leaseId);

    const activeLease = this.getActiveLeaseBySpace(lease.space_id);
    if (!activeLease || activeLease.id === leaseId) {
      ParkingSpaceService.update(lease.space_id, { status: 'available' } as any);
    }

    addLeaseTimeline(leaseId, 'cancel', { reason }, 'admin', '取消租约');
    auditLog('admin', 'cancel', 'lease', leaseId, lease, this.getById(leaseId), `取消租约: ${reason || '无原因'}`);

    LifecycleService.addSpaceLifecycleEvent(lease.space_id, 'lease_cancel', { reason }, leaseId, lease.tenant_id, 'admin', '取消租约');

    return { success: true, lease: this.getById(leaseId)! };
  }

  static calculateRefund(leaseId: string): { success: boolean; refundAmount?: number; remainingDays?: number; message?: string } {
    const lease = this.getById(leaseId);
    if (!lease) {
      return { success: false, message: '租约不存在' };
    }
    if (lease.status !== 'active' && lease.status !== 'pending') {
      return { success: false, message: '租约状态不支持退租' };
    }
    if (lease.paid_amount <= 0) {
      return { success: true, refundAmount: 0, remainingDays: 0 };
    }

    const startDate = today() > lease.start_date ? today() : lease.start_date;
    const remainingDays = daysBetween(lease.end_date, startDate);
    
    if (remainingDays <= 0) {
      return { success: true, refundAmount: 0, remainingDays: 0 };
    }

    const totalDays = daysBetween(lease.end_date, lease.start_date);
    const dailyRate = lease.total_amount / totalDays;
    const refundAmount = Math.round(dailyRate * remainingDays * 100) / 100;

    return { success: true, refundAmount, remainingDays };
  }

  static terminateLease(leaseId: string, reason?: string): { success: boolean; refundAmount?: number; message?: string } {
    const lease = this.getById(leaseId);
    if (!lease) {
      return { success: false, message: '租约不存在' };
    }

    const refundResult = this.calculateRefund(leaseId);
    if (!refundResult.success) {
      return { success: false, message: refundResult.message };
    }

    const stmt = db.prepare(`
      UPDATE leases SET status = 'cancelled', updated_at = ? WHERE id = ?
    `);
    stmt.run(now(), leaseId);

    ParkingSpaceService.update(lease.space_id, { status: 'available' } as any);

    addLeaseTimeline(leaseId, 'terminate', { refund_amount: refundResult.refundAmount, reason }, 'admin', '退租');
    auditLog('admin', 'terminate', 'lease', leaseId, lease, null, `退租: ${reason || '无原因'}, 退款: ${refundResult.refundAmount}`);

    LifecycleService.addSpaceLifecycleEvent(lease.space_id, 'lease_terminate', { refund_amount: refundResult.refundAmount, reason }, leaseId, lease.tenant_id, 'admin', '退租释放车位');

    return { success: true, refundAmount: refundResult.refundAmount };
  }

  static processExpiredLeases(): { processed: number; recovered: number } {
    const expiredLeases = this.getExpiredLeases();
    let processed = 0;
    let recovered = 0;

    for (const lease of expiredLeases) {
      const stmt = db.prepare(`UPDATE leases SET status = 'expired', updated_at = ? WHERE id = ?`);
      stmt.run(now(), lease.id);
      processed++;

      if (isExpiredOver30Days(lease.end_date)) {
        ParkingSpaceService.update(lease.space_id, { status: 'available' } as any);
        recovered++;
        addLeaseTimeline(lease.id, 'expired_recovered', null, 'system', '过期30天，车位回收至可分配池');
        LifecycleService.addSpaceLifecycleEvent(lease.space_id, 'expired_recovered', null, lease.id, lease.tenant_id, 'system', '过期30天，车位回收至可分配池');
      } else {
        addLeaseTimeline(lease.id, 'expired', null, 'system', '租约到期');
        LifecycleService.addSpaceLifecycleEvent(lease.space_id, 'lease_expired', null, lease.id, lease.tenant_id, 'system', '租约到期');
      }
    }

    return { processed, recovered };
  }

  static batchRenew(leaseIds: string[], months: number): {
    success: boolean;
    successful: { leaseId: string; newLeaseId: string }[];
    failed: { leaseId: string; reason: string }[];
    conflicts?: { leaseId1: string; leaseId2: string; spaceId: string }[];
  } {
    const conflictCheck = LifecycleService.checkBatchRenewalConflicts(leaseIds);
    if (conflictCheck.hasConflicts) {
      return { success: false, successful: [], failed: [], conflicts: conflictCheck.conflicts };
    }

    const successful: { leaseId: string; newLeaseId: string }[] = [];
    const failed: { leaseId: string; reason: string }[] = [];

    for (const leaseId of leaseIds) {
      try {
        const result = this.renew(leaseId, months);
        if (result.success && result.lease) {
          successful.push({ leaseId, newLeaseId: result.lease.id });
        } else {
          failed.push({ leaseId, reason: result.message || '未知错误' });
        }
      } catch (e: any) {
        failed.push({ leaseId, reason: e.message || '系统错误' });
      }
    }

    auditLog('admin', 'batch_renew', 'lease', undefined, undefined, { count: successful.length, failed: failed.length }, '批量续租');

    return { success: failed.length === 0, successful, failed };
  }

  static calculateRenewalPrice(leaseId: string, months: number): {
    success: boolean;
    monthlyPrice?: number;
    discountRate?: number;
    originalAmount?: number;
    finalAmount?: number;
    message?: string;
  } {
    const lease = this.getById(leaseId);
    if (!lease) {
      return { success: false, message: '租约不存在' };
    }

    const tier = PriceTierService.getApplicableTier(months);
    const monthlyPrice = tier && tier.monthly_price ? tier.monthly_price : lease.monthly_price;
    const discountRate = tier?.discount_rate || 1;
    const originalAmount = monthlyPrice * months;
    const finalAmount = originalAmount * discountRate;

    return {
      success: true,
      monthlyPrice,
      discountRate,
      originalAmount,
      finalAmount: Math.round(finalAmount * 100) / 100,
    };
  }

  private static calculateMonths(startDate: string, endDate: string): number {
    const days = daysBetween(endDate, startDate);
    return Math.max(1, Math.ceil(days / 30));
  }

  static getTimeline(leaseId: string): any[] {
    const stmt = db.prepare('SELECT * FROM lease_timeline WHERE lease_id = ? ORDER BY created_at DESC');
    return stmt.all(leaseId);
  }

  static getDetail(id: string): any {
    const lease = this.getById(id);
    if (!lease) return null;

    const space = ParkingSpaceService.getById(lease.space_id);
    const tenant = TenantService.getById(lease.tenant_id);
    const vehicle = VehicleService.getById(lease.vehicle_id);
    const timeline = this.getTimeline(id);

    return {
      ...lease,
      space,
      tenant,
      vehicle,
      timeline,
    };
  }
}
