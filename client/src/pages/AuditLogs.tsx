import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Input, Select, DatePicker, Card, Row, Col, Statistic } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const moduleMap: any = {
  parking_space: '车位',
  tenant: '租户',
  vehicle: '车辆',
  lease: '租约',
  arrears: '欠费',
  invoice: '发票',
  space_swap: '车位调换',
  price_tier: '阶梯价',
  audit_log: '审计日志',
};

const actionColorMap: any = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  approve: 'green',
  reject: 'red',
  confirm: 'purple',
  cancel: 'orange',
  renew: 'cyan',
  terminate: 'red',
  pay: 'green',
  issue: 'green',
  freeze: 'red',
  unfreeze: 'green',
  batch_renew: 'blue',
};

const AuditLogs: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [module, setModule] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [operator, setOperator] = useState('');
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    loadData();
    loadStats();
  }, [page, pageSize, module, action, operator]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (module) params.module = module;
      if (action) params.action = action;
      if (operator) params.operator = operator;
      
      const res: any = await api.get('/audit-logs', { params });
      setData(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res: any = await api.get('/audit-logs/stats');
      setStats(res.data || {});
    } catch (e) {}
  };

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
      render: (mod: string) => (
        <Tag color="blue">{moduleMap[mod] || mod}</Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (act: string) => (
        <Tag color={actionColorMap[act] || 'default'}>{act}</Tag>
      ),
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      key: 'target_id',
      render: (id: string) => id ? id.slice(0, 12) + '...' : '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>审计日志</h2>
        <Space>
          <Input
            placeholder="操作人"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            style={{ width: 150 }}
            allowClear
          />
          <Select
            placeholder="模块"
            value={module || undefined}
            onChange={setModule}
            style={{ width: 120 }}
            allowClear
          >
            {Object.entries(moduleMap).map(([key, label]) => (
              <Option key={key} value={key}>{String(label)}</Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="今日操作" value={stats.today || 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="近7天" value={stats.thisWeek || 0} />
          </Card>
        </Col>
      </Row>

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
    </div>
  );
};

export default AuditLogs;
