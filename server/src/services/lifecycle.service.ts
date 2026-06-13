import { db } from '../database';
import { ValidationCheck, ValidationContext, SpaceLifecycleLog, PlateChangeLog } from '../types';
import { generateId, now, today, auditLog, addLeaseTimeline } from '../utils';
import { ParkingSpaceService } from './parkingSpace.service';
import { LeaseService } from './lease.service';
import { TenantService } from './tenant.service';
import { VehicleService } from './vehicle.service';
import { ArrearsService } from './arrears.service';
import { InvoiceService } from './invoice.service';
import { FiscalPeriodService } from './fiscalPeriod.service';

export class LifecycleService {
  static addSpaceLifecycleEvent(
    spaceId: string,
    eventType: string,
    eventData?: any,
    leaseId?: string,
    tenantId?: string,
    operator?: string,
    remark?: string
  ): SpaceLifecycleLog {
    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO space_lifecycle_log (id, space_id, event_type, event_data, lease_id, tenant_id, operator, remark, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      spaceId,
      eventType,
      eventData ? JSON.stringify(eventData) : null,
      leaseId || null,
      tenantId || null,
      operator || null,
      remark || null,
      time
    );
    const row = db.prepare('SELECT * FROM space_lifecycle_log WHERE id = ?').get(id) as SpaceLifecycleLog;
    return row;
  }

  static validateForRenew(leaseId: string): ValidationContext {
    const checks: ValidationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const lease = LeaseService.getById(leaseId);
    if (!lease) {
      errors.push('租约不存在');
      return { checks, canProceed: false, warnings, errors };
    }

    const space = ParkingSpaceService.getById(lease.space_id);
    if (space) {
      if (space.status === 'frozen') {
        const check: ValidationCheck = { pass: false, field: 'space_frozen', message: '车位已冻结，无法续费', severity: 'error' };
        checks.push(check);
        errors.push(check.message);
      }
      if (space.temp_occupied) {
        const check: ValidationCheck = { pass: true, field: 'space_temp_occupied', message: '车位临时占用中', severity: 'warning' };
        checks.push(check);
        warnings.push(check.message);
      }
    }

    const tenant = TenantService.getById(lease.tenant_id);
    if (tenant && tenant.is_blacklisted) {
      const check: ValidationCheck = { pass: false, field: 'tenant_blacklisted', message: '租户在黑名单中，无法续费', severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    }

    const unpaidArrears = ArrearsService.getUnpaidByTenant(lease.tenant_id);
    const over30 = unpaidArrears.filter(a => a.age_days > 30);
    if (over30.length > 0) {
      const check: ValidationCheck = { pass: false, field: 'arrears_overdue', message: `存在${over30.length}笔超30天未结清欠费，无法续费`, severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    } else if (unpaidArrears.length > 0) {
      const check: ValidationCheck = { pass: true, field: 'arrears_unpaid', message: `存在${unpaidArrears.length}笔未结清欠费`, severity: 'warning' };
      checks.push(check);
      warnings.push(check.message);
    }

    if (lease.contract_status !== 'confirmed') {
      const check: ValidationCheck = { pass: false, field: 'contract_status', message: '合同未确认，无法续费', severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    }

    const invoices = InvoiceService.getAll({ lease_id: leaseId, status: 'pending' });
    if (invoices.list.length > 0) {
      const check: ValidationCheck = { pass: true, field: 'invoice_pending', message: '存在待处理的发票申请，发票抬头可能不匹配', severity: 'warning' };
      checks.push(check);
      warnings.push(check.message);
    }

    if (FiscalPeriodService.isPeriodClosed(lease.end_date)) {
      const check: ValidationCheck = { pass: false, field: 'fiscal_period_closed', message: '租约结束日期所在会计期间已关闭，无法续费', severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    }

    if (space && space.lock_status === 'locked') {
      const check: ValidationCheck = { pass: true, field: 'lock_status', message: '车位锁状态异常（已锁定）', severity: 'warning' };
      checks.push(check);
      warnings.push(check.message);
    }

    return { checks, canProceed: errors.length === 0, warnings, errors };
  }

  static validateForTerminate(leaseId: string): ValidationContext {
    const checks: ValidationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const lease = LeaseService.getById(leaseId);
    if (!lease) {
      errors.push('租约不存在');
      return { checks, canProceed: false, warnings, errors };
    }

    if (FiscalPeriodService.isPeriodClosed(today())) {
      const check: ValidationCheck = { pass: false, field: 'fiscal_period_closed', message: '当前会计期间已关闭，请使用调整单进行退租', severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    }

    const unpaidArrears = ArrearsService.getUnpaidByTenant(lease.tenant_id);
    if (unpaidArrears.length > 0) {
      const check: ValidationCheck = { pass: true, field: 'arrears_unpaid', message: `存在${unpaidArrears.length}笔未结清欠费`, severity: 'warning' };
      checks.push(check);
      warnings.push(check.message);
    }

    const invoices = InvoiceService.getAll({ lease_id: leaseId, status: 'pending' });
    if (invoices.list.length > 0) {
      const check: ValidationCheck = { pass: true, field: 'invoice_pending', message: `存在${invoices.list.length}笔待处理的发票申请`, severity: 'warning' };
      checks.push(check);
      warnings.push(check.message);
    }

    return { checks, canProceed: errors.length === 0, warnings, errors };
  }

  static validateForSwap(leaseId: string, newSpaceId: string): ValidationContext {
    const checks: ValidationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const lease = LeaseService.getById(leaseId);
    if (!lease) {
      errors.push('租约不存在');
      return { checks, canProceed: false, warnings, errors };
    }

    const oldSpace = ParkingSpaceService.getById(lease.space_id);
    if (oldSpace && oldSpace.status === 'frozen') {
      const check: ValidationCheck = { pass: false, field: 'old_space_frozen', message: '原车位已冻结，无法换位', severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    }

    const newSpace = ParkingSpaceService.getById(newSpaceId);
    if (!newSpace) {
      const check: ValidationCheck = { pass: false, field: 'new_space_not_found', message: '目标车位不存在', severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    } else {
      if (newSpace.status !== 'available') {
        const check: ValidationCheck = { pass: false, field: 'new_space_unavailable', message: '目标车位不可用', severity: 'error' };
        checks.push(check);
        errors.push(check.message);
      }
      if (newSpace.status === 'frozen') {
        const check: ValidationCheck = { pass: false, field: 'new_space_frozen', message: '目标车位已冻结', severity: 'error' };
        checks.push(check);
        errors.push(check.message);
      }
      if (newSpace.temp_occupied) {
        const check: ValidationCheck = { pass: true, field: 'new_space_temp_occupied', message: '目标车位临时占用中', severity: 'warning' };
        checks.push(check);
        warnings.push(check.message);
      }
      if (newSpace.lock_status === 'locked') {
        const check: ValidationCheck = { pass: true, field: 'new_space_locked', message: '目标车位锁状态异常（已锁定）', severity: 'warning' };
        checks.push(check);
        warnings.push(check.message);
      }
    }

    const tenant = TenantService.getById(lease.tenant_id);
    if (tenant && tenant.is_blacklisted) {
      const check: ValidationCheck = { pass: false, field: 'tenant_blacklisted', message: '租户在黑名单中，无法换位', severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    }

    const unpaidArrears = ArrearsService.getUnpaidByTenant(lease.tenant_id);
    if (unpaidArrears.length > 0) {
      const check: ValidationCheck = { pass: true, field: 'arrears_unpaid', message: `存在${unpaidArrears.length}笔未结清欠费`, severity: 'warning' };
      checks.push(check);
      warnings.push(check.message);
    }

    return { checks, canProceed: errors.length === 0, warnings, errors };
  }

  static validateForPlateChange(leaseId: string, newPlateNo: string): ValidationContext {
    const checks: ValidationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const lease = LeaseService.getById(leaseId);
    if (!lease) {
      errors.push('租约不存在');
      return { checks, canProceed: false, warnings, errors };
    }

    if (lease.status !== 'active') {
      const check: ValidationCheck = { pass: false, field: 'lease_inactive', message: '租约未生效，无法更换车牌', severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    }

    const conflictStmt = db.prepare(`
      SELECT l.* FROM leases l
      JOIN vehicles v ON l.vehicle_id = v.id
      WHERE v.plate_no = ? AND l.status = 'active' AND l.id != ?
    `);
    const conflicts = conflictStmt.all(newPlateNo, leaseId);
    if (conflicts.length > 0) {
      const check: ValidationCheck = { pass: false, field: 'plate_conflict', message: '新车牌号已在其他生效租约中使用', severity: 'error' };
      checks.push(check);
      errors.push(check.message);
    }

    if (FiscalPeriodService.isPeriodClosed(today())) {
      const check: ValidationCheck = { pass: true, field: 'fiscal_period_closed', message: '当前会计期间已关闭，可能需要调整单', severity: 'warning' };
      checks.push(check);
      warnings.push(check.message);
    }

    return { checks, canProceed: errors.length === 0, warnings, errors };
  }

  static changePlate(leaseId: string, newPlateNo: string, reason?: string, operator?: string): {
    success: boolean;
    plateChangeLog?: PlateChangeLog;
    message?: string;
  } {
    const validation = this.validateForPlateChange(leaseId, newPlateNo);
    if (!validation.canProceed) {
      return { success: false, message: validation.errors.join('; ') };
    }

    const lease = LeaseService.getById(leaseId)!;
    const vehicle = VehicleService.getById(lease.vehicle_id);
    if (!vehicle) {
      return { success: false, message: '车辆不存在' };
    }

    const oldPlateNo = vehicle.plate_no;
    VehicleService.update(vehicle.id, { plate_no: newPlateNo } as any);

    const id = generateId();
    const time = now();
    const stmt = db.prepare(`
      INSERT INTO plate_change_logs (id, lease_id, vehicle_id, old_plate_no, new_plate_no, reason, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, leaseId, vehicle.id, oldPlateNo, newPlateNo, reason || null, operator || null, time);

    this.addSpaceLifecycleEvent(
      lease.space_id,
      'plate_change',
      { old_plate_no: oldPlateNo, new_plate_no: newPlateNo },
      leaseId,
      lease.tenant_id,
      operator,
      reason || '更换车牌'
    );

    addLeaseTimeline(leaseId, 'plate_change', { old_plate_no: oldPlateNo, new_plate_no: newPlateNo, reason }, operator, '更换车牌');

    auditLog(operator || 'admin', 'plate_change', 'lease', leaseId, { plate_no: oldPlateNo }, { plate_no: newPlateNo }, `更换车牌: ${oldPlateNo} -> ${newPlateNo}`);

    const log = db.prepare('SELECT * FROM plate_change_logs WHERE id = ?').get(id) as PlateChangeLog;
    return { success: true, plateChangeLog: log };
  }

  static getSpaceLifecycle(spaceId: string): any[] {
    const stmt = db.prepare(`
      SELECT sl.*, l.start_date as lease_start_date, l.end_date as lease_end_date, l.status as lease_status,
             t.name as tenant_name, t.phone as tenant_phone
      FROM space_lifecycle_log sl
      LEFT JOIN leases l ON sl.lease_id = l.id
      LEFT JOIN tenants t ON sl.tenant_id = t.id
      WHERE sl.space_id = ?
      ORDER BY sl.created_at ASC
    `);
    return stmt.all(spaceId);
  }

  static getSpaceFullLifecycle(spaceId: string): {
    space: any;
    lifecycle_logs: any[];
    leases: any[];
    total_rental_count: number;
    total_revenue: number;
  } | null {
    const space = ParkingSpaceService.getById(spaceId);
    if (!space) return null;

    const lifecycleLogs = this.getSpaceLifecycle(spaceId);

    const leasesStmt = db.prepare('SELECT * FROM leases WHERE space_id = ? ORDER BY start_date ASC');
    const leases = leasesStmt.all(spaceId);

    let totalRevenue = 0;
    for (const lease of leases) {
      totalRevenue += (lease as any).paid_amount || 0;
    }

    return {
      space,
      lifecycle_logs: lifecycleLogs,
      leases,
      total_rental_count: leases.length,
      total_revenue: totalRevenue,
    };
  }

  static detectLockAnomaly(spaceId: string): { anomaly: boolean; type?: string; message?: string } {
    const space = ParkingSpaceService.getById(spaceId);
    if (!space) return { anomaly: false };

    if (space.status === 'rented' && space.lock_status === 'unlocked') {
      return { anomaly: true, type: 'rented_unlocked', message: '车位已出租但锁未锁定' };
    }
    if (space.status === 'available' && space.lock_status === 'locked') {
      return { anomaly: true, type: 'available_locked', message: '车位空闲但锁已锁定' };
    }

    return { anomaly: false };
  }

  static detectFamilyMultiCarMerge(tenantId: string): {
    shouldMerge: boolean;
    leases: any[];
  } {
    const leases = LeaseService.getActiveLeaseByTenant(tenantId);
    const familyLeases = leases.filter(l => {
      const vehicle = VehicleService.getById(l.vehicle_id);
      return vehicle && vehicle.is_family;
    });

    return {
      shouldMerge: familyLeases.length > 1,
      leases: familyLeases,
    };
  }

  static checkBatchRenewalConflicts(leaseIds: string[]): { hasConflicts: boolean; conflicts: { leaseId1: string; leaseId2: string; spaceId: string }[] } {
    const conflicts: { leaseId1: string; leaseId2: string; spaceId: string }[] = [];
    const leaseMap = new Map<string, string>();

    for (const leaseId of leaseIds) {
      const lease = LeaseService.getById(leaseId);
      if (!lease) continue;

      const existingLeaseId = leaseMap.get(lease.space_id);
      if (existingLeaseId) {
        conflicts.push({ leaseId1: existingLeaseId, leaseId2: leaseId, spaceId: lease.space_id });
      } else {
        leaseMap.set(lease.space_id, leaseId);
      }
    }

    return { hasConflicts: conflicts.length > 0, conflicts };
  }
}
