import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Select, Modal, Form, Input, message, Popconfirm } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

const ExpiringQueue: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [renewModalVisible, setRenewModalVisible] = useState(false);
  const [selectedLease, setSelectedLease] = useState<any>(null);
  const [renewMonths, setRenewMonths] = useState(3);
  const [renewPrice, setRenewPrice] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/leases/expiring-soon?days=${days}`);
      const list = res.data || [];
      
      const enriched = await Promise.all(
        list.map(async (item: any) => {
          try {
            const [tenantRes, spaceRes, vehicleRes, canRenewRes]: any = await Promise.all([
              api.get(`/tenants/${item.tenant_id}`),
              api.get(`/parking-spaces/${item.space_id}`),
              api.get(`/vehicles/${item.vehicle_id}`),
              api.get(`/leases/${item.id}/can-renew`),
            ]);
            return {
              ...item,
              tenant: tenantRes.data,
              space: spaceRes.data,
              vehicle: vehicleRes.data,
              canRenew: canRenewRes.data,
              daysLeft: dayjs(item.end_date).diff(dayjs(), 'day'),
            };
          } catch (e) {
            return { ...item, daysLeft: dayjs(item.end_date).diff(dayjs(), 'day') };
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

  const handleRenew = async (record: any) => {
    if (!record.canRenew?.can) {
      message.error(record.canRenew?.reason || '无法续费');
      return;
    }
    setSelectedLease(record);
    setRenewMonths(3);
    setRenewPrice(null);
    setRenewModalVisible(true);
    
    try {
      const res: any = await api.get(`/leases/${record.id}/renewal-price?months=3`);
      setRenewPrice(res.data);
    } catch (e) {}
  };

  const handleMonthsChange = async (val: number) => {
    setRenewMonths(val);
    if (selectedLease) {
      try {
        const res: any = await api.get(`/leases/${selectedLease.id}/renewal-price?months=${val}`);
        setRenewPrice(res.data);
      } catch (e) {}
    }
  };

  const confirmRenew = async () => {
    if (!selectedLease) return;
    try {
      const res: any = await api.post(`/leases/${selectedLease.id}/renew`, { months: renewMonths });
      if (res.success) {
        message.success('续费成功');
        setRenewModalVisible(false);
        loadData();
      } else {
        message.error(res.message || '续费失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '续费失败');
    }
  };

  const columns = [
    {
      title: '车位编号',
      dataIndex: ['space', 'code'],
      key: 'space',
      render: (text: string) => text || '-',
    },
    {
      title: '租户',
      dataIndex: ['tenant', 'name'],
      key: 'tenant',
      render: (text: string) => text || '-',
    },
    {
      title: '车牌号',
      dataIndex: ['vehicle', 'plate_no'],
      key: 'vehicle',
      render: (text: string) => text || '-',
    },
    {
      title: '到期时间',
      dataIndex: 'end_date',
      key: 'end_date',
      sorter: (a: any, b: any) => dayjs(a.end_date).valueOf() - dayjs(b.end_date).valueOf(),
    },
    {
      title: '剩余天数',
      dataIndex: 'daysLeft',
      key: 'daysLeft',
      sorter: (a: any, b: any) => a.daysLeft - b.daysLeft,
      render: (days: number) => {
        let color = 'green';
        if (days <= 7) color = 'red';
        else if (days <= 15) color = 'orange';
        else if (days <= 30) color = 'blue';
        return <Tag color={color}>{days} 天</Tag>;
      },
    },
    {
      title: '月租金',
      dataIndex: 'monthly_price',
      key: 'monthly_price',
      render: (val: number) => `¥${val}`,
    },
    {
      title: '状态',
      key: 'canRenew',
      render: (_: any, record: any) => {
        if (record.canRenew?.can) {
          return <Tag color="green">可续费</Tag>;
        }
        return <Tag color="red">{record.canRenew?.reason || '状态异常'}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" onClick={() => navigate(`/leases/${record.id}`)}>
            详情
          </Button>
          <Button
            type="primary"
            size="small"
            disabled={!record.canRenew?.can}
            onClick={() => handleRenew(record)}
          >
            续费
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>到期队列</h2>
        <Space>
          <Select value={days} onChange={setDays} style={{ width: 120 }}>
            <Option value={7}>7天内</Option>
            <Option value={15}>15天内</Option>
            <Option value={30}>30天内</Option>
            <Option value={60}>60天内</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
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
        title="续费确认"
        open={renewModalVisible}
        onOk={confirmRenew}
        onCancel={() => setRenewModalVisible(false)}
        okText="确认续费"
        cancelText="取消"
      >
        {selectedLease && (
          <div>
            <p><strong>车位：</strong>{selectedLease.space?.code}</p>
            <p><strong>租户：</strong>{selectedLease.tenant?.name}</p>
            <p><strong>当前到期：</strong>{selectedLease.end_date}</p>
            
            <Form layout="vertical" style={{ marginTop: 16 }}>
              <Form.Item label="续费月数">
                <Select value={renewMonths} onChange={handleMonthsChange}>
                  <Option value={1}>1个月</Option>
                  <Option value={3}>3个月</Option>
                  <Option value={6}>6个月</Option>
                  <Option value={12}>12个月</Option>
                </Select>
              </Form.Item>
            </Form>

            {renewPrice && (
              <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                <p style={{ margin: '4px 0' }}>
                  月单价：<strong>¥{renewPrice.monthlyPrice}</strong>
                </p>
                {renewPrice.discountRate < 1 && (
                  <p style={{ margin: '4px 0', color: '#52c41a' }}>
                    优惠折扣：<strong>{(renewPrice.discountRate * 10).toFixed(1)}折</strong>
                  </p>
                )}
                <p style={{ margin: '4px 0', fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                  共计：¥{renewPrice.finalAmount}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExpiringQueue;
