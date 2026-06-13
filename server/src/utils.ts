import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from './database';

export function generateId(): string {
  return uuidv4();
}

export function now(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

export function today(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function daysBetween(date1: string, date2: string): number {
  return dayjs(date1).diff(dayjs(date2), 'day');
}

export function addMonths(date: string, months: number): string {
  return dayjs(date).add(months, 'month').format('YYYY-MM-DD');
}

export function addDays(date: string, days: number): string {
  return dayjs(date).add(days, 'day').format('YYYY-MM-DD');
}

export function isExpired(endDate: string): boolean {
  return dayjs().isAfter(dayjs(endDate), 'day');
}

export function isExpiredOver30Days(endDate: string): boolean {
  return dayjs().diff(dayjs(endDate), 'day') > 30;
}

export function auditLog(operator: string, action: string, module: string, targetId?: string, beforeData?: any, afterData?: any, remark?: string) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, operator, action, module, target_id, before_data, after_data, remark, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    generateId(),
    operator,
    action,
    module,
    targetId,
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    remark || null,
    now()
  );
}

export function addLeaseTimeline(leaseId: string, eventType: string, eventData?: any, operator?: string, remark?: string) {
  const stmt = db.prepare(`
    INSERT INTO lease_timeline (id, lease_id, event_type, event_data, operator, remark, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    generateId(),
    leaseId,
    eventType,
    eventData ? JSON.stringify(eventData) : null,
    operator || null,
    remark || null,
    now()
  );
}

export function successResponse(data?: any, message?: string) {
  return {
    success: true,
    data,
    message
  };
}

export function errorResponse(message: string, error?: string) {
  return {
    success: false,
    message,
    error
  };
}
