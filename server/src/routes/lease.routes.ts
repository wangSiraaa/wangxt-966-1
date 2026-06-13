import { Router } from 'express';
import { LeaseService } from '../services/lease.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { status, tenant_id, space_id, keyword, page, pageSize } = req.query;
  const result = LeaseService.getAll({
    status: status as string,
    tenant_id: tenant_id as string,
    space_id: space_id as string,
    keyword: keyword as string,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json(successResponse(result));
});

router.get('/expiring-soon', (req, res) => {
  const { days } = req.query;
  const result = LeaseService.getExpiringSoon(days ? parseInt(days as string) : 30);
  res.json(successResponse(result));
});

router.get('/expired', (req, res) => {
  const result = LeaseService.getExpiredLeases();
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = LeaseService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('租约不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.get('/:id/detail', (req, res) => {
  const result = LeaseService.getDetail(req.params.id);
  if (!result) {
    res.json(errorResponse('租约不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.get('/:id/timeline', (req, res) => {
  const result = LeaseService.getTimeline(req.params.id);
  res.json(successResponse(result));
});

router.get('/:id/can-renew', (req, res) => {
  const result = LeaseService.canRenew(req.params.id);
  res.json(successResponse(result));
});

router.get('/:id/renewal-price', (req, res) => {
  const { months } = req.query;
  const result = LeaseService.calculateRenewalPrice(
    req.params.id,
    months ? parseInt(months as string) : 1
  );
  res.json(successResponse(result));
});

router.get('/:id/refund', (req, res) => {
  const result = LeaseService.calculateRefund(req.params.id);
  res.json(successResponse(result));
});

router.get('/space/:spaceId/active', (req, res) => {
  const result = LeaseService.getActiveLeaseBySpace(req.params.spaceId);
  res.json(successResponse(result));
});

router.get('/tenant/:tenantId/active', (req, res) => {
  const result = LeaseService.getActiveLeaseByTenant(req.params.tenantId);
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  const result = LeaseService.create(req.body);
  if (!result.success) {
    res.json(errorResponse(result.message || '创建失败'));
    return;
  }
  res.json(successResponse(result.lease, '创建成功'));
});

router.post('/:id/renew', (req, res) => {
  const { months } = req.body;
  const result = LeaseService.renew(req.params.id, months || 1);
  if (!result.success) {
    res.json(errorResponse(result.message || '续费失败'));
    return;
  }
  res.json(successResponse(result.lease, '续费成功'));
});

router.post('/batch-renew', (req, res) => {
  const { lease_ids, months } = req.body;
  const result = LeaseService.batchRenew(lease_ids || [], months || 1);
  res.json(successResponse(result));
});

router.post('/:id/confirm', (req, res) => {
  const result = LeaseService.confirmContract(req.params.id);
  if (!result.success) {
    res.json(errorResponse(result.message || '确认失败'));
    return;
  }
  res.json(successResponse(result.lease, '合同确认成功'));
});

router.post('/:id/cancel', (req, res) => {
  const { reason } = req.body;
  const result = LeaseService.cancelLease(req.params.id, reason);
  if (!result.success) {
    res.json(errorResponse(result.message || '取消失败'));
    return;
  }
  res.json(successResponse(result.lease, '取消成功'));
});

router.post('/:id/terminate', (req, res) => {
  const { reason } = req.body;
  const result = LeaseService.terminateLease(req.params.id, reason);
  if (!result.success) {
    res.json(errorResponse(result.message || '退租失败'));
    return;
  }
  res.json(successResponse({ refund_amount: result.refundAmount }, '退租成功'));
});

router.post('/process-expired', (req, res) => {
  const result = LeaseService.processExpiredLeases();
  res.json(successResponse(result, '处理完成'));
});

export default router;
