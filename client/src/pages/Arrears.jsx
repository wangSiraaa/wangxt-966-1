import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Select,
  Space,
  Modal,
  Form,
  InputNumber,
  Input,
  message,
  App as AntdApp,
  Tag,
  Statistic,
  Row,
  Col,
  Card
} from 'antd';
import { arrearsApi } from '../api.js';

export default function ArrearsPage() {
  const { modal } = AntdApp.useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState();
  const [stats, setStats] = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [currentRec, setCurrentRec] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const [lRes, sRes] = await Promise.all([
      arrearsApi.list({ status }),
      arrearsApi.stats()
    ]);
    if (lRes?.code === 0) setList(lRes.data);
    if (sRes?.code === 0) setStats(sRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [status]);

  const handlePay = (row) => {
    setCurrentRec(row);
    const remaining = row.amount - (row.settled_amount || 0);
    form.setFieldsValue({ amount: remaining, payment_method: 'cash', remark: '' });
    setPayModal(true);
  };

  const columns = [
    { title: '欠费编号', dataIndex: 'record_no', key: 'record_no', width: 180 },
    { title: '车位', dataIndex: 'space_no', key: 'space_no', width: 100 },
    { title: '车主', dataIndex: 'tenant_name', key: 'tenant_name', width: 100 },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '关联租约', dataIndex: 'lease_no', key: 'lease_no', width: 140 },
    {
      title: '欠费类型',
      dataIndex: 'arrears_type',
      key: 'arrears_type',
      width: 140,
      render: (v) =>
        ({
          rent_arrears: <Tag color="orange">租金欠费</Tag>,
          lease_expired_arrears: <Tag color="red">过期占用欠费</Tag>,
          other: <Tag>其他</Tag>
        })[v] || v
    },
    {
      title: '欠费金额',
      key: 'amount',
      width: 180,
      render: (_, r) => {
        const rem = r.amount - (r.settled_amount || 0);
        return (
          <div>
            <div style={{ fontWeight: 600 }}>¥{r.amount?.toFixed(2)}</div>
            <div style={{ fontSize: 12 }}>
              已缴 ¥{(r.settled_amount || 0).toFixed(2)} · 剩余{' '}
              <span style={{ color: rem > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
                ¥{rem.toFixed(2)}
              </span>
            </div>
          </div>
        );
      }
    },
    { title: '应缴日期', dataIndex: 'due_date', key: 'due_date', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) =>
        ({
          unsettled: <Tag color="red">未结清</Tag>,
          partial: <Tag color="orange">部分结清</Tag>,
          settled: <Tag color="green">已结清</Tag>
        })[v] || v
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, r) =>
        r.status !== 'settled' ? (
          <Button type="primary" size="small" onClick={() => handlePay(r)}>
            收款
          </Button>
        ) : (
          <Tag color="green">已处理</Tag>
        )
    }
  ];

  return (
    <div>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="欠费记录总数" value={stats.total_count} suffix="条" />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="未结清笔数"
                value={stats.unsettled_count}
                suffix="笔"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="未结清总金额"
                precision={2}
                prefix="¥"
                value={stats.unsettled_amount}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="已结清金额"
                precision={2}
                prefix="¥"
                value={stats.settled_amount}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <div className="action-bar">
        <Select
          placeholder="筛选欠费状态"
          allowClear
          style={{ width: 160 }}
          value={status}
          options={[
            { value: 'unsettled', label: '未结清' },
            { value: 'partial', label: '部分结清' },
            { value: 'settled', label: '已结清' }
          ]}
          onChange={(v) => setStatus(v)}
        />
      </div>

      <div className="table-card">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1400 }}
          expandable={{
            expandedRowRender: (r) => (
              <div style={{ padding: '0 24px', color: 'rgba(0,0,0,0.65)' }}>
                <strong>说明：</strong>
                {r.description}
              </div>
            )
          }}
        />
      </div>

      <Modal
        title={`欠费收款 · ${currentRec?.record_no || ''}`}
        open={payModal}
        onCancel={() => {
          setPayModal(false);
          setCurrentRec(null);
        }}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const res = await arrearsApi.pay(currentRec.id, { ...values, operator: '财务人员' });
            if (res?.code === 0) {
              Modal.success({
                title: '收款成功',
                content: (
                  <div>
                    <p>{res.message}</p>
                    {res.data?.has_other_arrears && (
                      <div className="warn-block warning">
                        <div className="warn-title">提示</div>
                        <div className="warn-msg">
                          该车主仍存在其他未结清欠费，续费流程仍将被拦截，请提醒车主结清全部欠费。
                        </div>
                      </div>
                    )}
                  </div>
                ),
                onOk: () => {
                  setPayModal(false);
                  loadData();
                }
              });
            }
          } catch (e) {}
        }}
      >
        {currentRec && (
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>车主</div>
                  <div style={{ fontWeight: 600 }}>{currentRec.tenant_name}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>车位</div>
                  <div>{currentRec.space_no || '—'}</div>
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>应缴总额</div>
                <div style={{ fontWeight: 600, color: '#1677ff' }}>¥{currentRec.amount?.toFixed(2)}</div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>待缴金额</div>
                <div style={{ fontWeight: 600, color: '#ff4d4f' }}>
                  ¥{(currentRec.amount - (currentRec.settled_amount || 0)).toFixed(2)}
                </div>
              </Col>
            </Row>
            <div style={{ margin: '16px 0', padding: 12, background: '#fafafa', borderRadius: 6, fontSize: 13 }}>
              {currentRec.description}
            </div>
            <Form.Item label="本次收款金额" name="amount" rules={[{ required: true }]}>
              <InputNumber
                min={0}
                max={currentRec.amount - (currentRec.settled_amount || 0)}
                step={10}
                style={{ width: '100%' }}
                prefix="¥"
              />
            </Form.Item>
            <Form.Item label="收款方式" name="payment_method" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'cash', label: '现金' },
                  { value: 'wechat', label: '微信（线下扫码）' },
                  { value: 'alipay', label: '支付宝（线下扫码）' },
                  { value: 'bank', label: '银行转账' },
                  { value: 'card', label: '刷卡' }
                ]}
              />
            </Form.Item>
            <Form.Item label="备注" name="remark">
              <Input.TextArea rows={2} placeholder="可选" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
