import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Select, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, FileTextOutlined, CheckOutlined } from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

const statusMap: any = {
  pending: { label: '待开票', color: 'orange' },
  issued: { label: '已开票', color: 'green' },
  cancelled: { label: '已作废', color: 'red' },
};

const InvoiceManagement: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('');
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [leases, setLeases] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    loadLeases();
  }, [page, pageSize, status]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (status) params.status = status;
      
      const res: any = await api.get('/invoices', { params });
      const list = res.data?.list || [];
      
      const enriched = await Promise.all(
        list.map(async (item: any) => {
          try {
            const tenantRes: any = await api.get(`/tenants/${item.tenant_id}`);
            return { ...item, tenant: tenantRes.data };
          } catch (e) {
            return item;
          }
        })
      );
      
      setData(enriched);
      setTotal(res.data?.total || 0);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadLeases = async () => {
    try {
      const res: any = await api.get('/leases?status=active');
      setLeases(res.data?.list || []);
    } catch (e) {}
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const lease = leases.find((l: any) => l.id === values.lease_id);
      
      const res: any = await api.post('/invoices', {
        ...values,
        tenant_id: lease?.tenant_id,
        amount: parseFloat(values.amount) || lease?.monthly_price || 300,
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

  const handleIssue = async (id: string) => {
    try {
      const res: any = await api.post(`/invoices/${id}/issue`);
      if (res.success) {
        message.success('开票成功');
        loadData();
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '发票抬头',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '租户',
      dataIndex: ['tenant', 'name'],
      key: 'tenant',
      render: (text: string) => text || '-',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => <strong>¥{val}</strong>,
    },
    {
      title: '类型',
      dataIndex: 'invoice_type',
      key: 'invoice_type',
      render: (type: string) => type === 'special' ? '增值税专用发票' : '普通发票',
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
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleIssue(record.id)}
            >
              开票
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>发票管理</h2>
        <Space>
          <Select
            placeholder="状态筛选"
            value={status || undefined}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="pending">待开票</Option>
            <Option value="issued">已开票</Option>
            <Option value="cancelled">已作废</Option>
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            申请开票
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
        title="申请开票"
        open={createModal}
        onOk={handleCreate}
        onCancel={() => setCreateModal(false)}
        okText="提交申请"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="关联租约"
            name="lease_id"
            rules={[{ required: true, message: '请选择租约' }]}
          >
            <Select placeholder="选择租约">
              {leases.map((l: any) => (
                <Option key={l.id} value={l.id}>
                  租约 {l.id?.slice(0, 8)} - ¥{l.monthly_price}/月
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="发票抬头"
            name="title"
            rules={[{ required: true, message: '请输入发票抬头' }]}
          >
            <Input placeholder="公司名称或个人姓名" />
          </Form.Item>

          <Form.Item label="税号" name="tax_no">
            <Input placeholder="纳税人识别号" />
          </Form.Item>

          <Form.Item
            label="发票类型"
            name="invoice_type"
            initialValue="general"
          >
            <Select>
              <Option value="general">普通发票</Option>
              <Option value="special">增值税专用发票</Option>
            </Select>
          </Form.Item>

          <Form.Item label="金额" name="amount">
            <Input type="number" placeholder="留空则按租约金额" />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InvoiceManagement;
