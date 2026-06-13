import React, { useState, useEffect } from 'react';
import { Card, Form, Select, Button, Statistic, Row, Col, message, Divider, Tag } from 'antd';
import { DollarOutlined, WarningOutlined } from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

const RefundTrial: React.FC = () => {
  const [leases, setLeases] = useState<any[]>([]);
  const [selectedLease, setSelectedLease] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadLeases();
  }, []);

  const loadLeases = async () => {
    try {
      const res: any = await api.get('/leases?status=active&pageSize=50');
      const list = res.data?.list || [];
      
      const enriched = await Promise.all(
        list.map(async (item: any) => {
          try {
            const [tenantRes, spaceRes, vehicleRes]: any = await Promise.all([
              api.get(`/tenants/${item.tenant_id}`),
              api.get(`/parking-spaces/${item.space_id}`),
              api.get(`/vehicles/${item.vehicle_id}`),
            ]);
            return {
              ...item,
              tenant: tenantRes.data,
              space: spaceRes.data,
              vehicle: vehicleRes.data,
              label: `${spaceRes.data?.code || ''} - ${tenantRes.data?.name || ''} (${vehicleRes.data?.plate_no || ''})`,
            };
          } catch (e) {
            return item;
          }
        })
      );
      
      setLeases(enriched);
    } catch (e) {
      message.error('加载租约失败');
    }
  };

  const handleLeaseChange = async (leaseId: string) => {
    const lease = leases.find(l => l.id === leaseId);
    setSelectedLease(lease || null);
    setResult(null);

    if (leaseId) {
      try {
        const res: any = await api.get(`/leases/${leaseId}/refund`);
        setResult(res.data);
      } catch (e: any) {
        message.error(e.response?.data?.message || '计算失败');
      }
    }
  };

  return (
    <div>
      <h2 className="page-header">退款试算（退租按日折算）</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="退租计算">
            <Form layout="vertical">
              <Form.Item label="选择租约">
                <Select
                  showSearch
                  placeholder="搜索并选择租约"
                  optionFilterProp="label"
                  onChange={handleLeaseChange}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={leases.map(l => ({ value: l.id, label: l.label }))}
                />
              </Form.Item>

              {selectedLease && (
                <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                  <p style={{ margin: '4px 0' }}><strong>车位：</strong>{selectedLease.space?.code}</p>
                  <p style={{ margin: '4px 0' }}><strong>租户：</strong>{selectedLease.tenant?.name}</p>
                  <p style={{ margin: '4px 0' }}><strong>总金额：</strong>¥{selectedLease.total_amount}</p>
                  <p style={{ margin: '4px 0' }}><strong>已付金额：</strong>¥{selectedLease.paid_amount || 0}</p>
                  <p style={{ margin: '4px 0' }}><strong>租期：</strong>{selectedLease.start_date} 至 {selectedLease.end_date}</p>
                </div>
              )}
            </Form>
          </Card>

          <Card title="退租规则说明" style={{ marginTop: 16 }}>
            <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
              <li>退租按实际使用天数折算退款</li>
              <li>已使用天数 = 今日 - 租约开始日</li>
              <li>剩余天数 = 租约结束日 - 今日</li>
              <li>日单价 = 总金额 / 总天数</li>
              <li>退款金额 = 日单价 × 剩余天数</li>
              <li>如果租约已过期，无退款</li>
            </ul>
            <div style={{ marginTop: 12, padding: 8, background: '#fffbe6', borderRadius: 4 }}>
              <p style={{ margin: 0, color: '#faad14' }}>
                <WarningOutlined /> 注意：退租将终止租约，车位将回到可分配池
              </p>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="计算结果">
            {result && result.success ? (
              <div>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Statistic
                      title="剩余天数"
                      value={result.remainingDays}
                      suffix="天"
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="预计退款"
                      value={result.refundAmount}
                      prefix="¥"
                      valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                    />
                  </Col>
                </Row>

                <Divider />

                <div style={{ padding: 12, background: '#f6ffed', borderRadius: 4 }}>
                  <p style={{ margin: 0 }}>
                    退租后，该租约将被取消，
                    {result.remainingDays && result.remainingDays > 0 ? (
                      <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                        预计可退款 ¥{result.refundAmount}
                      </span>
                    ) : (
                      <span style={{ color: '#ff4d4f' }}>无退款</span>
                    )}
                  </p>
                </div>

                <div style={{ marginTop: 16 }}>
                  <Tag color="orange">按日折算</Tag>
                  <Tag color="blue">实时计算</Tag>
                  <Tag color="green">公正透明</Tag>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <DollarOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                <p>选择租约后自动计算</p>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RefundTrial;
