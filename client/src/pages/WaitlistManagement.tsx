import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Select, Input, InputNumber, message, Card, Row, Col, Statistic, Popconfirm } from 'antd';
import { PlusOutlined, SwapOutlined, StopOutlined, ThunderboltOutlined, UserOutlined, CarOutlined } from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

const statusMap: Record<string, { label: string; color: string }> = {
  waiting: { label: '候补中', color: 'orange' },
  assigned: { label: '已转正', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
};

const WaitlistManagement: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [assigningRecord, setAssigningRecord] = useState<any>(null);
  const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);
  const [addForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      const res: any = await api.get('/waitlist', { params });
      setData(res.data || []);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      const res: any = await api.get('/tenants');
      setTenants(res.data || []);
    } catch (e) {}
  };

  const loadVehicles = async (tenantId?: string) => {
    try {
      const params: any = {};
      if (tenantId) params.tenant_id = tenantId;
      const res: any = await api.get('/vehicles', { params });
      setVehicles(res.data || []);
    } catch (e) {}
  };

  const loadAvailableSpaces = async () => {
    try {
      const res: any = await api.get('/parking-spaces/available');
      setAvailableSpaces(res.data || []);
    } catch (e) {}
  };

  const handleAddOpen = () => {
    addForm.resetFields();
    setVehicles([]);
    loadTenants();
    setAddModal(true);
  };

  const handleTenantChange = (tenantId: string) => {
    addForm.setFieldsValue({ vehicle_id: undefined });
    if (tenantId) {
      loadVehicles(tenantId);
    } else {
      setVehicles([]);
    }
  };

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validateFields();
      const res: any = await api.post('/waitlist', values);
      if (res.success) {
        message.success('加入候补成功');
        setAddModal(false);
        addForm.resetFields();
        loadData();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      if (e.response?.data?.message) {
        message.error(e.response.data.message);
      } else if (e.errorFields) {
        return;
      } else {
        message.error('操作失败');
      }
    }
  };

  const handleAssignOpen = (record: any) => {
    setAssigningRecord(record);
    assignForm.resetFields();
    loadAvailableSpaces();
    setAssignModal(true);
  };

  const handleAssignSubmit = async () => {
    try {
      const values = await assignForm.validateFields();
      const res: any = await api.post(`/waitlist/${assigningRecord.id}/assign`, {
        space_id: values.space_id,
      });
      if (res.success) {
        message.success('转正成功');
        setAssignModal(false);
        loadData();
      } else {
        message.error(res.message || '转正失败');
      }
    } catch (e: any) {
      if (e.response?.data?.message) {
        message.error(e.response.data.message);
      } else if (e.errorFields) {
        return;
      } else {
        message.error('转正失败');
      }
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res: any = await api.post(`/waitlist/${id}/cancel`);
      if (res.success) {
        message.success('已取消候补');
        loadData();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const handleAutoAssign = async () => {
    try {
      const res: any = await api.post('/waitlist/auto-assign');
      if (res.success) {
        const count = res.data?.count ?? 0;
        message.success(`自动分配完成，共分配 ${count} 条`);
        loadData();
      } else {
        message.error(res.message || '自动分配失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '自动分配失败');
    }
  };

  const waitingCount = data.filter((r) => r.status === 'waiting').length;
  const assignedCount = data.filter((r) => r.status === 'assigned').length;

  const columns = [
    {
      title: '租户',
      dataIndex: 'tenant_id',
      key: 'tenant_id',
      render: (tenantId: string) => {
        const tenant = tenants.find((t) => t.id === tenantId);
        return tenant ? tenant.name : tenantId;
      },
    },
    {
      title: '车牌号',
      dataIndex: 'vehicle_id',
      key: 'vehicle_id',
      render: (vehicleId: string) => {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        return vehicle ? vehicle.plate_no : vehicleId;
      },
    },
    {
      title: '偏好类型',
      dataIndex: 'preferred_type',
      key: 'preferred_type',
    },
    {
      title: '偏好位置',
      dataIndex: 'preferred_location',
      key: 'preferred_location',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const info = statusMap[status] || { label: status, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '分配车位',
      dataIndex: 'assigned_space_id',
      key: 'assigned_space_id',
      render: (val: string) => val || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === 'waiting' && (
            <>
              <Button
                type="link"
                icon={<SwapOutlined />}
                onClick={() => handleAssignOpen(record)}
              >
                转正
              </Button>
              <Popconfirm
                title="确定取消该候补？"
                onConfirm={() => handleCancel(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger icon={<StopOutlined />}>
                  取消候补
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>候补管理</h2>
        <Space>
          <Select
            placeholder="状态筛选"
            value={filterStatus || undefined}
            onChange={(val) => setFilterStatus(val || '')}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="waiting">候补中</Option>
            <Option value="assigned">已转正</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleAutoAssign}
          >
            自动分配
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddOpen}
          >
            加入候补
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="候补中"
              value={waitingCount}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="已转正"
              value={assignedCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title="加入候补"
        open={addModal}
        onOk={handleAddSubmit}
        onCancel={() => setAddModal(false)}
        okText="提交"
        cancelText="取消"
        width={500}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            label="租户"
            name="tenant_id"
            rules={[{ required: true, message: '请选择租户' }]}
          >
            <Select
              placeholder="选择租户"
              onChange={handleTenantChange}
              showSearch
              optionFilterProp="children"
            >
              {tenants.map((t) => (
                <Option key={t.id} value={t.id}>{t.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="车辆"
            name="vehicle_id"
            rules={[{ required: true, message: '请选择车辆' }]}
          >
            <Select placeholder="选择车辆">
              {vehicles.map((v) => (
                <Option key={v.id} value={v.id}>{v.plate_no}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="偏好类型" name="preferred_type">
            <Input placeholder="如：标准车位、大型车位" />
          </Form.Item>

          <Form.Item label="偏好位置" name="preferred_location">
            <Input placeholder="如：A区、B区" />
          </Form.Item>

          <Form.Item label="优先级" name="priority" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="转正 - 选择车位"
        open={assignModal}
        onOk={handleAssignSubmit}
        onCancel={() => setAssignModal(false)}
        okText="确认转正"
        cancelText="取消"
        width={500}
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item
            label="选择可用车位"
            name="space_id"
            rules={[{ required: true, message: '请选择车位' }]}
          >
            <Select placeholder="选择车位">
              {availableSpaces.map((s) => (
                <Option key={s.id} value={s.id}>{s.code} - {s.location || s.type}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WaitlistManagement;
