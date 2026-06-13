import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Input, Select, Modal, Form, message, DatePicker } from 'antd';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const statusMap: any = {
  pending: { label: '待确认', color: 'orange' },
  active: { label: '生效中', color: 'green' },
  expired: { label: '已过期', color: 'default' },
  cancelled: { label: '已取消', color: 'red' },
};

const LeaseManagement: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [tenants, setTenants] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    loadOptions();
  }, [page, pageSize, status, keyword]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (status) params.status = status;
      if (keyword) params.keyword = keyword;
      
      const res: any = await api.get('/leases', { params });
      setData(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [tenantsRes, spacesRes]: any = await Promise.all([
        api.get('/tenants'),
        api.get('/parking-spaces/available'),
      ]);
      setTenants(tenantsRes.data || []);
      setSpaces(spacesRes.data || []);
    } catch (e) {}
  };

  const handleTenantChange = async (tenantId: string) => {
    form.setFieldsValue({ vehicle_id: undefined });
    if (tenantId) {
      try {
        const res: any = await api.get(`/tenants/${tenantId}/vehicles`);
        setVehicles(res.data || []);
      } catch (e) {}
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const res: any = await api.post('/leases', {
        ...values,
        start_date: values.date_range[0].format('YYYY-MM-DD'),
        end_date: values.date_range[1].format('YYYY-MM-DD'),
        monthly_price: parseFloat(values.monthly_price) || 300,
      });
      
      if (res.success) {
        message.success('创建成功');
        setCreateModal(false);
        form.resetFields();
        loadData();
      } else {
        message.error(res.message || '创建失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '创建失败');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const res: any = await api.post(`/leases/${id}/confirm`);
      if (res.success) {
        message.success('合同已确认');
        loadData();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '车位编号',
      dataIndex: 'space_id',
      key: 'space_id',
      render: () => '-',
    },
    {
      title: '租户',
      dataIndex: 'tenant_id',
      key: 'tenant_id',
      render: () => '-',
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
    },
    {
      title: '月租金',
      dataIndex: 'monthly_price',
      key: 'monthly_price',
      render: (val: number) => `¥${val}`,
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (val: number) => `¥${val}`,
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
      title: '合同状态',
      dataIndex: 'contract_status',
      key: 'contract_status',
      render: (status: string) => (
        <Tag color={status === 'confirmed' ? 'green' : 'orange'}>
          {status === 'confirmed' ? '已确认' : '未确认'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" onClick={() => navigate(`/leases/${record.id}`)}>
            详情
          </Button>
          {record.contract_status === 'unconfirmed' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleConfirm(record.id)}
            >
              确认合同
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>租约管理</h2>
        <Space>
          <Input
            placeholder="搜索"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            value={status || undefined}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="pending">待确认</Option>
            <Option value="active">生效中</Option>
            <Option value="expired">已过期</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            新建租约
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal
        title="新建租约"
        open={createModal}
        onOk={handleCreate}
        onCancel={() => setCreateModal(false)}
        okText="创建"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="车位"
            name="space_id"
            rules={[{ required: true, message: '请选择车位' }]}
          >
            <Select placeholder="选择车位" onChange={() => {}}>
              {spaces.map(s => (
                <Option key={s.id} value={s.id}>{s.code} - {s.location}</Option>
              ))}
            </Select>
          </Form.Item>

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
              {tenants.map(t => (
                <Option key={t.id} value={t.id}>{t.name} - {t.phone}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="车辆"
            name="vehicle_id"
            rules={[{ required: true, message: '请选择车辆' }]}
          >
            <Select placeholder="选择车辆">
              {vehicles.map(v => (
                <Option key={v.id} value={v.id}>{v.plate_no}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="租期"
            name="date_range"
            rules={[{ required: true, message: '请选择租期' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="月租金 (元)"
            name="monthly_price"
            rules={[{ required: true, message: '请输入月租金' }]}
            initialValue={300}
          >
            <Input type="number" min={0} />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LeaseManagement;
