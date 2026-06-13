import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Progress, Typography } from 'antd';
import {
  CarOutlined,
  UserOutlined,
  WarningOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>({});
  const [parkingStats, setParkingStats] = useState<any>({});
  const [expiringSoon, setExpiringSoon] = useState<any[]>([]);
  const [arrearsAging, setArrearsAging] = useState<any>({});
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [parkingRes, leasesRes, arrearsRes, logsRes]: any = await Promise.all([
        api.get('/parking-spaces/stats'),
        api.get('/leases?status=active&pageSize=1'),
        api.get('/arrears/stats/aging'),
        api.get('/audit-logs?pageSize=10'),
      ]);
      
      setParkingStats(parkingRes.data || {});
      setStats({
        ...parkingRes.data,
        activeLeases: leasesRes.data?.total || 0,
      });
      setArrearsAging(arrearsRes.data || {});
      setRecentLogs(logsRes.data?.list || []);

      const expRes: any = await api.get('/leases/expiring-soon?days=30');
      setExpiringSoon(expRes.data || []);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    }
  };

  return (
    <div>
      <Title level={3} className="page-header">工作台</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="总车位"
              value={parkingStats.total || 0}
              prefix={<CarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="已租用"
              value={parkingStats.rented || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="可用"
              value={parkingStats.available || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="欠费笔数"
              value={arrearsAging.total || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="即将到期（30天内）" extra={<Tag color="orange">{expiringSoon.length} 笔</Tag>}>
            <List
              size="small"
              dataSource={expiringSoon.slice(0, 8)}
              locale={{ emptyText: '暂无即将到期的租约' }}
              renderItem={(item: any) => (
                <List.Item
                  actions={[
                    <Tag key="days" color={
                      dayjs(item.end_date).diff(dayjs(), 'day') <= 7 ? 'red' : 
                      dayjs(item.end_date).diff(dayjs(), 'day') <= 15 ? 'orange' : 'blue'
                    }>
                      还剩 {dayjs(item.end_date).diff(dayjs(), 'day')} 天
                    </Tag>
                  ]}
                >
                  <List.Item.Meta
                    title={`租约 ${item.id?.slice(0, 8)}...`}
                    description={
                      <Text type="secondary">
                        到期日: {item.end_date}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="欠费账龄分布">
            <div style={{ padding: '12px 0' }}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">0-30天</Text>
                <Progress percent={arrearsAging.total ? Math.round((arrearsAging['0-30'] || 0) / arrearsAging.total * 100) : 0} status="active" />
                <Text type="secondary" style={{ float: 'right' }}>{arrearsAging['0-30'] || 0} 笔</Text>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">31-60天</Text>
                <Progress percent={arrearsAging.total ? Math.round((arrearsAging['31-60'] || 0) / arrearsAging.total * 100) : 0} strokeColor="#faad14" />
                <Text type="secondary" style={{ float: 'right' }}>{arrearsAging['31-60'] || 0} 笔</Text>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">61-90天</Text>
                <Progress percent={arrearsAging.total ? Math.round((arrearsAging['61-90'] || 0) / arrearsAging.total * 100) : 0} strokeColor="#ff7a45" />
                <Text type="secondary" style={{ float: 'right' }}>{arrearsAging['61-90'] || 0} 笔</Text>
              </div>
              <div>
                <Text type="secondary">90天以上</Text>
                <Progress percent={arrearsAging.total ? Math.round((arrearsAging['90+'] || 0) / arrearsAging.total * 100) : 0} strokeColor="#ff4d4f" status="exception" />
                <Text type="secondary" style={{ float: 'right' }}>{arrearsAging['90+'] || 0} 笔</Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="最近操作日志" style={{ marginTop: 16 }}>
        <List
          size="small"
          dataSource={recentLogs}
          locale={{ emptyText: '暂无操作记录' }}
          renderItem={(item: any) => (
            <List.Item>
              <List.Item.Meta
                avatar={<UserOutlined />}
                title={`${item.operator} - ${item.action}`}
                description={
                  <>
                    <Text type="secondary">{item.module}</Text>
                    <Text type="secondary" style={{ marginLeft: 12 }}>{item.created_at}</Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
