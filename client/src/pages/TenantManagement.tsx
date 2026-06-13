import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Input, Modal, Form, message, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, ReloadOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../api';

const TenantManagement: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleModal, setVehicleModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [keyword]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/tenants', { params: { keyword } });
      setData(res.data || []);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const res: any = await api.post('/tenants', values);
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

  const handleViewVehicles = async (record: any) => {
    setSelectedTenant(record);
    try {
      const res: any = await api.get(`/tenants/${record.id}/vehicles`);
      setVehicles(res.data || []);
      setVehicleModal(true);
    } catch (e) {
      message.error('加载车辆失败');
    }
  };

  const handleBlacklist = async (record: any, add: boolean) => {
    try {
      const res: any = await api.post(
        `/tenants/${record.id}/${add ? 'blacklist' : 'unblacklist'}`,
        { reason: add ? '管理员操作' : undefined }
      );
      if (res.success) {
        message.success(add ? '已加入黑名单' : '已移出黑名单');
        loadData();
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '身份证',
      dataIndex: 'id_card',
      key: 'id_card',
      render: (val: string) => val || '-',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      render: (val: string) => val || '-',
    },
    {
      title: '状态',
      dataIndex: 'is_blacklisted',
      key: 'is_blacklisted',
      render: (val: number) => (
        val ? <Tag color="red">黑名单</Tag> : <Tag color="green">正常</Tag>
      ),
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
          <Button type="link" size="small" onClick={() => handleViewVehicles(record)}>
            车辆
          </Button>
          {record.is_blacklisted ? (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleBlacklist(record, false)}>
              移出黑名单
            </Button>
          ) : (
            <Popconfirm
              title="确定加入黑名单？"
              onConfirm={() => handleBlacklist(record, true)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                加入黑名单
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
        <h2>租户管理</h2>
        <Space>
          <Input
            placeholder="搜索姓名/电话"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            新增租户
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
        title="新增租户"
        open={createModal}
        onOk={handleCreate}
        onCancel={() => setCreateModal(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="电话" name="phone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="身份证" name="id_card">
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${selectedTenant?.name} 的车辆`}
        open={vehicleModal}
        onCancel={() => setVehicleModal(false)}
        footer={null}
        width={600}
      >
        <Table
          size="small"
          dataSource={vehicles}
          rowKey="id"
          pagination={false}
          columns={[
            { title: '车牌号', dataIndex: 'plate_no' },
            { title: '车牌颜色', dataIndex: 'plate_color' },
            { 
              title: '家庭车', 
              dataIndex: 'is_family', 
              render: (v: number) => v ? '是' : '否' 
            },
            { 
              title: '白名单', 
              dataIndex: 'is_whitelisted', 
              render: (v: number) => v ? 
                <Tag color="green">已加入</Tag> : 
                <Tag color="red">未加入</Tag> 
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default TenantManagement;
