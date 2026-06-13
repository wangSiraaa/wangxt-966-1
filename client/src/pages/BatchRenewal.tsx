import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Select, Modal, message, Card, Row, Col, Statistic, Alert } from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Option } = Select;

const BatchRenewal: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [renewMonths, setRenewMonths] = useState(3);
  const [resultModal, setResultModal] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/leases/expiring-soon?days=60');
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
            return { ...item, daysLeft: dayjs(item.end_date).diff(dayjs(), 'day'), canRenew: { can: false, reason: '加载失败' } };
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

  const handleBatchRenew = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要续费的租约');
      return;
    }

    try {
      const res: any = await api.post('/leases/batch-renew', {
        lease_ids: selectedRowKeys,
        months: renewMonths,
      });

      setBatchResult(res.data);
      setResultModal(true);

      if (res.data?.success) {
        message.success(`批量续费成功，共 ${res.data.successful.length} 笔`);
      } else {
        message.warning(`批量续费完成，成功 ${res.data?.successful?.length || 0} 笔，失败 ${res.data?.failed?.length || 0} 笔`);
      }

      loadData();
      setSelectedRowKeys([]);
    } catch (e: any) {
      message.error(e.response?.data?.message || '批量续费失败');
    }
  };

  const canRenewCount = data.filter(d => d.canRenew?.can).length;

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
        return <Tag color="red" title={record.canRenew?.reason}>{record.canRenew?.reason || '状态异常'}</Tag>;
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      const validKeys = keys.filter(key => {
        const record = data.find(d => d.id === key);
        return record?.canRenew?.can;
      });
      setSelectedRowKeys(validKeys);
    },
    getCheckboxProps: (record: any) => ({
      disabled: !record.canRenew?.can,
    }),
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>批量续租</h2>
        <Space>
          <span>续费月数：</span>
          <Select value={renewMonths} onChange={setRenewMonths} style={{ width: 120 }}>
            <Option value={1}>1个月</Option>
            <Option value={3}>3个月</Option>
            <Option value={6}>6个月</Option>
            <Option value={12}>12个月</Option>
          </Select>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleBatchRenew}
            disabled={selectedRowKeys.length === 0}
          >
            批量续费 ({selectedRowKeys.length})
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="即将到期" value={data.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="可续费" value={canRenewCount} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="不可续费" value={data.length - canRenewCount} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="已选择" value={selectedRowKeys.length} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
      </Row>

      {selectedRowKeys.length > 0 && (
        <Alert
          message={`已选择 ${selectedRowKeys.length} 笔可续费租约，${renewMonths} 个月租期`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="批量续费结果"
        open={resultModal}
        onCancel={() => setResultModal(false)}
        footer={[
          <Button key="close" onClick={() => setResultModal(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {batchResult && (
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Statistic
                  title="成功"
                  value={batchResult.successful?.length || 0}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="失败"
                  value={batchResult.failed?.length || 0}
                  prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
            </Row>

            {batchResult.failed?.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 8 }}>失败列表</h4>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {batchResult.failed.map((f: any, idx: number) => (
                    <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <p style={{ margin: 0 }}><strong>租约：</strong>{f.leaseId?.slice(0, 12)}...</p>
                      <p style={{ margin: 0, color: '#ff4d4f' }}><strong>原因：</strong>{f.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BatchRenewal;
