import React, { useEffect, useState } from 'react';
import { Select, Card, Tag, Timeline, Table, Statistic, Row, Col, Alert, Space, Button, Descriptions, message, Spin } from 'antd';
import { ArrowLeftOutlined, WarningOutlined } from '@ant-design/icons';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const statusMap: any = {
  available: { label: '可用', color: 'green' },
  rented: { label: '已租', color: 'blue' },
  frozen: { label: '冻结', color: 'red' },
  temporary: { label: '临停', color: 'orange' },
};

const lockStatusMap: any = {
  locked: { label: '已锁定', color: 'red' },
  unlocked: { label: '未锁定', color: 'green' },
};

const lifecycleEventColorMap: any = {
  create: 'blue',
  confirm_contract: 'blue',
  renew: 'green',
  renewed: 'green',
  terminate: 'red',
  cancel: 'red',
  expired_recovered: 'red',
  expired: 'orange',
  swap_request: 'cyan',
  swap_completed: 'cyan',
  swap_rejected: 'cyan',
  plate_change: 'purple',
};

const lifecycleEventLabelMap: any = {
  create: '创建',
  confirm_contract: '合同确认',
  renew: '续费',
  renewed: '被续费',
  terminate: '退租',
  cancel: '取消',
  expired_recovered: '过期回收',
  expired: '到期',
  swap_request: '调换申请',
  swap_completed: '调换完成',
  swap_rejected: '调换驳回',
  plate_change: '车牌变更',
};

const leaseColumns = [
  { title: '租户', dataIndex: ['tenant', 'name'], key: 'tenant' },
  { title: '车牌号', dataIndex: ['vehicle', 'plate_no'], key: 'plate' },
  { title: '开始日期', dataIndex: 'start_date', key: 'start' },
  { title: '结束日期', dataIndex: 'end_date', key: 'end' },
  {
    title: '月租金',
    dataIndex: 'monthly_price',
    key: 'price',
    render: (v: number) => `¥${v}`,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (v: string) => {
      const map: any = {
        pending: { label: '待确认', color: 'orange' },
        active: { label: '生效中', color: 'green' },
        expired: { label: '已过期', color: 'default' },
        cancelled: { label: '已取消', color: 'red' },
      };
      const item = map[v] || { label: v, color: 'default' };
      return <Tag color={item.color}>{item.label}</Tag>;
    },
  },
];

const SpaceLifecycle: React.FC = () => {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>(undefined);
  const [lifecycle, setLifecycle] = useState<any>(null);
  const [anomaly, setAnomaly] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [spacesLoading, setSpacesLoading] = useState(false);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    setSpacesLoading(true);
    try {
      const res: any = await api.get('/parking-spaces');
      setSpaces(res.data || []);
    } catch (e) {
      message.error('加载车位列表失败');
    } finally {
      setSpacesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSpaceId) {
      loadLifecycle();
      loadAnomaly();
    } else {
      setLifecycle(null);
      setAnomaly(null);
    }
  }, [selectedSpaceId]);

  const loadLifecycle = async () => {
    if (!selectedSpaceId) return;
    setLoading(true);
    try {
      const res: any = await api.get(`/lifecycle/space/${selectedSpaceId}/full`);
      setLifecycle(res.data);
    } catch (e) {
      message.error('加载生命周期数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAnomaly = async () => {
    if (!selectedSpaceId) return;
    try {
      const res: any = await api.get(`/lifecycle/space/${selectedSpaceId}/lock-anomaly`);
      setAnomaly(res.data);
    } catch (e) {
      setAnomaly(null);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/parking-spaces')}>
            返回车位池
          </Button>
          <h2 style={{ margin: 0 }}>车位生命周期回放</h2>
        </Space>
        <Select
          showSearch
          placeholder="选择车位"
          style={{ width: 240 }}
          loading={spacesLoading}
          value={selectedSpaceId}
          onChange={setSelectedSpaceId}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={spaces.map((s: any) => ({
            label: `${s.code} - ${s.location || s.type}`,
            value: s.id,
          }))}
        />
      </div>

      {anomaly?.detected && (
        <Alert
          message="车位锁异常"
          description={anomaly.message || '检测到车位锁状态异常，请及时处理'}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" tip="加载中..." />
        </div>
      )}

      {!loading && lifecycle && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Descriptions column={4} bordered size="small">
              <Descriptions.Item label="车位编号">{lifecycle.space?.code}</Descriptions.Item>
              <Descriptions.Item label="位置">{lifecycle.space?.location || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusMap[lifecycle.space?.status]?.color}>
                  {statusMap[lifecycle.space?.status]?.label || lifecycle.space?.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="车位锁">
                <Tag color={lockStatusMap[lifecycle.space?.lock_status]?.color}>
                  {lockStatusMap[lifecycle.space?.lock_status]?.label || lifecycle.space?.lock_status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}>
              <Card>
                <Statistic title="总租赁次数" value={lifecycle.statistics?.total_rental_count || 0} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="总收入"
                  value={lifecycle.statistics?.total_revenue || 0}
                  prefix="¥"
                  precision={2}
                />
              </Card>
            </Col>
          </Row>

          <Card title="生命周期事件" style={{ marginBottom: 16 }}>
            <Timeline
              mode="left"
              items={(lifecycle.lifecycle_logs || []).map((log: any, idx: number) => ({
                color: lifecycleEventColorMap[log.event_type] || 'blue',
                children: (
                  <div key={idx}>
                    <div>
                      <strong>{lifecycleEventLabelMap[log.event_type] || log.event_type}</strong>
                      <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>{log.created_at}</span>
                    </div>
                    {log.remark && (
                      <div style={{ margin: '4px 0', fontSize: 13 }}>{log.remark}</div>
                    )}
                    {log.event_data && Object.keys(log.event_data).length > 0 && (
                      <div style={{ fontSize: 12, color: '#666', background: '#fafafa', padding: '4px 8px', borderRadius: 4, marginTop: 4 }}>
                        {Object.entries(log.event_data).map(([k, v]) => (
                          <span key={k} style={{ marginRight: 16 }}>{k}: {String(v)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          </Card>

          <Card title="历史租约">
            <Table
              rowKey="id"
              columns={leaseColumns}
              dataSource={lifecycle.leases || []}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </>
      )}

      {!loading && !lifecycle && selectedSpaceId === undefined && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            请选择一个车位查看生命周期回放
          </div>
        </Card>
      )}
    </div>
  );
};

export default SpaceLifecycle;
