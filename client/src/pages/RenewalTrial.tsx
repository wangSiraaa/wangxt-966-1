import React, { useState, useEffect } from 'react';
import { Card, Form, Select, Button, InputNumber, Statistic, Row, Col, message, Divider, Tag, Table } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

const RenewalTrial: React.FC = () => {
  const [leases, setLeases] = useState<any[]>([]);
  const [selectedLease, setSelectedLease] = useState<any>(null);
  const [months, setMonths] = useState(3);
  const [result, setResult] = useState<any>(null);
  const [canRenew, setCanRenew] = useState<any>(null);
  const [priceTiers, setPriceTiers] = useState<any[]>([]);

  useEffect(() => {
    loadLeases();
    loadPriceTiers();
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

  const loadPriceTiers = async () => {
    try {
      const res: any = await api.get('/price-tiers?active_only=true');
      setPriceTiers(res.data || []);
    } catch (e) {}
  };

  const handleLeaseChange = async (leaseId: string) => {
    const lease = leases.find(l => l.id === leaseId);
    setSelectedLease(lease || null);
    setResult(null);
    setCanRenew(null);

    if (leaseId) {
      try {
        const canRenewRes: any = await api.get(`/leases/${leaseId}/can-renew`);
        setCanRenew(canRenewRes.data);
      } catch (e) {}
    }
  };

  const handleCalculate = async () => {
    if (!selectedLease) {
      message.warning('请选择租约');
      return;
    }
    try {
      const res: any = await api.get(`/leases/${selectedLease.id}/renewal-price?months=${months}`);
      setResult(res.data);
    } catch (e: any) {
      message.error(e.response?.data?.message || '计算失败');
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
      dataIndex: 'min_months',
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
      render: (price: number) => price ? `¥${price}` : '按租约',
    },
  ];

  return (
    <div>
      <h2 className="page-header">续费试算</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="续费计算">
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
                <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4, marginBottom: 16 }}>
                  <p style={{ margin: '4px 0' }}><strong>车位：</strong>{selectedLease.space?.code}</p>
                  <p style={{ margin: '4px 0' }}><strong>租户：</strong>{selectedLease.tenant?.name}</p>
                  <p style={{ margin: '4px 0' }}><strong>当前月租金：</strong>¥{selectedLease.monthly_price}</p>
                  <p style={{ margin: '4px 0' }}><strong>到期日：</strong>{selectedLease.end_date}</p>
                </div>
              )}

              {canRenew && !canRenew.can && (
                <div style={{ padding: 12, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 4, marginBottom: 16, color: '#ff4d4f' }}>
                  <strong>⚠️ 不可续费：</strong>{canRenew.reason}
                </div>
              )}

              <Form.Item label="续费月数">
                <Select value={months} onChange={setMonths}>
                  <Option value={1}>1个月</Option>
                  <Option value={3}>3个月</Option>
                  <Option value={6}>6个月</Option>
                  <Option value={12}>12个月</Option>
                  <Option value={24}>24个月</Option>
                </Select>
              </Form.Item>

              <Button
                type="primary"
                icon={<CalculatorOutlined />}
                onClick={handleCalculate}
                block
                disabled={!canRenew?.can}
              >
                计算费用
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="计算结果">
            {result ? (
              <div>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Statistic title="月单价" value={result.monthlyPrice} prefix="¥" />
                  </Col>
                  <Col span={12}>
                    <Statistic title="续费月数" value={months} suffix="个月" />
                  </Col>
                </Row>

                <Divider />

                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Statistic
                      title="原价合计"
                      value={result.originalAmount}
                      prefix="¥"
                      valueStyle={{ textDecoration: 'line-through', color: '#999' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="折扣后合计"
                      value={result.finalAmount}
                      prefix="¥"
                      valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
                    />
                  </Col>
                </Row>

                {result.discountRate < 1 && (
                  <div style={{ marginTop: 16, padding: 12, background: '#f6ffed', borderRadius: 4, textAlign: 'center' }}>
                    <p style={{ margin: 0, color: '#52c41a' }}>
                      优惠折扣：<strong>{(result.discountRate * 10).toFixed(1)}折</strong>
                      ，节省 <strong>¥{Math.round((result.originalAmount - result.finalAmount) * 100) / 100}</strong>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <CalculatorOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                <p>选择租约后点击计算</p>
              </div>
            )}
          </Card>

          <Card title="阶梯价标准" style={{ marginTop: 16 }}>
            <Table
              size="small"
              dataSource={priceTiers}
              columns={columns}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RenewalTrial;
