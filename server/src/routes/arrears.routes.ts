import { Router } from 'express';
import { ArrearsService } from '../services/arrears.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { tenant_id, status, lease_id, min_age, page, pageSize } = req.query;
  const result = ArrearsService.getAll({
    tenant_id: tenant_id as string,
    status: status as string,
    lease_id: lease_id as string,
    min_age: min_age ? parseInt(min_age as string) : undefined,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json(successResponse(result));
});

router.get('/stats/aging', (req, res) => {
  const result = ArrearsService.getAgingStats();
  res.json(successResponse(result));
});

router.get('/tenant/:tenantId/unpaid', (req, res) => {
  const result = ArrearsService.getUnpaidByTenant(req.params.tenantId);
  res.json(successResponse(result));
});

router.get('/lease/:leaseId', (req, res) => {
  const result = ArrearsService.getByLease(req.params.leaseId);
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = ArrearsService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('欠费记录不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  try {
    const result = ArrearsService.create(req.body);
    res.json(successResponse(result, '创建成功'));
  } catch (e: any) {
    res.json(errorResponse('创建失败', e.message));
  }
});

router.post('/:id/pay', (req, res) => {
  const { amount } = req.body;
  const result = ArrearsService.pay(req.params.id, amount);
  if (!result.success) {
    res.json(errorResponse(result.message || '支付失败'));
    return;
  }
  res.json(successResponse(result.arrears, '支付成功'));
});

router.post('/update-age', (req, res) => {
  const count = ArrearsService.updateAgeDays();
  res.json(successResponse({ updated: count }, '更新完成'));
});

router.delete('/:id', (req, res) => {
  const result = ArrearsService.delete(req.params.id);
  if (!result) {
    res.json(errorResponse('欠费记录不存在'));
    return;
  }
  res.json(successResponse(null, '删除成功'));
});

export default router;
