import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Select, InputNumber, Input, message, Card, Row, Col } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

const orderTypeMap: Record<string, { label: string; color: string }> = {
  price_diff: { label: '补差', color: 'blue' },
  refund: { label: '退款', color: 'green' },
  late_fee: { label: '滞纳金', color: 'red' },
};

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'orange' },
  approved: { label: '已审批', color: 'blue' },
  rejected: { label: '已驳回', color: 'red' },
  completed: { label: '已完成', color: 'green' },
};

const AdjustmentOrderList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [createModal, setCreateModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [currentId, setCurrentId] = useState<string>('');
  const [rejectRemark, setRejectRemark] = useState('');
  const [leases, setLeases] = useState<any[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [page, pageSize, filterType, filterStatus]);

  useEffect(() => {
    loadLeases();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (filterType) params.order_type = filterType;
      if (filterStatus) params.status = filterStatus;
      const res: any = await api.get('/adjustment-orders', { params });
      setData(res.data?.list || []);
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
      const res: any = await api.post('/adjustment-orders', {
        ...values,
        tenant_id: lease?.tenant_id,
        space_id: lease?.space_id,
        amount: parseFloat(values.amount),
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

  const handleApprove = async (id: string) => {
    try {
      const res: any = await api.post(`/adjustment-orders/${id}/approve`, { approved_by: 'admin' });
      if (res.success) {
        message.success('审批通过');
        loadData();
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const handleReject = async () => {
    try {
      const res: any = await api.post(`/adjustment-orders/${currentId}/reject`, {
        approved_by: 'admin',
        remark: rejectRemark,
      });
      if (res.success) {
        message.success('已驳回');
        setRejectModal(false);
        setRejectRemark('');
        setCurrentId('');
        loadData();
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const res: any = await api.post(`/adjustment-orders/${id}/complete`);
      if (res.success) {
        message.success('已完成');
        loadData();
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'order_type',
      key: 'order_type',
      render: (type: string) => {
        const info = orderTypeMap[type] || { label: type, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => <strong>¥{val}</strong>,
    },
    {
      title: '关联租约',
      dataIndex: 'lease_id',
      key: 'lease_id',
      render: (id: string) => id?.slice(0, 8) + '...',
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
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
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
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                审批
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  setCurrentId(record.id);
                  setRejectModal(true);
                }}
              >
                驳回
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleComplete(record.id)}
            >
              完成
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>调整单管理</h2>
        <Space>
          <Select
            placeholder="类型筛选"
            value={filterType || undefined}
            onChange={setFilterType}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="price_diff">补差</Option>
            <Option value="refund">退款</Option>
            <Option value="late_fee">滞纳金</Option>
          </Select>
          <Select
            placeholder="状态筛选"
            value={filterStatus || undefined}
            onChange={setFilterStatus}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="pending">待审批</Option>
            <Option value="approved">已审批</Option>
            <Option value="rejected">已驳回</Option>
            <Option value="completed">已完成</Option>
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            新建调整单
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
        title="新建调整单"
        open={createModal}
        onOk={handleCreate}
        onCancel={() => setCreateModal(false)}
        okText="提交"
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
            label="调整类型"
            name="order_type"
            rules={[{ required: true, message: '请选择调整类型' }]}
          >
            <Select placeholder="选择类型">
              <Option value="price_diff">补差</Option>
              <Option value="refund">退款</Option>
              <Option value="late_fee">滞纳金</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="金额"
            name="amount"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入金额" />
          </Form.Item>

          <Form.Item
            label="原因"
            name="reason"
            rules={[{ required: true, message: '请输入原因' }]}
          >
            <Input placeholder="请输入原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="驳回调整单"
        open={rejectModal}
        onOk={handleReject}
        onCancel={() => { setRejectModal(false); setRejectRemark(''); setCurrentId(''); }}
        okText="确认驳回"
        cancelText="取消"
      >
        <Input.TextArea
          rows={3}
          value={rejectRemark}
          onChange={(e) => setRejectRemark(e.target.value)}
          placeholder="请输入驳回原因"
        />
      </Modal>
    </div>
  );
};

export default AdjustmentOrderList;
