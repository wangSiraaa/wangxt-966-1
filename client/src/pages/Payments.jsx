import React, { useEffect, useState } from 'react';
import { Table, Button, Select, Space, message, Statistic, Row, Col, Card, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { paymentsApi } from '../api.js';

export default function PaymentsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [daily, setDaily] = useState(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  const loadData = async () => {
    setLoading(true);
    const [lRes, dRes] = await Promise.all([paymentsApi.list(), paymentsApi.daily(date)]);
    if (lRes?.code === 0) setList(lRes.data);
    if (dRes?.code === 0) setDaily(dRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [date]);

  const methodMap = {
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    bank: '银行转账',
    card: '刷卡',
    offline: '线下收款'
  };

  const columns = [
    { title: '流水编号', dataIndex: 'payment_no', key: 'payment_no', width: 220 },
    { title: '车主', dataIndex: 'tenant_name', key: 'tenant_name', width: 100 },
    { title: '车位', dataIndex: 'space_no', key: 'space_no', width: 100 },
    { title: '关联租约', dataIndex: 'lease_no', key: 'lease_no', width: 160 },
    { title: '关联欠费', dataIndex: 'arrears_record_no', key: 'arrears_record_no', width: 180 },
    {
      title: '收款方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 120,
      render: (v) => methodMap[v] || v
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v) => <span style={{ fontWeight: 600 }}>¥{v?.toFixed(2)}</span>
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 120 },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (v) => (v ? <span style={{ color: 'rgba(0,0,0,0.5)' }}>{v}</span> : '—')
    }
  ];

  return (
    <div>
      {daily && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title={`当日收款总额 (${date})`}
                precision={2}
                prefix="¥"
                value={daily.total_amount}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="当日收款笔数" value={daily.total_count} suffix="笔" />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="收款方式分布" value={daily.by_method?.length || 0} suffix="种" />
              {daily.by_method?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  {daily.by_method.map((m) => (
                    <div key={m.payment_method}>
                      {methodMap[m.payment_method] || m.payment_method}: ¥{m.total.toFixed(2)} ({m.cnt}笔)
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>
      )}

      <div className="action-bar">
        <DatePicker
          value={dayjs(date)}
          onChange={(d) => d && setDate(d.format('YYYY-MM-DD'))}
          style={{ width: 200 }}
        />
        <div style={{ flex: 1 }} />
        <Button onClick={loadData}>刷新</Button>
      </div>

      <div className="table-card">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1400 }}
        />
      </div>
    </div>
  );
}
