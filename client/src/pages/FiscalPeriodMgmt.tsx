import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Input, DatePicker, message, Card, Alert, Popconfirm } from 'antd';
import { PlusOutlined, LockOutlined, UnlockOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const FiscalPeriodMgmt: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/fiscal-periods');
      setData(res.data || []);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleClose = async (id: string) => {
    try {
      const res: any = await api.post(`/fiscal-periods/${id}/close`);
      if (res.success || res.data?.success) {
        message.success('关账成功');
        loadData();
      } else {
        message.error(res.data?.message || res.message || '关账失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '关账失败');
    }
  };

  const handleReopen = async (id: string) => {
    try {
      const res: any = await api.post(`/fiscal-periods/${id}/reopen`);
      if (res.success || res.data?.success) {
        message.success('反关账成功');
        loadData();
      } else {
        message.error(res.data?.message || res.message || '反关账失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '反关账失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res: any = await api.delete(`/fiscal-periods/${id}`);
      if (res.success || res.data?.success) {
        message.success('删除成功');
        loadData();
      } else {
        message.error(res.data?.message || res.message || '删除失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD'),
      };
      const res: any = await api.post('/fiscal-periods', payload);
      if (res.success || res.data?.success) {
        message.success('创建成功');
        setModalVisible(false);
        loadData();
      } else {
        message.error(res.data?.message || res.message || '创建失败');
      }
    } catch (e: any) {
      if (e.response) {
        message.error(e.response?.data?.message || '创建失败');
      }
    }
  };

  const columns = [
    {
      title: '期间名称',
      dataIndex: 'period_name',
      key: 'period_name',
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'open' ? 'green' : 'red'}>
          {status === 'open' ? '开放' : '已关账'}
        </Tag>
      ),
    },
    {
      title: '关账人',
      dataIndex: 'closed_by',
      key: 'closed_by',
      render: (text: string) => text || '-',
    },
    {
      title: '关账时间',
      dataIndex: 'closed_at',
      key: 'closed_at',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === 'open' && (
            <>
              <Popconfirm
                title="确认关账"
                description="关账后该期间内的历史租约将不可直接修改，确认关账？"
                onConfirm={() => handleClose(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<LockOutlined />} danger>
                  关账
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认删除"
                description="确认删除该会计期间？"
                onConfirm={() => handleDelete(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'closed' && (
            <Popconfirm
              title="确认反关账"
              description="反关账将重新开放该期间，确认操作？"
              onConfirm={() => handleReopen(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<UnlockOutlined />}>
                反关账
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>财务关账管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增期间
        </Button>
      </div>

      <Alert
        message="关账后历史租约不可直接修改，需通过调整单（补差/退款/滞纳金）进行处理"
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="新增会计期间"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="期间名称"
            name="period_name"
            rules={[{ required: true, message: '请输入期间名称' }]}
          >
            <Input placeholder="如：2026年1月" />
          </Form.Item>

          <Form.Item
            label="开始日期"
            name="start_date"
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="结束日期"
            name="end_date"
            rules={[{ required: true, message: '请选择结束日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FiscalPeriodMgmt;
