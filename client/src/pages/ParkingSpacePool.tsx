import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Tag, Statistic, Modal, Button, Space, Input, Select, message, Form, Popconfirm } from 'antd';
import { SearchOutlined, LockOutlined, UnlockOutlined, StopOutlined, FundProjectionScreenOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const { Option } = Select;

const statusMap: any = {
  available: { label: '可用', color: 'green' },
  rented: { label: '已租', color: 'blue' },
  frozen: { label: '冻结', color: 'red' },
  temporary: { label: '临停', color: 'orange' },
};

const ParkingSpacePool: React.FC = () => {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [detailModal, setDetailModal] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<any>(null);
  const [activeLease, setActiveLease] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [filterStatus, keyword]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (keyword) params.keyword = keyword;
      
      const [spacesRes, statsRes]: any = await Promise.all([
        api.get('/parking-spaces', { params }),
        api.get('/parking-spaces/stats'),
      ]);
      
      setSpaces(spacesRes.data || []);
      setStats(statsRes.data || {});
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSpaceClick = async (space: any) => {
    setSelectedSpace(space);
    setDetailModal(true);
    setActiveLease(null);
    
    if (space.status === 'rented') {
      try {
        const res: any = await api.get(`/leases/space/${space.id}/active`);
        if (res.data) {
          const leaseRes: any = await api.get(`/leases/${res.data.id}/detail`);
          setActiveLease(leaseRes.data);
        }
      } catch (e) {}
    }
  };

  const handleFreeze = async () => {
    if (!selectedSpace) return;
    try {
      const res: any = await api.post(`/parking-spaces/${selectedSpace.id}/freeze`, { reason: '管理员操作' });
      if (res.success) {
        message.success('冻结成功');
        loadData();
        setDetailModal(false);
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const handleUnfreeze = async () => {
    if (!selectedSpace) return;
    try {
      const res: any = await api.post(`/parking-spaces/${selectedSpace.id}/unfreeze`);
      if (res.success) {
        message.success('解冻成功');
        loadData();
        setDetailModal(false);
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const handleToggleLock = async (locked: boolean) => {
    if (!selectedSpace) return;
    try {
      const res: any = await api.post(`/parking-spaces/${selectedSpace.id}/lock`, { 
        lock_status: locked ? 'locked' : 'unlocked' 
      });
      if (res.success) {
        message.success(locked ? '已锁定' : '已解锁');
        loadData();
        setSelectedSpace({ ...selectedSpace, lock_status: locked ? 'locked' : 'unlocked' });
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const handleToggleTempOccupied = async (occupied: boolean) => {
    if (!selectedSpace) return;
    try {
      const res: any = await api.post(`/parking-spaces/${selectedSpace.id}/temp-occupied`, { occupied });
      if (res.success) {
        message.success(occupied ? '已设为临停占用' : '已取消临停占用');
        loadData();
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>车位池</h2>
        <Space>
          <Button icon={<FundProjectionScreenOutlined />} onClick={() => navigate('/space-lifecycle')}>
            生命周期回放
          </Button>
          <Input
            placeholder="搜索车位编号"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
          />
          <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 120 }}>
            <Option value="all">全部</Option>
            <Option value="available">可用</Option>
            <Option value="rented">已租</Option>
            <Option value="frozen">冻结</Option>
          </Select>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="总车位" value={stats.total || 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="可用" value={stats.available || 0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="已租用" value={stats.rented || 0} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="冻结" value={stats.frozen || 0} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Card title="车位分布图" loading={loading}>
        <div className="parking-grid">
          {spaces.map((space) => (
            <div
              key={space.id}
              className={`parking-space ${space.status} ${space.temp_occupied ? 'temporary' : ''}`}
              onClick={() => handleSpaceClick(space)}
            >
              <div className="space-code">{space.code}</div>
              <div className="space-status">
                {statusMap[space.status]?.label || space.status}
                {space.lock_status === 'locked' && ' 🔒'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        title={`车位详情 - ${selectedSpace?.code}`}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={null}
        width={600}
      >
        {selectedSpace && (
          <div>
            <Row gutter={[16, 8]}>
              <Col span={12}>
                <p><strong>车位编号：</strong>{selectedSpace.code}</p>
              </Col>
              <Col span={12}>
                <p><strong>位置：</strong>{selectedSpace.location || '-'}</p>
              </Col>
              <Col span={12}>
                <p><strong>类型：</strong>{selectedSpace.type}</p>
              </Col>
              <Col span={12}>
                <p><strong>状态：</strong>
                  <Tag color={statusMap[selectedSpace.status]?.color}>
                    {statusMap[selectedSpace.status]?.label}
                  </Tag>
                </p>
              </Col>
              <Col span={12}>
                <p><strong>车位锁：</strong>
                  {selectedSpace.lock_status === 'locked' ? '已锁定 🔒' : '未锁定 🔓'}
                </p>
              </Col>
              <Col span={12}>
                <p><strong>临停占用：</strong>
                  {selectedSpace.temp_occupied ? '是' : '否'}
                </p>
              </Col>
            </Row>

            {selectedSpace.frozen_reason && (
              <p style={{ color: '#ff4d4f' }}><strong>冻结原因：</strong>{selectedSpace.frozen_reason}</p>
            )}

            <Divider />

            {activeLease && (
              <div style={{ marginBottom: 16 }}>
                <h4>当前租约</h4>
                <p><strong>租户：</strong>{activeLease.tenant?.name}</p>
                <p><strong>车牌：</strong>{activeLease.vehicle?.plate_no}</p>
                <p><strong>租期：</strong>{activeLease.start_date} 至 {activeLease.end_date}</p>
                <p><strong>月租金：</strong>¥{activeLease.monthly_price}</p>
              </div>
            )}

            <Space wrap>
              <Button
                icon={<FundProjectionScreenOutlined />}
                onClick={() => {
                  setDetailModal(false);
                  navigate(`/space-lifecycle?spaceId=${selectedSpace.id}`);
                }}
              >
                生命周期回放
              </Button>

              {selectedSpace.status === 'frozen' ? (
                <Button type="primary" icon={<StopOutlined />} onClick={handleUnfreeze}>
                  解冻
                </Button>
              ) : selectedSpace.status === 'available' && (
                <Button danger icon={<StopOutlined />} onClick={handleFreeze}>
                  冻结车位
                </Button>
              )}

              {selectedSpace.lock_status === 'locked' ? (
                <Button icon={<UnlockOutlined />} onClick={() => handleToggleLock(false)}>
                  解锁车位锁
                </Button>
              ) : (
                <Button icon={<LockOutlined />} onClick={() => handleToggleLock(true)}>
                  锁定车位锁
                </Button>
              )}

              {selectedSpace.status === 'available' && (
                selectedSpace.temp_occupied ? (
                  <Button onClick={() => handleToggleTempOccupied(false)}>
                    取消临停占用
                  </Button>
                ) : (
                  <Button type="default" onClick={() => handleToggleTempOccupied(true)}>
                    设为临停占用
                  </Button>
                )
              )}
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
};

function Divider() {
  return <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #f0f0f0' }} />;
}

export default ParkingSpacePool;
