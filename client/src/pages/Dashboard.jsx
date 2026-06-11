import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  InputNumber,
  message,
  Space,
  Divider,
  App as AntdApp
} from 'antd';
import {
  CarOutlined,
  FileTextOutlined,
  WarningOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { dashboardApi, leasesApi } from '../api.js';

function DaysBadge({ days }) {
  if (days <= 3) return <span className="days-badge days-danger">剩余 {days} 天到期</span>;
  if (days <= 7) return <span className="days-badge days-warning">剩余 {days} 天到期</span>;
  return <span className="days-badge days-normal">剩余 {days} 天到期</span>;
}

export default function DashboardPage() {
  const { modal } = AntdApp.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [renewalModal, setRenewalModal] = useState(false);
  const [selectedLease, setSelectedLease] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const res = await dashboardApi.overview();
    if (res?.code === 0) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRenewalSubmit = async () => {
    try {
      const values = await form.validateFields();
      const res = await leasesApi.submitRenewal({
        lease_id: selectedLease.id,
        months: values.months
      });

      if (res?.blocked) {
        if (res.block_type === 'UNSETTLED_ARREARS') {
          Modal.error({
            title: '续费被拦截 · 存在未结清欠费',
            width: 640,
            content: (
              <div>
                <div className="warn-block danger">
                  <div className="warn-title">⚠️ 欠费阻止了续费流程</div>
                  <div className="warn-msg">{res.message}</div>
                </div>
                {res.data?.arrears_list?.length > 0 && (
                  <div className="block-detail-list">
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>欠费明细：</div>
                    {res.data.arrears_list.map((a) => (
                      <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px dashed #f0f0f0' }}>
                        <Row>
                          <Col span={12}>记录编号: {a.record_no}</Col>
                          <Col span={12}>类型: {a.arrears_type}</Col>
                        </Row>
                        <Row>
                          <Col span={12}>
                            应缴: ¥{(a.amount - (a.settled_amount || 0)).toFixed(2)}
                          </Col>
                          <Col span={12}>车位: {a.space_no || '-'}</Col>
                        </Row>
                        <div style={{ color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>{a.description}</div>
                      </div>
                    ))}
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ color: '#cf1322', fontWeight: 600 }}>
                      请先前往「欠费管理」页面为车主结清上述 {res.data.arrears_list.length} 条欠费记录后再办理续费。
                    </div>
                  </div>
                )}
              </div>
            ),
            okText: '知道了'
          });
        } else if (res.block_type === 'SPACE_FROZEN') {
          Modal.error({
            title: '续费被拦截 · 车位已冻结',
            content: (
              <div className="warn-block danger">
                <div className="warn-title">❄️ 冻结车位阻止了续费流程</div>
                <div className="warn-msg">{res.message}</div>
              </div>
            ),
            okText: '知道了'
          });
        }
        return;
      }

      if (res?.code === 0) {
        message.success('续费申请已提交');
        setRenewalModal(false);
        form.resetFields();
        setSelectedLease(null);
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!data) return <div>加载中...</div>;

  const expiringColumns = [
    { title: '车位编号', dataIndex: 'space_no', key: 'space_no', width: 100 },
    { title: '车主姓名', dataIndex: 'tenant_name', key: 'tenant_name', width: 100 },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: '到期日期', dataIndex: 'end_date', key: 'end_date', width: 120 },
    {
      title: '到期预警',
      key: 'days_left',
      width: 150,
      render: (_, r) => <DaysBadge days={r.days_left} />
    },
    {
      title: '月租金额',
      dataIndex: 'monthly_amount',
      key: 'monthly_amount',
      width: 100,
      render: (v) => `¥${v?.toFixed(2)}`
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          onClick={() => {
            setSelectedLease(r);
            form.setFieldsValue({ months: 3 });
            setRenewalModal(true);
          }}
        >
          办理续费
        </Button>
      )
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={6}>
          <Card>
            <Statistic
              title="车位总数"
              value={data.spaces.total}
              prefix={<CarOutlined />}
              suffix="个"
              valueStyle={{ color: '#1677ff' }}
            />
            <div className="stat-extra">
              已占用 {data.spaces.occupied} 个 · 空闲 {data.spaces.available} 个
              {data.spaces.frozen > 0 && (
                <Tag color="red" style={{ marginLeft: 8 }}>
                  冻结 {data.spaces.frozen}
                </Tag>
              )}
              <div style={{ marginTop: 4 }}>利用率 {data.spaces.utilization}%</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card>
            <Statistic
              title={`即将到期 (${data.constants.expire_warning_days}天内)`}
              value={data.expiring_total}
              prefix={<FileTextOutlined />}
              suffix="份"
              valueStyle={{ color: '#faad14' }}
            />
            <div className="stat-extra">
              超过 {data.constants.expire_recycle_days} 天未续费将自动释放车位
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card>
            <Statistic
              title="待处理续费申请"
              value={data.renewals.pending}
              prefix={<SyncOutlined />}
              suffix="单"
              valueStyle={{ color: '#722ed1' }}
            />
            <div className="stat-extra">
              今日收款 ¥{data.today_payments.amount} ({data.today_payments.count}笔)
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card>
            <Statistic
              title="未结清欠费"
              value={data.arrears.unsettled_amount}
              prefix={<WarningOutlined />}
              precision={2}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <div className="stat-extra">共 {data.arrears.unsettled_count} 笔欠费待处理</div>
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 24 }}>
        <div className="page-header">
          <h2 className="page-title">
            <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
            到期预警（物业前台每日重点关注）
          </h2>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
          </Space>
        </div>

        {data.arrears.unsettled_count > 0 && (
          <div className="warn-block danger">
            <div className="warn-title">
              <WarningOutlined style={{ marginRight: 4 }} /> 欠费提醒
            </div>
            <div className="warn-msg">
              当前有 {data.arrears.unsettled_count} 位车主存在未结清欠费，共计 ¥
              {data.arrears.unsettled_amount.toFixed(2)}。
              请优先处理，欠费车主续费将被系统自动拦截。
            </div>
          </div>
        )}

        <div className="table-card">
          <Table
            rowKey="id"
            loading={loading}
            dataSource={data.expiring_leases}
            columns={expiringColumns}
            pagination={false}
            locale={{ emptyText: '暂无即将到期租约' }}
          />
        </div>
      </div>

      <Modal
        title={`办理续费 · 车位「${selectedLease?.space_no}」`}
        open={renewalModal}
        onCancel={() => {
          setRenewalModal(false);
          setSelectedLease(null);
        }}
        onOk={handleRenewalSubmit}
        okText="确认提交续费"
        okButtonProps={{ type: 'primary' }}
        width={560}
      >
        {selectedLease && (
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>车主姓名</div>
                  <div style={{ fontWeight: 600 }}>{selectedLease.tenant_name}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>车牌号码</div>
                  <div>{selectedLease.license_plate || '-'}</div>
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>当前到期日</div>
                <div>{selectedLease.end_date}</div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>月租金额</div>
                <div style={{ fontWeight: 600, color: '#1677ff' }}>
                  ¥{selectedLease.monthly_amount?.toFixed(2)}
                </div>
              </Col>
            </Row>
            <Divider />
            <Form.Item label="续期月数" name="months" rules={[{ required: true, message: '请输入续期月数' }]}>
              <InputNumber min={1} max={36} style={{ width: '100%' }} placeholder="请输入续期月数" />
            </Form.Item>
            <Form.Item shouldUpdate noStyle>
              {() => {
                const m = form.getFieldValue('months') || 0;
                const amount = (selectedLease.monthly_amount || 0) * m;
                const base = dayjs(selectedLease.end_date).isBefore(dayjs())
                  ? dayjs()
                  : dayjs(selectedLease.end_date);
                const newEnd = base.add(m, 'month');
                return (
                  m > 0 && (
                    <div className="warn-block info">
                      <div className="warn-title">续费信息确认</div>
                      <div className="warn-msg">
                        续费 {m} 个月，共需缴纳 ¥{amount.toFixed(2)}，新到期日：
                        {newEnd.format('YYYY-MM-DD')}
                      </div>
                    </div>
                  )
                );
              }}
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
