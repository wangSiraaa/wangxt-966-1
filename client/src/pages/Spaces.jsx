import React, { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  message,
  App as AntdApp
} from 'antd';
import { spacesApi } from '../api.js';

const { Search } = Input;

export default function SpacesPage() {
  const { modal } = AntdApp.useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const res = await spacesApi.list(filters);
    if (res?.code === 0) setList(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleFreeze = async (row, freeze) => {
    modal.confirm({
      title: freeze ? '确认冻结车位？' : '确认解冻车位？',
      content: freeze
        ? `冻结后「${row.space_no}」将无法生成新租约，已生效的租约续费时也会被拦截`
        : `解冻后「${row.space_no}」恢复正常可用状态`,
      okText: freeze ? '确认冻结' : '确认解冻',
      okButtonProps: { danger: freeze },
      onOk: async () => {
        const res = await spacesApi.freeze(row.id, {
          is_frozen: freeze,
          freeze_reason: freeze ? '物业操作冻结' : ''
        });
        if (res?.code === 0) {
          message.success(res.message);
          loadData();
        }
      }
    });
  };

  const columns = [
    { title: '车位编号', dataIndex: 'space_no', key: 'space_no', width: 120 },
    { title: '位置', dataIndex: 'location', key: 'location' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) => {
        const map = {
          available: { color: 'green', text: '空闲' },
          occupied: { color: 'blue', text: '已占用' },
          reserved: { color: 'orange', text: '预留' },
          frozen: { color: 'red', text: '已冻结' }
        };
        const c = map[v] || { color: 'default', text: v };
        return <Tag color={c.color}>{c.text}</Tag>;
      }
    },
    {
      title: '冻结状态',
      dataIndex: 'is_frozen',
      key: 'is_frozen',
      width: 160,
      render: (v, row) =>
        v === 1 ? (
          <Tag color="red">已冻结 {row.freeze_reason ? `(${row.freeze_reason})` : ''}</Tag>
        ) : (
          <Tag color="green">正常</Tag>
        )
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_, r) => (
        <Space>
          {r.is_frozen === 1 ? (
            <Button size="small" onClick={() => handleFreeze(r, false)}>
              解冻
            </Button>
          ) : (
            <Button size="small" danger onClick={() => handleFreeze(r, true)}>
              冻结
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="action-bar">
        <Search
          placeholder="搜索位置"
          style={{ width: 240 }}
          allowClear
          onSearch={(v) => setFilters((f) => ({ ...f, location: v || undefined }))}
        />
        <Select
          placeholder="筛选状态"
          allowClear
          style={{ width: 160 }}
          options={[
            { value: 'available', label: '空闲' },
            { value: 'occupied', label: '已占用' },
            { value: 'reserved', label: '预留' },
            { value: 'frozen', label: '已冻结' }
          ]}
          onChange={(v) => setFilters((f) => ({ ...f, status: v || undefined }))}
        />
        <Select
          placeholder="冻结状态"
          allowClear
          style={{ width: 140 }}
          options={[
            { value: 'true', label: '已冻结' },
            { value: 'false', label: '未冻结' }
          ]}
          onChange={(v) => setFilters((f) => ({ ...f, is_frozen: v }))}
        />
        <div style={{ flex: 1 }} />
        <Button type="primary" onClick={() => setCreateModal(true)}>
          新增车位
        </Button>
      </div>

      <div className="table-card">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </div>

      <Modal
        title="新增车位"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const res = await spacesApi.create(values);
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
          <Form.Item label="车位编号" name="space_no" rules={[{ required: true }]}>
            <Input placeholder="如 B1-001" />
          </Form.Item>
          <Form.Item label="位置描述" name="location">
            <Input placeholder="如 B1层1号区域" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
