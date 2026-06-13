import { Router } from 'express';
import { SpaceSwapService } from '../services/spaceSwap.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { status, tenant_id, lease_id, page, pageSize } = req.query;
  const result = SpaceSwapService.getAll({
    status: status as string,
    tenant_id: tenant_id as string,
    lease_id: lease_id as string,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = SpaceSwapService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('调换申请不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.get('/:id/detail', (req, res) => {
  const result = SpaceSwapService.getDetail(req.params.id);
  if (!result) {
    res.json(errorResponse('调换申请不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  const result = SpaceSwapService.create(req.body);
  if (!result.success) {
    res.json(errorResponse(result.message || '申请失败'));
    return;
  }
  res.json(successResponse(result.swap, '申请成功'));
});

router.post('/:id/approve', (req, res) => {
  const { approver, remark } = req.body;
  const result = SpaceSwapService.approve(req.params.id, approver || 'admin', remark);
  if (!result.success) {
    res.json(errorResponse(result.message || '审批失败'));
    return;
  }
  res.json(successResponse(result.swap, '审批通过'));
});

router.post('/:id/reject', (req, res) => {
  const { approver, remark } = req.body;
  const result = SpaceSwapService.reject(req.params.id, approver || 'admin', remark);
  if (!result.success) {
    res.json(errorResponse(result.message || '驳回失败'));
    return;
  }
  res.json(successResponse(result.swap, '已驳回'));
});

router.delete('/:id', (req, res) => {
  const result = SpaceSwapService.delete(req.params.id);
  if (!result) {
    res.json(errorResponse('调换申请不存在'));
    return;
  }
  res.json(successResponse(null, '删除成功'));
});

export default router;
