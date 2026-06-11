import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Select,
  Space,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  message,
  App as AntdApp,
  Tag,
  Divider
} from 'antd';
import dayjs from 'dayjs';
import { leasesApi, tenantsApi, spacesApi } from '../api.js';

export default function LeasesPage() {
  const { modal } = AntdApp.useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState();
  const [createModal, setCreateModal] = useState(false);
  const [tenantOpts, setTenantOpts] = useState([]);
  const [spaceOpts, setSpaceOpts] = useState([]);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const res = await leasesApi.list({ status });
    if (res?.code === 0) setList(res.data);
    setLoading(false);
  };

  const loadSelects = async () => {
    const [tRes, sRes] = await Promise.all([tenantsApi.list(), spacesApi.list({ is_frozen: 'false' })]);
    if (tRes?.code === 0)
      setTenantOpts(tRes.data.map((t) => ({ value: t.id, label: `${t.name} (${t.tenant_no})` })));
    if (sRes?.code === 0)
      setSpaceOpts(
        sRes.data
          .filter((s) => s.status === 'available' || s.status === 'reserved')
          .map((s) => ({ value: s.id, label: `${s.space_no} (${s.location || '—'})` }))
      );
  };

  useEffect(() => {
    loadData();
  }, [status]);

  const handleRecycle = async () => {
    modal.confirm({
      title: '执行过期租约回收检查',
      content:
        '系统将扫描所有已过期租约，超过30天未续费的车位将自动释放回可分配池并生成对应欠费记录。',
      onOk: async () => {
        const res = await leasesApi.recycleExpired();
        if (res?.code === 0) {
          message.success(res.data.message);
          loadData();
        }
      }
    });
  };

  const columns = [
    { title: '租约编号', dataIndex: 'lease_no', key: 'lease_no', width: 160 },
    { title: '车位', dataIndex: 'space_no', key: 'space_no', width: 100 },
    { title: '车主', dataIndex: 'tenant_name', key: 'tenant_name', width: 100 },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '车牌', dataIndex: 'license_plate', key: 'license_plate', width: 120 },
    { title: '起租日', dataIndex: 'start_date', key: 'start_date', width: 120 },
    {
      title: '到期日',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
      render: (v, r) => {
        const left = dayjs(v).diff(dayjs(), 'day');
        return (
          <div>
            <div>{v}</div>
            {r.status === 'active' && left <= 15 && (
              <Tag color={left <= 3 ? 'red' : 'warning'} style={{ marginTop: 4 }}>
                剩余{left}天
              </Tag>
            )}
            {r.status === 'active' && left < 0 && (
              <Tag color="red" style={{ marginTop: 4 }}>
                过期{Math.abs(left)}天
              </Tag>
            )}
            {r.is_frozen === 1 && <Tag color="red">车位已冻结</Tag>}
          </div>
        );
      }
    },
    { title: '月租', dataIndex: 'monthly_amount', key: 'monthly_amount', width: 100, render: (v) => `¥${v?.toFixed(2)}` },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) =>
        ({
          active: <Tag color="green">生效中</Tag>,
          expired: <Tag color="red">已过期</Tag>,
          renewing: <Tag color="purple">续费中</Tag>,
          terminated: <Tag color="default">已终止</Tag>
        })[v] || v
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, r) => (
        <Button
          size="small"
          type="primary"
          disabled={r.status !== 'active'}
          onClick={() => handleRenew(r)}
        >
          申请续费
        </Button>
      )
    }
  ];

  const handleRenew = async (r) => {
    const res = await leasesApi.submitRenewal({ lease_id: r.id, months: 3 });
    if (res?.blocked) {
      if (res.block_type === 'UNSETTLED_ARREARS') {
        Modal.error({
          title: '续费被拦截 · 存在未结清欠费',
          width: 640,
          content: (
            <div>
              <div className="warn-block danger">
                <div className="warn-title">⚠️ 车主存在未结清欠费</div>
                <div className="warn-msg">{res.message}</div>
              </div>
              {res.data?.arrears_list?.length > 0 && (
                <div className="block-detail-list">
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>欠费清单：</div>
                  {res.data.arrears_list.map((a) => (
                    <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px dashed #f0f0f0' }}>
                      <div>
                        <Tag color="red">{a.record_no}</Tag>
                        车位: {a.space_no || '—'} · 应缴: ¥
                        {(a.amount - (a.settled_amount || 0)).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', marginTop: 4 }}>
                        {a.description}
                      </div>
                    </div>
                  ))}
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ color: '#cf1322', fontWeight: 600 }}>
                    请先前往「欠费管理」页面为车主结清上述 {res.data.arrears_list.length} 条欠费。
                  </div>
                </div>
              )}
            </div>
          ),
          okText: '知道了'
        });
      } else if (res.block_type === 'SPACE_FROZEN') {
        Modal.error({
          title: '续费被拦截 · 车位已冻结',
          content: (
            <div className="warn-block danger">
              <div className="warn-title">❄️ 车位「{r.space_no}」已被冻结</div>
              <div className="warn-msg">{res.message}</div>
            </div>
          ),
          okText: '知道了'
        });
      }
      return;
    }
    if (res?.code === 0) {
      message.success('续费申请已提交');
      loadData();
    }
  };

  return (
    <div>
      <div className="action-bar">
        <Select
          placeholder="筛选租约状态"
          allowClear
          style={{ width: 160 }}
          value={status}
          options={[
            { value: 'active', label: '生效中' },
            { value: 'expired', label: '已过期' },
            { value: 'terminated', label: '已终止' }
          ]}
          onChange={(v) => setStatus(v)}
        />
        <Button onClick={handleRecycle} danger>
          执行过期回收检查
        </Button>
        <div style={{ flex: 1 }} />
        <Button
          type="primary"
          onClick={() => {
            loadSelects();
            form.setFieldsValue({
              start_date: dayjs(),
              months: 3,
              monthly_amount: 500
            });
            setCreateModal(true);
          }}
        >
          创建新租约
        </Button>
      </div>

      <div className="table-card">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
        />
      </div>

      <Modal
        title="创建新租约"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        width={560}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const payload = {
              tenant_id: values.tenant_id,
              space_id: values.space_id,
              start_date: values.start_date.format('YYYY-MM-DD'),
              months: values.months,
              monthly_amount: values.monthly_amount
            };
            const res = await leasesApi.create(payload);
            if (res?.blocked) {
              if (res.block_type === 'UNSETTLED_ARREARS') {
                Modal.error({
                  title: '创建被拦截 · 存在未结清欠费',
                  content: (
                    <div>
                      <div className="warn-block danger">
                        <div className="warn-title">⚠️ 车主存在未结清欠费</div>
                        <div className="warn-msg">{res.message}</div>
                      </div>
                    </div>
                  )
                });
              } else if (res.block_type === 'SPACE_FROZEN') {
                Modal.error({
                  title: '创建被拦截 · 车位已冻结',
                  content: (
                    <div className="warn-block danger">
                      <div className="warn-title">❄️ 车位已冻结</div>
                      <div className="warn-msg">{res.message}</div>
                    </div>
                  )
                });
              }
              return;
            }
            if (res?.code === 0) {
              message.success('租约创建成功');
              setCreateModal(false);
              form.resetFields();
              loadData();
            }
          } catch (e) {}
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="选择车主" name="tenant_id" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={tenantOpts} />
          </Form.Item>
          <Form.Item label="选择车位（已排除冻结）" name="space_id" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={spaceOpts} />
          </Form.Item>
          <Form.Item label="起租日期" name="start_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="租约月数" name="months" rules={[{ required: true }]}>
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="月租金（元）" name="monthly_amount" rules={[{ required: true }]}>
            <InputNumber min={0} step={50} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
