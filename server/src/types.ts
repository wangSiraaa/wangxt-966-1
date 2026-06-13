export interface ParkingSpace {
  id: string;
  code: string;
  location?: string;
  type: string;
  status: 'available' | 'rented' | 'frozen' | 'temporary';
  lock_status: 'locked' | 'unlocked';
  temp_occupied: number;
  frozen_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  id_card?: string;
  address?: string;
  is_blacklisted: number;
  blacklist_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  tenant_id: string;
  plate_no: string;
  plate_color: string;
  vehicle_type: string;
  is_family: number;
  is_whitelisted: number;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface Lease {
  id: string;
  space_id: string;
  tenant_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  monthly_price: number;
  total_amount: number;
  paid_amount: number;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  contract_status: 'unconfirmed' | 'confirmed';
  source: 'new' | 'renew' | 'swap';
  parent_lease_id?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface Arrears {
  id: string;
  lease_id: string;
  tenant_id: string;
  amount: number;
  arrears_type: string;
  due_date: string;
  status: 'unpaid' | 'partial' | 'paid';
  paid_date?: string;
  age_days: number;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  lease_id: string;
  tenant_id: string;
  title: string;
  tax_no?: string;
  amount: number;
  invoice_type: string;
  status: 'pending' | 'issued' | 'cancelled';
  issued_date?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface SpaceSwap {
  id: string;
  lease_id: string;
  old_space_id: string;
  new_space_id: string;
  tenant_id: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approver?: string;
  approve_remark?: string;
  approved_at?: string;
  effective_date?: string;
  created_at: string;
  updated_at: string;
}

export interface PriceTier {
  id: string;
  name: string;
  min_months: number;
  max_months?: number;
  discount_rate: number;
  monthly_price?: number;
  description?: string;
  is_active: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  operator: string;
  action: string;
  module: string;
  target_id?: string;
  before_data?: string;
  after_data?: string;
  ip?: string;
  remark?: string;
  created_at: string;
}

export interface LeaseTimeline {
  id: string;
  lease_id: string;
  event_type: string;
  event_data?: string;
  operator?: string;
  remark?: string;
  created_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FiscalPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  closed_by?: string;
  closed_at?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface AdjustmentOrder {
  id: string;
  lease_id: string;
  tenant_id: string;
  space_id: string;
  order_type: 'price_diff' | 'refund' | 'late_fee';
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approved_by?: string;
  approved_at?: string;
  fiscal_period_id?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface WaitlistEntry {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  preferred_type?: string;
  preferred_location?: string;
  status: 'waiting' | 'assigned' | 'cancelled';
  priority: number;
  assigned_space_id?: string;
  assigned_at?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface SpaceLifecycleLog {
  id: string;
  space_id: string;
  event_type: string;
  event_data?: string;
  lease_id?: string;
  tenant_id?: string;
  operator?: string;
  remark?: string;
  created_at: string;
}

export interface PlateChangeLog {
  id: string;
  lease_id: string;
  vehicle_id: string;
  old_plate_no: string;
  new_plate_no: string;
  reason?: string;
  operator?: string;
  created_at: string;
}

export interface ValidationCheck {
  pass: boolean;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationContext {
  checks: ValidationCheck[];
  canProceed: boolean;
  warnings: string[];
  errors: string[];
}
