import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Timeline, Modal, Form, Select, InputNumber, message, Popconfirm, Divider, List, Statistic, Row, Col } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Option } = Select;

const statusMap: any = {
  pending: { label: '待确认', color: 'orange' },
  active: { label: '生效中', color: 'green' },
  expired: { label: '已过期', color: 'default' },
  cancelled: { label: '已取消', color: 'red' },
};

const eventTypeMap: any = {
  create: { label: '创建', color: 'blue' },
  renew: { label: '续费', color: 'green' },
  renewed: { label: '被续费', color: 'green' },
  confirm_contract: { label: '合同确认', color: 'purple' },
  cancel: { label: '取消', color: 'red' },
  terminate: { label: '退租', color: 'red' },
  expired: { label: '到期', color: 'orange' },
  expired_recovered: { label: '过期回收', color: 'default' },
  swap_request: { label: '调换申请', color: 'cyan' },
  swap_completed: { label: '调换完成', color: 'green' },
  swap_rejected: { label: '调换驳回', color: 'red' },
};

const LeaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [renewModal, setRenewModal] = useState(false);
  const [terminateModal, setTerminateModal] = useState(false);
  const [renewMonths, setRenewMonths] = useState(3);
  const [renewPrice, setRenewPrice] = useState<any>(null);
  const [canRenew, setCanRenew] = useState<any>(null);
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const [arrears, setArrears] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [detailRes, canRenewRes, refundRes, arrearsRes, invoicesRes]: any = await Promise.all([
        api.get(`/leases/${id}/detail`),
        api.get(`/leases/${id}/can-renew`),
        api.get(`/leases/${id}/refund`),
        api.get(`/arrears/lease/${id}`),
        api.get(`/invoices?lease_id=${id}`),
      ]);
      
      setDetail(detailRes.data);
      setCanRenew(canRenewRes.data);
      if (refundRes.data?.success) {
        setRefundAmount(refundRes.data.refundAmount || 0);
      }
      setArrears(arrearsRes.data?.list || arrearsRes.data || []);
      setInvoices(invoicesRes.data?.list || invoicesRes.data || []);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRenew = async () => {
    if (!canRenew?.can) {
      message.error(canRenew?.reason || '无法续费');
      return;
    }
    setRenewModal(true);
    setRenewMonths(3);
    try {
      const res: any = await api.get(`/leases/${id}/renewal-price?months=3`);
      setRenewPrice(res.data);
    } catch (e) {}
  };

  const handleMonthsChange = async (val: number) => {
    setRenewMonths(val);
    try {
      const res: any = await api.get(`/leases/${id}/renewal-price?months=${val}`);
      setRenewPrice(res.data);
    } catch (e) {}
  };

  const handleConfirmRenew = async () => {
    try {
      const res: any = await api.post(`/leases/${id}/renew`, { months: renewMonths });
      if (res.success) {
        message.success('续费成功');
        setRenewModal(false);
        loadData();
      } else {
        message.error(res.message || '续费失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '续费失败');
    }
  };

  const handleOpenTerminate = async () => {
    setTerminateModal(true);
    try {
      const res: any = await api.get(`/leases/${id}/refund`);
      if (res.data?.success) {
        setRefundAmount(res.data.refundAmount || 0);
      }
    } catch (e) {}
  };

  const handleConfirmTerminate = async () => {
    try {
      const res: any = await api.post(`/leases/${id}/terminate`, { reason: '用户申请退租' });
      if (res.success) {
        message.success('退租成功');
        setTerminateModal(false);
        loadData();
      } else {
        message.error(res.message || '退租失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '退租失败');
    }
  };

  const handleConfirmContract = async () => {
    try {
      const res: any = await api.post(`/leases/${id}/confirm`);
      if (res.success) {
        message.success('合同已确认');
        loadData();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  if (!detail && !loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <h2 style={{ margin: 0 }}>租约详情</h2>
          <Tag color={statusMap[detail?.status]?.color}>
            {statusMap[detail?.status]?.label}
          </Tag>
          {detail?.contract_status === 'unconfirmed' && (
            <Tag color="orange">合同未确认</Tag>
          )}
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          {detail?.contract_status === 'unconfirmed' && (
            <Button type="primary" onClick={handleConfirmContract}>
              确认合同
            </Button>
          )}
          {detail?.status === 'active' && detail?.contract_status === 'confirmed' && (
            <>
              <Button 
                type="primary" 
                onClick={handleOpenRenew}
                disabled={!canRenew?.can}
              >
                续费
              </Button>
              <Popconfirm
                title="确定要退租吗？"
                description={`预计退款: ¥${refundAmount || 0}`}
                onConfirm={handleConfirmTerminate}
                okText="确认退租"
                cancelText="取消"
              >
                <Button danger>退租</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </div>

      {!canRenew?.can && detail?.status === 'active' && (
        <Card type="inner" style={{ marginBottom: 16, borderColor: '#ffa39e', background: '#fff1f0' }}>
          <p style={{ color: '#ff4d4f', margin: 0 }}>
            <strong>⚠️ 无法续费：</strong> {canRenew?.reason}
          </p>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Card title="基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="车位编号">
                {detail?.space?.code || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="车位位置">
                {detail?.space?.location || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="租户姓名">
                {detail?.tenant?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {detail?.tenant?.phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="车牌号">
                {detail?.vehicle?.plate_no || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="车辆类型">
                {detail?.vehicle?.vehicle_type || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开始日期">
                {detail?.start_date}
              </Descriptions.Item>
              <Descriptions.Item label="结束日期">
                {detail?.end_date}
              </Descriptions.Item>
              <Descriptions.Item label="月租金">
                ¥{detail?.monthly_price}
              </Descriptions.Item>
              <Descriptions.Item label="总金额">
                ¥{detail?.total_amount}
              </Descriptions.Item>
              <Descriptions.Item label="已付金额">
                ¥{detail?.paid_amount || 0}
              </Descriptions.Item>
              <Descriptions.Item label="来源">
                {detail?.source === 'renew' ? '续费' : 
                 detail?.source === 'swap' ? '调换' : '新租'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="欠费记录">
            {arrears.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>暂无欠费记录</p>
            ) : (
              <List
                size="small"
                dataSource={arrears}
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={`¥${item.amount} - ${item.arrears_type}`}
                      description={
                        <>
                          <Tag color={item.status === 'paid' ? 'green' : 'red'}>
                            {item.status === 'paid' ? '已结清' : '未结清'}
                          </Tag>
                          <span style={{ marginLeft: 8 }}>到期: {item.due_date}</span>
                          <span style={{ marginLeft: 8, color: '#ff4d4f' }}>
                            账龄: {item.age_days}天
                          </span>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="租约时间线" style={{ marginBottom: 16 }}>
            <Timeline
              mode="left"
              items={(detail?.timeline || []).map((item: any) => ({
                color: eventTypeMap[item.event_type]?.color || 'blue',
                children: (
                  <div className="timeline-event">
                    <div className="event-time">{item.created_at}</div>
                    <div className="event-content">
                      <strong>{eventTypeMap[item.event_type]?.label || item.event_type}</strong>
                      {item.remark && <p style={{ margin: '4px 0 0', fontSize: 12 }}>{item.remark}</p>}
                    </div>
                  </div>
                ),
              }))}
            />
          </Card>

          <Card title="发票记录">
            {invoices.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>暂无发票记录</p>
            ) : (
              <List
                size="small"
                dataSource={invoices}
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={`${item.title} - ¥${item.amount}`}
                      description={item.status}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="续费"
        open={renewModal}
        onOk={handleConfirmRenew}
        onCancel={() => setRenewModal(false)}
        okText="确认续费"
        cancelText="取消"
      >
        <Form layout="vertical">
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
          <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ margin: '4px 0' }}>月单价：<strong>¥{renewPrice.monthlyPrice}</strong></p>
            {renewPrice.discountRate < 1 && (
              <p style={{ margin: '4px 0', color: '#52c41a' }}>
                优惠折扣：<strong>{(renewPrice.discountRate * 10).toFixed(1)}折</strong>
              </p>
            )}
            <Divider style={{ margin: '8px 0' }} />
            <p style={{ margin: 0, fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
              共计 ¥{renewPrice.finalAmount}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LeaseDetail;
