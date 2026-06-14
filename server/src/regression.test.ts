import { initDatabase, db } from './database';
import { ParkingSpaceService } from './services/parkingSpace.service';
import { TenantService } from './services/tenant.service';
import { VehicleService } from './services/vehicle.service';
import { LeaseService } from './services/lease.service';
import { LifecycleService } from './services/lifecycle.service';
import { SpaceSwapService } from './services/spaceSwap.service';
import { today, addDays, addMonths } from './utils';

let passCount = 0;
let failCount = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passCount++;
    console.log(`  ✅ PASS: ${msg}`);
  } else {
    failCount++;
    console.error(`  ❌ FAIL: ${msg}`);
  }
}

async function runRegressionTests() {
  console.log('\n========================================');
  console.log(' 车位生命周期数据链路回归测试');
  console.log('========================================\n');

  await initDatabase();

  // ============================================================
  // 测试1: A-005 有原始租约和续费租约
  // ============================================================
  console.log('【测试1】A-005 有原始租约和续费租约');
  const a005 = ParkingSpaceService.getByCode('A-005');
  assert(!!a005, 'A-005 车位存在');
  if (a005) {
    const lifecycle = LifecycleService.getSpaceFullLifecycle(a005.id);
    assert(!!lifecycle, 'getSpaceFullLifecycle 返回数据非空');
    if (lifecycle) {
      assert(lifecycle.leases.length >= 2, `租约数量 >= 2 (实际: ${lifecycle.leases.length})`);
      assert(lifecycle.statistics.total_rental_count >= 2, `statistics.total_rental_count >= 2 (实际: ${lifecycle.statistics.total_rental_count})`);
      assert(lifecycle.lifecycle_logs.length > 0, `生命周期事件非空 (实际: ${lifecycle.lifecycle_logs.length} 条)`);
      assert(lifecycle.statistics.total_revenue > 0, `累计收入 > 0 (实际: ¥${lifecycle.statistics.total_revenue})`);

      // 检查租约 JOIN 是否成功
      const hasTenant = lifecycle.leases.every((l: any) => l.tenant && l.tenant.name);
      const hasVehicle = lifecycle.leases.every((l: any) => l.vehicle && l.vehicle.plate_no);
      assert(hasTenant, '所有租约都 JOIN 了 tenant 信息');
      assert(hasVehicle, '所有租约都 JOIN 了 vehicle 信息');

      // 检查 event_data 是否已解析
      const logsWithData = lifecycle.lifecycle_logs.filter((l: any) => l.event_data);
      if (logsWithData.length > 0) {
        const isParsed = typeof logsWithData[0].event_data === 'object';
        assert(isParsed, 'event_data 已 JSON.parse 为对象');
      }

      console.log(`   事件清单 (共${lifecycle.lifecycle_logs.length}条):`);
      lifecycle.lifecycle_logs.forEach((log: any) => {
        console.log(`     - [${log.created_at}] ${log.event_type} | ${log.remark || ''}`);
      });

      // 检查关键事件是否存在
      const eventTypes = lifecycle.lifecycle_logs.map((l: any) => l.event_type);
      assert(eventTypes.includes('space_created'), '包含 space_created 事件');
      assert(eventTypes.includes('lease_create'), '包含 lease_create 事件');
      assert(eventTypes.includes('contract_confirmed'), '包含 contract_confirmed 事件');
      const renewCount = eventTypes.filter((e: string) => e === 'lease_renew').length;
      assert(renewCount >= 1, `包含至少1个 lease_renew 事件 (实际: ${renewCount})`);
    }
  }

  // ============================================================
  // 测试2: 构造一个完整的 出租 → 释放 → 再分配 流水
  // ============================================================
  console.log('\n【测试2】完整生命周期: 出租 → 释放 → 再分配');

  const availableSpaces = ParkingSpaceService.getAll({ status: 'available' });
  assert(availableSpaces.length > 0, `存在可用车位 (实际: ${availableSpaces.length})`);

  if (availableSpaces.length > 0) {
    const targetSpace = availableSpaces[0];
    console.log(`   目标车位: ${targetSpace.code} (id=${targetSpace.id})`);

    const tenants = TenantService.getAll();
    const vehicles = VehicleService.getAll();
    const tenant1 = tenants.find((t: any) => !t.is_blacklisted);
    const vehicle1 = vehicles.find((v: any) => v.tenant_id === tenant1?.id);
    const tenant2 = tenants.find((t: any) => !t.is_blacklisted && t.id !== tenant1?.id);
    const vehicle2 = vehicles.find((v: any) => v.tenant_id === tenant2?.id);

    assert(!!tenant1 && !!vehicle1 && !!tenant2 && !!vehicle2, '租户1、车辆1、租户2、车辆2 都存在');

    if (tenant1 && vehicle1 && tenant2 && vehicle2) {
      // 阶段1: 出租给租户1
      console.log('   阶段1: 出租给租户1');
      const s1Start = addDays(today(), -90);
      const s1End = addMonths(s1Start, 1);
      const r1 = LeaseService.create({
        space_id: targetSpace.id,
        tenant_id: tenant1.id,
        vehicle_id: vehicle1.id,
        start_date: s1Start,
        end_date: s1End,
        monthly_price: 300,
        remark: '回归测试: 出租'
      });
      assert(r1.success && !!r1.lease, `创建租约1成功 (lease_id=${r1.lease?.id})`);

      if (r1.success && r1.lease) {
        LeaseService.confirmContract(r1.lease.id);
        db.prepare('UPDATE leases SET status = ?, paid_amount = ? WHERE id = ?').run('active', 300, r1.lease.id);

        // 阶段2: 租户1退租(释放)
        console.log('   阶段2: 租户1退租释放');
        const tr = LeaseService.terminateLease(r1.lease.id, '回归测试退租');
        assert(tr.success, `退租成功 (退款¥${tr.refundAmount})`);

        // 阶段3: 再分配给租户2
        console.log('   阶段3: 再分配给租户2');
        const s2Start = today();
        const s2End = addMonths(s2Start, 3);
        const r2 = LeaseService.create({
          space_id: targetSpace.id,
          tenant_id: tenant2.id,
          vehicle_id: vehicle2.id,
          start_date: s2Start,
          end_date: s2End,
          monthly_price: 300,
          remark: '回归测试: 再分配'
        });
        assert(r2.success && !!r2.lease, `创建租约2成功 (lease_id=${r2.lease?.id})`);
        if (r2.success && r2.lease) {
          LeaseService.confirmContract(r2.lease.id);
        }

        // 验证完整流水
        const fullLc = LifecycleService.getSpaceFullLifecycle(targetSpace.id);
        assert(!!fullLc, '目标车位完整生命周期非空');
        if (fullLc) {
          const types = fullLc.lifecycle_logs.map((l: any) => l.event_type);
          console.log(`   该车位事件: ${types.join(' → ')}`);

          const hasTerminate = types.includes('lease_terminate');
          const hasSecondCreate = types.filter((t: string) => t === 'lease_create').length >= 2;
          const hasSecondConfirm = types.filter((t: string) => t === 'contract_confirmed').length >= 2;

          assert(hasTerminate, '包含 lease_terminate (释放) 事件');
          assert(hasSecondCreate, '包含至少2次 lease_create (含再分配)');
          assert(hasSecondConfirm, '包含至少2次 contract_confirmed (含再分配)');
          assert(fullLc.leases.length >= 2, `该车位累计租约 >= 2 (实际: ${fullLc.leases.length})`);
          assert(fullLc.statistics.total_rental_count >= 2, `statistics.total_rental_count >= 2 (实际: ${fullLc.statistics.total_rental_count})`);
        }
      }
    }
  }

  // ============================================================
  // 测试3: 车位调换生命周期
  // ============================================================
  console.log('\n【测试3】车位调换写入生命周期事件');

  const availableForSwap = ParkingSpaceService.getAll({ status: 'available' });
  const activeLeases = LeaseService.getAll({ status: 'active' }).list;
  if (availableForSwap.length > 0 && activeLeases.length > 0) {
    const srcLease = activeLeases[0];
    const destSpace = availableForSwap[0];
    console.log(`   源租约: space_id=${srcLease.space_id} → 目标车位: ${destSpace.code}`);

    const beforeOld = LifecycleService.getSpaceLifecycle(srcLease.space_id).length;
    const beforeNew = LifecycleService.getSpaceLifecycle(destSpace.id).length;

    const swap = SpaceSwapService.create({
      lease_id: srcLease.id,
      old_space_id: srcLease.space_id,
      new_space_id: destSpace.id,
      tenant_id: srcLease.tenant_id,
      reason: '回归测试调换'
    });
    assert(swap.success, '调换申请创建成功');

    if (swap.success && swap.swap) {
      const afterOld = LifecycleService.getSpaceLifecycle(srcLease.space_id).length;
      const afterNew = LifecycleService.getSpaceLifecycle(destSpace.id).length;
      assert(afterOld > beforeOld, `源车位生命周期条数增加 (${beforeOld} → ${afterOld})`);

      const ap = SpaceSwapService.approve(swap.swap.id, 'admin', '审批通过');
      assert(ap.success, '调换审批通过');

      const finalOld = LifecycleService.getSpaceLifecycle(srcLease.space_id);
      const finalNew = LifecycleService.getSpaceLifecycle(destSpace.id);
      const oldHasSwap = finalOld.some((l: any) => l.event_type === 'swap_completed');
      const newHasSwap = finalNew.some((l: any) => l.event_type === 'swap_completed');
      assert(oldHasSwap, '源车位包含 swap_completed 事件');
      assert(newHasSwap, '目标车位包含 swap_completed 事件');
    }
  } else {
    console.log('   ⚠️ 跳过: 没有可用车位或活跃租约用于调换测试');
  }

  // ============================================================
  // 测试4: 锁异常检测字段兼容
  // ============================================================
  console.log('\n【测试4】锁异常检测字段兼容 (detected + anomaly 双字段)');
  const testSpace = ParkingSpaceService.getAll()[0];
  if (testSpace) {
    const anomaly = LifecycleService.detectLockAnomaly(testSpace.id);
    assert('detected' in anomaly, '返回包含 detected 字段');
    assert('anomaly' in anomaly, '返回包含 anomaly 字段(向后兼容)');
    console.log(`   车位 ${testSpace.code}: detected=${anomaly.detected}, anomaly=${anomaly.anomaly}`);
  }

  // ============================================================
  // 总结
  // ============================================================
  console.log('\n========================================');
  console.log(` 测试结果: 通过 ${passCount} / ${passCount + failCount}`);
  console.log('========================================\n');

  db.forceSave();
  if (failCount > 0) {
    process.exit(1);
  }
}

runRegressionTests().catch(e => {
  console.error('Regression test crashed:', e);
  process.exit(1);
});
