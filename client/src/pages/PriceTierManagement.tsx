import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, message, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';

const PriceTierManagement: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/price-tiers');
      setData(res.data || []);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingItem(record);
    form.setFieldsValue({
      name: record.name,
      min_months: record.min_months,
      max_months: record.max_months,
      discount_rate: record.discount_rate,
      monthly_price: record.monthly_price,
      description: record.description,
      is_active: record.is_active === 1,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res: any = await api.delete(`/price-tiers/${id}`);
      if (res.success) {
        message.success('删除成功');
        loadData();
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
        is_active: values.is_active ? 1 : 0,
      };

      let res;
      if (editingItem) {
        res = await api.put(`/price-tiers/${editingItem.id}`, payload);
      } else {
        res = await api.post('/price-tiers', payload);
      }

      if (res.data?.success) {
        message.success(editingItem ? '更新成功' : '创建成功');
        setModalVisible(false);
        loadData();
      } else {
        message.error(res.data?.message || '操作失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '阶梯名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '月数范围',
      key: 'range',
      render: (_: any, record: any) => {
        if (record.max_months) {
          return `${record.min_months} - ${record.max_months} 个月`;
        }
        return `${record.min_months} 个月以上`;
      },
    },
    {
      title: '折扣率',
      dataIndex: 'discount_rate',
      key: 'discount_rate',
      render: (rate: number) => (
        <Tag color={rate < 1 ? 'green' : 'default'}>
          {(rate * 10).toFixed(1)}折
        </Tag>
      ),
    },
    {
      title: '月单价',
      dataIndex: 'monthly_price',
      key: 'monthly_price',
      render: (price: number) => price ? `¥${price}` : '按租约价',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: number) => (
        <Tag color={active ? 'green' : 'default'}>
          {active ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>阶梯价管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增阶梯
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingItem ? '编辑阶梯价' : '新增阶梯价'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="阶梯名称"
            name="name"
            rules={[{ required: true, message: '请输入阶梯名称' }]}
          >
            <Input placeholder="如：月度会员、季度优惠" />
          </Form.Item>

          <Form.Item label="最少月数" name="min_months" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="最多月数（空表示不限）" name="max_months">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="折扣率（1=不打折）" name="discount_rate" rules={[{ required: true }]}>
            <InputNumber min={0.1} max={1} step={0.05} precision={2} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="月单价（元，空则按租约价）" name="monthly_price">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item label="启用状态" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PriceTierManagement;
