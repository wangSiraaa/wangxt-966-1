import { Router } from 'express';
import { AdjustmentOrderService } from '../services/adjustmentOrder.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { lease_id, order_type, status, page, pageSize } = req.query;
  const result = AdjustmentOrderService.getAll({
    lease_id: lease_id as string,
    order_type: order_type as string,
    status: status as string,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json(successResponse(result));
});

router.get('/lease/:leaseId', (req, res) => {
  const result = AdjustmentOrderService.getByLease(req.params.leaseId);
  res.json(successResponse(result));
});

router.get('/period/:periodId/pending', (req, res) => {
  const result = AdjustmentOrderService.getPendingByPeriod(req.params.periodId);
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = AdjustmentOrderService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('调整单不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  try {
    const result = AdjustmentOrderService.create(req.body);
    res.json(successResponse(result, '创建成功'));
  } catch (e: any) {
    res.json(errorResponse(e.message || '创建失败'));
  }
});

router.post('/:id/approve', (req, res) => {
  const { approved_by, remark } = req.body;
  const result = AdjustmentOrderService.approve(req.params.id, approved_by || 'admin', remark);
  if (!result) {
    res.json(errorResponse('审批失败'));
    return;
  }
  res.json(successResponse(result, '审批通过'));
});

router.post('/:id/reject', (req, res) => {
  const { approved_by, remark } = req.body;
  const result = AdjustmentOrderService.reject(req.params.id, approved_by || 'admin', remark);
  if (!result) {
    res.json(errorResponse('驳回失败'));
    return;
  }
  res.json(successResponse(result, '已驳回'));
});

router.post('/:id/complete', (req, res) => {
  const result = AdjustmentOrderService.complete(req.params.id);
  if (!result) {
    res.json(errorResponse('完成失败'));
    return;
  }
  res.json(successResponse(result, '已完成'));
});

router.delete('/:id', (req, res) => {
  const result = AdjustmentOrderService.delete(req.params.id);
  res.json(successResponse(null, result ? '删除成功' : '删除失败'));
});

export default router;
