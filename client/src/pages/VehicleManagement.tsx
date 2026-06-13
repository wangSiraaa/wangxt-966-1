import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Input, Select, Modal, Form, message, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, ReloadOutlined, CarOutlined, SafetyOutlined } from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

const VehicleManagement: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    loadTenants();
  }, [keyword]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (keyword) params.plate_no = keyword;
      const res: any = await api.get('/vehicles', { params });
      
      const list = res.data || [];
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

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const res: any = await api.post('/vehicles', values);
      if (res.success) {
        message.success('添加成功');
        setCreateModal(false);
        form.resetFields();
        loadData();
      } else {
        message.error(res.message || '添加失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '添加失败');
    }
  };

  const handleToggleWhitelist = async (record: any, whitelisted: boolean) => {
    try {
      const res: any = await api.post(`/vehicles/${record.id}/whitelist`, { whitelisted });
      if (res.success) {
        message.success(whitelisted ? '已加入白名单' : '已移出白名单');
        loadData();
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const handleToggleFamily = async (record: any, isFamily: boolean) => {
    try {
      const res: any = await api.post(`/vehicles/${record.id}/family`, { is_family: isFamily });
      if (res.success) {
        message.success(isFamily ? '已设为家庭车' : '已取消家庭车');
        loadData();
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '车牌号',
      dataIndex: 'plate_no',
      key: 'plate_no',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '所属租户',
      dataIndex: ['tenant', 'name'],
      key: 'tenant',
      render: (text: string, record: any) => text || record.tenant_id?.slice(0, 8),
    },
    {
      title: '车牌颜色',
      dataIndex: 'plate_color',
      key: 'plate_color',
      render: (color: string) => {
        const colorMap: any = { blue: '蓝色', green: '绿色', yellow: '黄色', white: '白色' };
        return colorMap[color] || color;
      },
    },
    {
      title: '车辆类型',
      dataIndex: 'vehicle_type',
      key: 'vehicle_type',
    },
    {
      title: '家庭车',
      dataIndex: 'is_family',
      key: 'is_family',
      render: (val: number) => val ? <Tag color="blue">是</Tag> : <Tag color="default">否</Tag>,
    },
    {
      title: '白名单',
      dataIndex: 'is_whitelisted',
      key: 'is_whitelisted',
      render: (val: number) => val ? 
        <Tag color="green">已入场</Tag> : 
        <Tag color="red">禁止入场</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleFamily(record, !record.is_family)}
          >
            {record.is_family ? '取消家庭车' : '设为家庭车'}
          </Button>
          <Button
            type="link"
            size="small"
            danger={record.is_whitelisted}
            onClick={() => handleToggleWhitelist(record, !record.is_whitelisted)}
          >
            {record.is_whitelisted ? '移出白名单' : '加入白名单'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>车辆管理</h2>
        <Space>
          <Input
            placeholder="搜索车牌号"
            prefix={<CarOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            添加车辆
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
        title="添加车辆"
        open={createModal}
        onOk={handleCreate}
        onCancel={() => setCreateModal(false)}
        okText="添加"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="所属租户"
            name="tenant_id"
            rules={[{ required: true, message: '请选择租户' }]}
          >
            <Select placeholder="选择租户" showSearch optionFilterProp="children">
              {tenants.map(t => (
                <Option key={t.id} value={t.id}>{t.name} - {t.phone}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="车牌号"
            name="plate_no"
            rules={[{ required: true, message: '请输入车牌号' }]}
          >
            <Input placeholder="如：京A12345" />
          </Form.Item>

          <Form.Item label="车牌颜色" name="plate_color" initialValue="blue">
            <Select>
              <Option value="blue">蓝色</Option>
              <Option value="green">绿色</Option>
              <Option value="yellow">黄色</Option>
              <Option value="white">白色</Option>
            </Select>
          </Form.Item>

          <Form.Item label="车辆类型" name="vehicle_type" initialValue="sedan">
            <Select>
              <Option value="sedan">轿车</Option>
              <Option value="suv">SUV</Option>
              <Option value="truck">货车</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item label="家庭车" name="is_family" valuePropName="checked" initialValue={false}>
            <Select>
              <Option value={0}>否</Option>
              <Option value={1}>是</Option>
            </Select>
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VehicleManagement;
