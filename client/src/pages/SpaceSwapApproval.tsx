import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Select, message, Card, Descriptions, Input } from 'antd';
import { ReloadOutlined, CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Option } = Select;

const statusMap: any = {
  pending: { label: '待审批', color: 'orange' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  completed: { label: '已完成', color: 'blue' },
};

const SpaceSwapApproval: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<any>(null);
  const [form] = Form.useForm();
  const [leases, setLeases] = useState<any[]>([]);
  const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    loadOptions();
  }, [status]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (status) params.status = status;
      const res: any = await api.get('/space-swaps', { params });
      
      const list = res.data?.list || [];
      const enriched = await Promise.all(
        list.map(async (item: any) => {
          try {
            const [oldRes, newRes, tenantRes]: any = await Promise.all([
              api.get(`/parking-spaces/${item.old_space_id}`),
              api.get(`/parking-spaces/${item.new_space_id}`),
              api.get(`/tenants/${item.tenant_id}`),
            ]);
            return {
              ...item,
              old_space: oldRes.data,
              new_space: newRes.data,
              tenant: tenantRes.data,
            };
          } catch (e) {
            return item;
          }
        })
      );
      
      setData(enriched);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [leasesRes, spacesRes]: any = await Promise.all([
        api.get('/leases?status=active'),
        api.get('/parking-spaces/available'),
      ]);
      setLeases(leasesRes.data?.list || []);
      setAvailableSpaces(spacesRes.data || []);
    } catch (e) {}
  };

  const handleViewDetail = async (record: any) => {
    try {
      const res: any = await api.get(`/space-swaps/${record.id}/detail`);
      setSelectedSwap(res.data);
      setDetailModal(true);
    } catch (e) {
      message.error('加载详情失败');
    }
  };

  const handleApprove = async (record: any) => {
    try {
      const res: any = await api.post(`/space-swaps/${record.id}/approve`, {
        approver: 'admin',
        remark: '审批通过',
      });
      if (res.success) {
        message.success('审批通过');
        loadData();
      } else {
        message.error(res.message || '审批失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '审批失败');
    }
  };

  const handleReject = async (record: any) => {
    try {
      const res: any = await api.post(`/space-swaps/${record.id}/reject`, {
        approver: 'admin',
        remark: '审批驳回',
      });
      if (res.success) {
        message.success('已驳回');
        loadData();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const lease = leases.find(l => l.id === values.lease_id);
      
      const res: any = await api.post('/space-swaps', {
        lease_id: values.lease_id,
        old_space_id: lease?.space_id,
        new_space_id: values.new_space_id,
        tenant_id: lease?.tenant_id,
        reason: values.reason,
        effective_date: dayjs().format('YYYY-MM-DD'),
      });
      
      if (res.success) {
        message.success('申请已提交');
        setCreateModal(false);
        form.resetFields();
        loadData();
      } else {
        message.error(res.message || '申请失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '申请失败');
    }
  };

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => id?.slice(0, 12) + '...',
    },
    {
      title: '租户',
      dataIndex: ['tenant', 'name'],
      key: 'tenant',
      render: (text: string) => text || '-',
    },
    {
      title: '原车位',
      dataIndex: ['old_space', 'code'],
      key: 'old_space',
      render: (text: string) => text || '-',
    },
    {
      title: '目标车位',
      dataIndex: ['new_space', 'code'],
      key: 'new_space',
      render: (text: string) => text || '-',
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
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record)}
              >
                通过
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => handleReject(record)}
              >
                驳回
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>车位调换审批</h2>
        <Space>
          <Select
            placeholder="状态筛选"
            value={status || undefined}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="pending">待审批</Option>
            <Option value="approved">已通过</Option>
            <Option value="rejected">已驳回</Option>
            <Option value="completed">已完成</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            申请调换
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="申请车位调换"
        open={createModal}
        onOk={handleCreate}
        onCancel={() => setCreateModal(false)}
        okText="提交申请"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="选择租约"
            name="lease_id"
            rules={[{ required: true, message: '请选择租约' }]}
          >
            <Select placeholder="选择当前生效的租约">
              {leases.map((l: any) => (
                <Option key={l.id} value={l.id}>
                  租约 {l.id?.slice(0, 8)} - 车位 {l.space_id?.slice(0, 6)}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="目标车位"
            name="new_space_id"
            rules={[{ required: true, message: '请选择目标车位' }]}
          >
            <Select placeholder="选择可使用的车位">
              {availableSpaces.map((s: any) => (
                <Option key={s.id} value={s.id}>{s.code} - {s.location}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="调换原因" name="reason">
            <Input.TextArea rows={3} placeholder="请说明调换原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="调换申请详情"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={null}
        width={600}
      >
        {selectedSwap && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="申请编号">
                {selectedSwap.id}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusMap[selectedSwap.status]?.color}>
                  {statusMap[selectedSwap.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="租户">
                {selectedSwap.tenant?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="原车位">
                {selectedSwap.old_space?.code || '-'}
                {selectedSwap.old_space?.location && ` (${selectedSwap.old_space.location})`}
              </Descriptions.Item>
              <Descriptions.Item label="目标车位">
                {selectedSwap.new_space?.code || '-'}
                {selectedSwap.new_space?.location && ` (${selectedSwap.new_space.location})`}
              </Descriptions.Item>
              <Descriptions.Item label="申请原因">
                {selectedSwap.reason || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {selectedSwap.created_at}
              </Descriptions.Item>
              {selectedSwap.approver && (
                <>
                  <Descriptions.Item label="审批人">
                    {selectedSwap.approver}
                  </Descriptions.Item>
                  <Descriptions.Item label="审批意见">
                    {selectedSwap.approve_remark || '-'}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SpaceSwapApproval;
