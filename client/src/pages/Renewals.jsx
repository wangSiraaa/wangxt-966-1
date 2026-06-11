import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Select,
  Space,
  Modal,
  Form,
  Input,
  message,
  App as AntdApp,
  Tag,
  Divider
} from 'antd';
import dayjs from 'dayjs';
import { renewalsApi } from '../api.js';

export default function RenewalsPage() {
  const { modal } = AntdApp.useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState();
  const [rejectModal, setRejectModal] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const res = await renewalsApi.list({ status });
    if (res?.code === 0) setList(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [status]);

  const handleApprove = async (row) => {
    modal.confirm({
      title: `确认通过续费申请？`,
      width: 560,
      content: (
        <div>
          <div className="warn-block info">
            <div className="warn-title">续费信息</div>
            <div className="warn-msg">
              车位「{row.space_no}」车主「{row.tenant_name}」申请续费 {row.months} 个月，
              新到期日 {row.new_end_date}，应收金额 ¥{row.renewal_amount?.toFixed(2)}
            </div>
          </div>
          <div style={{ marginTop: 12, color: 'rgba(0,0,0,0.65)', fontSize: 13 }}>
            审批通过后：系统将自动续期租约，并生成收款记录。
          </div>
        </div>
      ),
      okText: '确认通过并收款',
      okButtonProps: { type: 'primary' },
      onOk: async () => {
        const res = await renewalsApi.approve(row.id, { operator: '前台操作员' });
        if (res?.blocked) {
          if (res.block_type === 'UNSETTLED_ARREARS') {
            Modal.error({
              title: '审批被拦截 · 车主存在未结清欠费',
              content: (
                <div>
                  <div className="warn-block danger">
                    <div className="warn-title">⚠️ 欠费阻止了续费审批</div>
                    <div className="warn-msg">{res.message}</div>
                  </div>
                  {res.data?.arrears_list?.length > 0 && (
                    <div className="block-detail-list">
                      {res.data.arrears_list.map((a) => (
                        <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px dashed #f0f0f0' }}>
                          {a.record_no} · {a.space_no || '—'} · 未缴 ¥
                          {(a.amount - (a.settled_amount || 0)).toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            });
          } else if (res.block_type === 'SPACE_FROZEN') {
            Modal.error({
              title: '审批被拦截 · 车位已冻结',
              content: (
                <div className="warn-block danger">
                  <div className="warn-title">❄️ 车位已冻结</div>
                  <div className="warn-msg">{res.message}</div>
                </div>
              )
            });
          }
          return false;
        }
        if (res?.code === 0) {
          message.success('续费审批通过，租约已续期');
          loadData();
        }
        return true;
      }
    });
  };

  const handleReject = (row) => {
    setCurrentApp(row);
    form.setFieldsValue({ reject_reason: '' });
    setRejectModal(true);
  };

  const handleCancel = async (row) => {
    modal.confirm({
      title: '确认取消该续费申请？',
      onOk: async () => {
        const res = await renewalsApi.cancel(row.id);
        if (res?.code === 0) {
          message.success('已取消');
          loadData();
        }
      }
    });
  };

  const columns = [
    { title: '申请编号', dataIndex: 'application_no', key: 'application_no', width: 200 },
    { title: '车位', dataIndex: 'space_no', key: 'space_no', width: 100 },
    { title: '车主', dataIndex: 'tenant_name', key: 'tenant_name', width: 100 },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 130 },
    {
      title: '原租约到期',
      dataIndex: 'original_end',
      key: 'original_end',
      width: 120
    },
    {
      title: '续费',
      key: 'renewal',
      width: 160,
      render: (_, r) => (
        <div>
          <div>
            {r.months} 个月 · ¥{r.renewal_amount?.toFixed(2)}
          </div>
          <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: 12 }}>至 {r.new_end_date}</div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) =>
        ({
          pending: <Tag color="orange">待处理</Tag>,
          approved: <Tag color="green">已通过</Tag>,
          rejected: <Tag color="red">已驳回</Tag>,
          cancelled: <Tag color="default">已取消</Tag>
        })[v] || v
    },
    { title: '提交时间', dataIndex: 'submit_time', key: 'submit_time', width: 170 },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 200,
      render: (_, r) => (
        <Space>
          {r.status === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleApprove(r)}>
                通过
              </Button>
              <Button size="small" danger onClick={() => handleReject(r)}>
                驳回
              </Button>
              <Button size="small" onClick={() => handleCancel(r)}>
                取消
              </Button>
            </>
          )}
          {r.status === 'rejected' && (
            <div style={{ color: '#ff4d4f', fontSize: 12 }}>{r.reject_reason}</div>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="action-bar">
        <Select
          placeholder="筛选申请状态"
          allowClear
          style={{ width: 160 }}
          value={status}
          options={[
            { value: 'pending', label: '待处理' },
            { value: 'approved', label: '已通过' },
            { value: 'rejected', label: '已驳回' },
            { value: 'cancelled', label: '已取消' }
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
          scroll={{ x: 1300 }}
        />
      </div>

      <Modal
        title="驳回续费申请"
        open={rejectModal}
        onCancel={() => {
          setRejectModal(false);
          setCurrentApp(null);
        }}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const res = await renewalsApi.reject(currentApp.id, values);
            if (res?.code === 0) {
              message.success('已驳回');
              setRejectModal(false);
              loadData();
            }
          } catch (e) {}
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="驳回原因" name="reject_reason" rules={[{ required: true, message: '请填写驳回原因' }]}>
            <Input.TextArea rows={4} placeholder="请填写驳回原因，车主将可查看" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
