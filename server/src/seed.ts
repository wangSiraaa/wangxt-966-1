import { initDatabase, db } from './database';
import { ParkingSpaceService } from './services/parkingSpace.service';
import { TenantService } from './services/tenant.service';
import { VehicleService } from './services/vehicle.service';
import { LeaseService } from './services/lease.service';
import { ArrearsService } from './services/arrears.service';
import { PriceTierService } from './services/priceTier.service';
import { today, addDays, addMonths, daysBetween } from './utils';

async function seedDatabase() {
  await initDatabase();

  console.log('Seeding database...');

  const existingSpaces = ParkingSpaceService.getAll();
  if (existingSpaces.length > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Creating price tiers...');
  PriceTierService.create({
    name: '月度会员',
    min_months: 1,
    max_months: 2,
    discount_rate: 1,
    monthly_price: 300,
    description: '1-2个月原价'
  });
  PriceTierService.create({
    name: '季度优惠',
    min_months: 3,
    max_months: 5,
    discount_rate: 0.95,
    monthly_price: 300,
    description: '3-5个月95折'
  });
  PriceTierService.create({
    name: '半年优惠',
    min_months: 6,
    max_months: 11,
    discount_rate: 0.9,
    monthly_price: 300,
    description: '6-11个月9折'
  });
  PriceTierService.create({
    name: '年度特惠',
    min_months: 12,
    discount_rate: 0.85,
    monthly_price: 300,
    description: '12个月以上85折'
  });

  console.log('Creating parking spaces...');
  const spaceCodes = [
    'A-001', 'A-002', 'A-003', 'A-004', 'A-005',
    'A-006', 'A-007', 'A-008', 'A-009', 'A-010',
    'B-001', 'B-002', 'B-003', 'B-004', 'B-005',
    'B-006', 'B-007', 'B-008', 'B-009', 'B-010',
  ];

  spaceCodes.forEach(code => {
    ParkingSpaceService.create({
      code,
      location: `地下${code.charAt(0)}区`,
      type: code.startsWith('A') ? 'standard' : 'large',
    });
  });

  console.log('Creating tenants...');
  const tenants = [
    { name: '张三', phone: '13800000001', id_card: '110101199001010001', address: '小区1号楼101' },
    { name: '李四', phone: '13800000002', id_card: '110101199002020002', address: '小区2号楼202' },
    { name: '王五', phone: '13800000003', id_card: '110101199003030003', address: '小区3号楼303' },
    { name: '赵六', phone: '13800000004', id_card: '110101199004040004', address: '小区4号楼404' },
    { name: '钱七', phone: '13800000005', id_card: '110101199005050005', address: '小区5号楼505' },
    { name: '孙八', phone: '13800000006', id_card: '110101199006060006', address: '小区6号楼606' },
    { name: '黑名单用户', phone: '13800000099', id_card: '110101199012120099', address: '小区9号楼999', is_blacklisted: 1 },
  ];

  const createdTenants = tenants.map(t => TenantService.create(t));

  console.log('Creating vehicles...');
  const vehicles = [
    { tenant_idx: 0, plate_no: '京A12345', plate_color: 'blue', is_family: 0 },
    { tenant_idx: 0, plate_no: '京A67890', plate_color: 'blue', is_family: 1 },
    { tenant_idx: 1, plate_no: '京B11111', plate_color: 'blue', is_family: 0 },
    { tenant_idx: 2, plate_no: '京C22222', plate_color: 'green', is_family: 0 },
    { tenant_idx: 2, plate_no: '京C33333', plate_color: 'blue', is_family: 1 },
    { tenant_idx: 3, plate_no: '京D44444', plate_color: 'blue', is_family: 0 },
    { tenant_idx: 4, plate_no: '京E55555', plate_color: 'yellow', is_family: 0 },
    { tenant_idx: 5, plate_no: '京F66666', plate_color: 'blue', is_family: 0 },
    { tenant_idx: 6, plate_no: '京Z99999', plate_color: 'blue', is_family: 0 },
  ];

  vehicles.forEach(v => {
    VehicleService.create({
      tenant_id: createdTenants[v.tenant_idx].id,
      plate_no: v.plate_no,
      plate_color: v.plate_color,
      is_family: v.is_family,
    });
  });

  console.log('Creating leases...');
  const allVehicles = VehicleService.getAll();
  
  const leaseConfigs = [
    { tenant_idx: 0, space_idx: 0, vehicle_plate: '京A12345', start_offset: -30, months: 6, active: true, confirmed: true },
    { tenant_idx: 1, space_idx: 1, vehicle_plate: '京B11111', start_offset: -60, months: 3, active: true, confirmed: true },
    { tenant_idx: 2, space_idx: 2, vehicle_plate: '京C22222', start_offset: -45, months: 12, active: true, confirmed: true },
    { tenant_idx: 3, space_idx: 3, vehicle_plate: '京D44444', start_offset: -400, months: 12, active: true, confirmed: true },
    { tenant_idx: 4, space_idx: 4, vehicle_plate: '京E55555', start_offset: -20, months: 1, active: true, confirmed: true },
    { tenant_idx: 5, space_idx: 5, vehicle_plate: '京F66666', start_offset: -15, months: 3, active: true, confirmed: false },
  ];

  leaseConfigs.forEach(config => {
    const tenant = createdTenants[config.tenant_idx];
    const vehicle = allVehicles.find(v => v.plate_no === config.vehicle_plate);
    if (!vehicle) return;

    const startDate = addDays(today(), config.start_offset);
    const endDate = addMonths(startDate, config.months);

    const result = LeaseService.create({
      space_id: ParkingSpaceService.getAll()[config.space_idx].id,
      tenant_id: tenant.id,
      vehicle_id: vehicle.id,
      start_date: startDate,
      end_date: endDate,
      monthly_price: 300,
    });

    if (result.success && result.lease) {
      if (config.confirmed) {
        LeaseService.confirmContract(result.lease.id);
      }
      
      if (config.active) {
        db.prepare('UPDATE leases SET status = ? WHERE id = ?').run('active', result.lease.id);
        db.prepare('UPDATE parking_spaces SET status = ? WHERE id = ?').run(
          'rented',
          ParkingSpaceService.getAll()[config.space_idx].id
        );
      }
    }
  });

  console.log('Creating arrears...');
  const activeLeases = LeaseService.getAll({ status: 'active' }).list;
  
  if (activeLeases.length >= 2) {
    ArrearsService.create({
      lease_id: activeLeases[1].id,
      tenant_id: activeLeases[1].tenant_id,
      amount: 600,
      arrears_type: 'rent',
      due_date: addDays(today(), -45),
      remark: '历史欠缴2个月租金',
    });
    ArrearsService.create({
      lease_id: activeLeases[3].id,
      tenant_id: activeLeases[3].tenant_id,
      amount: 1200,
      arrears_type: 'rent',
      due_date: addDays(today(), -100),
      remark: '长期欠费',
    });
  }

  console.log('Freezing a space for demo...');
  const allSpaces = ParkingSpaceService.getAll();
  if (allSpaces.length > 10) {
    ParkingSpaceService.freeze(allSpaces[10].id, '维修维护中');
  }

  console.log('Setting temp occupied for demo...');
  if (allSpaces.length > 15) {
    ParkingSpaceService.setTempOccupied(allSpaces[15].id, true);
  }

  ArrearsService.updateAgeDays();
  LeaseService.processExpiredLeases();

  console.log('Database seeded successfully!');
  console.log(`- ${ParkingSpaceService.getAll().length} parking spaces`);
  console.log(`- ${TenantService.getAll().length} tenants`);
  console.log(`- ${VehicleService.getAll().length} vehicles`);
  console.log(`- ${LeaseService.getAll({}).list.length} leases`);
  console.log(`- ${ArrearsService.getAll({}).list.length} arrears records`);
}

seedDatabase().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
});
