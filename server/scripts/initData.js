const dayjs = require('dayjs');
const db = require('../db/database');

async function initDemoData() {
  const existingSpaces = await db.prepare('SELECT COUNT(*) as cnt FROM parking_spaces').get();
  if (existingSpaces.cnt > 0) {
    console.log('数据已存在，跳过初始化');
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const spaces = [];
      for (let i = 1; i <= 20; i++) {
        const floor = i <= 10 ? 'B1' : 'B2';
        const num = String(i).padStart(3, '0');
        spaces.push([`${floor}-${num}`, `${floor}层${num}号`, 'available', 0]);
      }
      spaces[0][3] = 1;
      spaces[0][2] = 'frozen';
      spaces.push(['FROZEN-001', '测试冻结车位', 'frozen', 1]);

      for (const s of spaces) {
        await tx.prepare(`
          INSERT INTO parking_spaces (space_no, location, status, is_frozen)
          VALUES (?, ?, ?, ?)
        `).run(...s);
      }

      const tenants = [
        ['T001', '张三', '13800000001', '京A12345', '1号楼101'],
        ['T002', '李四', '13800000002', '京B67890', '2号楼202'],
        ['T003', '王五', '13800000003', '京C11111', '3号楼303'],
        ['T004', '赵六', '13800000004', '京D22222', '4号楼404'],
        ['T005', '钱七', '13800000005', '京E33333', '5号楼505']
      ];
      for (const t of tenants) {
        await tx.prepare(`
          INSERT INTO tenants (tenant_no, name, phone, license_plate, address)
          VALUES (?, ?, ?, ?, ?)
        `).run(...t);
      }

      const leasesData = [
        [1, 2, dayjs().subtract(3, 'month').format('YYYY-MM-DD'), dayjs().add(5, 'day').format('YYYY-MM-DD'), 500],
        [2, 3, dayjs().subtract(6, 'month').format('YYYY-MM-DD'), dayjs().add(12, 'day').format('YYYY-MM-DD'), 600],
        [3, 4, dayjs().subtract(12, 'month').format('YYYY-MM-DD'), dayjs().add(60, 'day').format('YYYY-MM-DD'), 550],
        [4, 5, dayjs().subtract(2, 'month').format('YYYY-MM-DD'), dayjs().subtract(10, 'day').format('YYYY-MM-DD'), 450],
        [5, 6, dayjs().subtract(4, 'month').format('YYYY-MM-DD'), dayjs().subtract(40, 'day').format('YYYY-MM-DD'), 500]
      ];

      for (const [tenantId, spaceId, start, end, monthly] of leasesData) {
        await tx.prepare('UPDATE parking_spaces SET status = ? WHERE id = ?').run('occupied', spaceId);
        const months = dayjs(end).diff(dayjs(start), 'month');
        await tx.prepare(`
          INSERT INTO leases (lease_no, tenant_id, space_id, start_date, end_date, monthly_amount, total_amount, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `L${tenantId}${spaceId}`,
          tenantId,
          spaceId,
          start,
          end,
          monthly,
          monthly * months,
          'active'
        );
      }

      await tx.prepare(`
        INSERT INTO arrears_records (record_no, tenant_id, lease_id, space_id, amount, arrears_type, description, status, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'AR-T004-001',
        4,
        4,
        5,
        900,
        'rent_arrears',
        '2024年3-4月租金欠费',
        'unsettled',
        dayjs().subtract(10, 'day').format('YYYY-MM-DD')
      );

      await tx.prepare(`
        INSERT INTO arrears_records (record_no, tenant_id, lease_id, space_id, amount, arrears_type, description, status, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'AR-T005-001',
        5,
        5,
        6,
        666.67,
        'lease_expired_arrears',
        '租约过期40天占用车位欠费',
        'unsettled',
        dayjs().subtract(40, 'day').format('YYYY-MM-DD')
      );

      await tx.prepare(`
        INSERT INTO payments (payment_no, tenant_id, lease_id, arrears_id, amount, payment_method, remark, operator)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'PAY-T001-001',
        1,
        1,
        null,
        1500,
        'cash',
        '首期3个月租金',
        '系统管理员'
      );
    });

    console.log('演示数据初始化成功');
  } catch (e) {
    console.error('初始化演示数据失败:', e);
  }
}

if (require.main === module) {
  (async () => {
    await db.initDatabase();
    await initDemoData();
    process.exit(0);
  })();
}

module.exports = { initDemoData };
