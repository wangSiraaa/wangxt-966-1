import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Modal, Form, message, App as AntdApp, Tag } from 'antd';
import { tenantsApi } from '../api.js';

const { Search } = Input;

export default function TenantsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [viewLeases, setViewLeases] = useState(null);
  const [leases, setLeases] = useState([]);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const res = await tenantsApi.list({ keyword: keyword || undefined });
    if (res?.code === 0) setList(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [keyword]);

  const handleViewLeases = async (id) => {
    const res = await tenantsApi.leases(id);
    if (res?.code === 0) {
      setLeases(res.data);
      setViewLeases(id);
    }
  };

  const columns = [
    { title: '租户编号', dataIndex: 'tenant_no', key: 'tenant_no', width: 120 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: '车牌号', dataIndex: 'license_plate', key: 'license_plate', width: 140 },
    { title: '住址', dataIndex: 'address', key: 'address' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => handleViewLeases(r.id)}>
            查看租约
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="action-bar">
        <Search
          placeholder="搜索姓名/电话/车牌/编号"
          style={{ width: 320 }}
          allowClear
          enterButton
          onSearch={(v) => setKeyword(v)}
        />
        <div style={{ flex: 1 }} />
        <Button type="primary" onClick={() => setCreateModal(true)}>
          新增租户
        </Button>
      </div>

      <div className="table-card">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </div>

      <Modal
        title="新增租户"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const res = await tenantsApi.create(values);
            if (res?.code === 0) {
              message.success('新增成功');
              setCreateModal(false);
              form.resetFields();
              loadData();
            }
          } catch (e) {}
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="联系电话" name="phone">
            <Input />
          </Form.Item>
          <Form.Item label="车牌号" name="license_plate">
            <Input />
          </Form.Item>
          <Form.Item label="住址" name="address">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="租约记录"
        open={!!viewLeases}
        onCancel={() => {
          setViewLeases(null);
          setLeases([]);
        }}
        footer={null}
        width={720}
      >
        <Table
          rowKey="id"
          size="small"
          dataSource={leases}
          pagination={false}
          columns={[
            { title: '车位', dataIndex: 'space_no', key: 'space_no' },
            { title: '开始日期', dataIndex: 'start_date', key: 'start_date' },
            { title: '到期日期', dataIndex: 'end_date', key: 'end_date' },
            { title: '月租', dataIndex: 'monthly_amount', render: (v) => `¥${v?.toFixed(2)}` },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v) =>
                ({
                  active: <Tag color="green">生效中</Tag>,
                  expired: <Tag color="red">已过期</Tag>,
                  terminated: <Tag color="default">已终止</Tag>
                })[v] || v
            }
          ]}
        />
      </Modal>
    </div>
  );
}
