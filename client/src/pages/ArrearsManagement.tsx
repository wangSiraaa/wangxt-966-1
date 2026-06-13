import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Input, Select, Modal, message, Card, Statistic, Row, Col, Progress } from 'antd';
import { SearchOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

const statusMap: any = {
  unpaid: { label: '未结清', color: 'red' },
  partial: { label: '部分支付', color: 'orange' },
  paid: { label: '已结清', color: 'green' },
};

const ArrearsManagement: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [agingStats, setAgingStats] = useState<any>({});
  const [payModal, setPayModal] = useState(false);
  const [selectedArrears, setSelectedArrears] = useState<any>(null);

  useEffect(() => {
    loadData();
    loadAgingStats();
  }, [page, pageSize, status, keyword]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (status) params.status = status;
      if (keyword) params.keyword = keyword;
      
      const res: any = await api.get('/arrears', { params });
      const list = res.data?.list || [];
      
      const enriched = await Promise.all(
        list.map(async (item: any) => {
          try {
            const [tenantRes, leaseRes]: any = await Promise.all([
              api.get(`/tenants/${item.tenant_id}`),
              api.get(`/leases/${item.lease_id}`),
            ]);
            return {
              ...item,
              tenant: tenantRes.data,
              lease: leaseRes.data,
            };
          } catch (e) {
            return item;
          }
        })
      );
      
      setData(enriched);
      setTotal(res.data?.total || 0);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAgingStats = async () => {
    try {
      const res: any = await api.get('/arrears/stats/aging');
      setAgingStats(res.data || {});
    } catch (e) {}
  };

  const handlePay = (record: any) => {
    setSelectedArrears(record);
    setPayModal(true);
  };

  const confirmPay = async () => {
    if (!selectedArrears) return;
    try {
      const res: any = await api.post(`/arrears/${selectedArrears.id}/pay`, {
        amount: selectedArrears.amount,
      });
      if (res.success) {
        message.success('支付成功');
        setPayModal(false);
        loadData();
        loadAgingStats();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const getAgingTag = (days: number) => {
    if (days <= 30) return <Tag color="blue">0-30天</Tag>;
    if (days <= 60) return <Tag color="orange">31-60天</Tag>;
    if (days <= 90) return <Tag color="#ff7a45">61-90天</Tag>;
    return <Tag color="red">90天以上</Tag>;
  };

  const columns = [
    {
      title: '租户',
      dataIndex: ['tenant', 'name'],
      key: 'tenant',
      render: (text: string, record: any) => text || record.tenant_id?.slice(0, 8),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => <strong style={{ color: '#ff4d4f' }}>¥{val}</strong>,
      sorter: (a: any, b: any) => a.amount - b.amount,
    },
    {
      title: '类型',
      dataIndex: 'arrears_type',
      key: 'arrears_type',
      render: (type: string) => type === 'rent' ? '租金' : type,
    },
    {
      title: '到期日',
      dataIndex: 'due_date',
      key: 'due_date',
      sorter: (a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    },
    {
      title: '账龄',
      dataIndex: 'age_days',
      key: 'age_days',
      render: (days: number) => getAgingTag(days),
      sorter: (a: any, b: any) => a.age_days - b.age_days,
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
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status !== 'paid' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handlePay(record)}
            >
              标记已缴
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>欠费管理</h2>
        <Space>
          <Input
            placeholder="搜索"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            value={status || undefined}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="unpaid">未结清</Option>
            <Option value="partial">部分支付</Option>
            <Option value="paid">已结清</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="欠费总数" value={agingStats.total || 0} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="30天以内" value={agingStats['0-30'] || 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="31-60天" value={agingStats['31-60'] || 0} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="90天以上" value={agingStats['90+'] || 0} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Card title="欠费账龄分布" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <p style={{ marginBottom: 8 }}>0-30天</p>
            <Progress 
              percent={agingStats.total ? Math.round((agingStats['0-30'] || 0) / agingStats.total * 100) : 0} 
              status="active"
            />
            <p style={{ textAlign: 'right', color: '#666' }}>{agingStats['0-30'] || 0} 笔</p>
          </Col>
          <Col span={12}>
            <p style={{ marginBottom: 8 }}>31-60天</p>
            <Progress 
              percent={agingStats.total ? Math.round((agingStats['31-60'] || 0) / agingStats.total * 100) : 0} 
              strokeColor="#faad14"
            />
            <p style={{ textAlign: 'right', color: '#666' }}>{agingStats['31-60'] || 0} 笔</p>
          </Col>
          <Col span={12}>
            <p style={{ marginBottom: 8 }}>61-90天</p>
            <Progress 
              percent={agingStats.total ? Math.round((agingStats['61-90'] || 0) / agingStats.total * 100) : 0} 
              strokeColor="#ff7a45"
            />
            <p style={{ textAlign: 'right', color: '#666' }}>{agingStats['61-90'] || 0} 笔</p>
          </Col>
          <Col span={12}>
            <p style={{ marginBottom: 8 }}>90天以上</p>
            <Progress 
              percent={agingStats.total ? Math.round((agingStats['90+'] || 0) / agingStats.total * 100) : 0} 
              status="exception"
            />
            <p style={{ textAlign: 'right', color: '#666' }}>{agingStats['90+'] || 0} 笔</p>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal
        title="确认缴费"
        open={payModal}
        onOk={confirmPay}
        onCancel={() => setPayModal(false)}
        okText="确认已缴"
        cancelText="取消"
      >
        {selectedArrears && (
          <div>
            <p><strong>租户：</strong>{selectedArrears.tenant?.name || '-'}</p>
            <p><strong>欠费金额：</strong><span style={{ color: '#ff4d4f', fontSize: 18, fontWeight: 'bold' }}>¥{selectedArrears.amount}</span></p>
            <p><strong>欠费类型：</strong>{selectedArrears.arrears_type}</p>
            <p><strong>到期日：</strong>{selectedArrears.due_date}</p>
            <p><strong>账龄：</strong>{selectedArrears.age_days} 天</p>
            <p style={{ color: '#999', marginTop: 12 }}>
              注：本系统不接入真实支付，点击确认后标记为已结清。
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ArrearsManagement;
