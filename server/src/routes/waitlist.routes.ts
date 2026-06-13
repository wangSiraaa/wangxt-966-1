import { Router } from 'express';
import { WaitlistService } from '../services/waitlist.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { status, tenant_id, page, pageSize } = req.query;
  const result = WaitlistService.getAll({
    status: status as string,
    tenant_id: tenant_id as string,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json(successResponse(result));
});

router.get('/waiting', (req, res) => {
  const result = WaitlistService.getWaitingList();
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = WaitlistService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('候补记录不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  try {
    const result = WaitlistService.create(req.body);
    res.json(successResponse(result, '加入候补成功'));
  } catch (e: any) {
    res.json(errorResponse(e.message || '加入候补失败'));
  }
});

router.post('/:id/cancel', (req, res) => {
  const result = WaitlistService.cancel(req.params.id);
  if (!result) {
    res.json(errorResponse('取消失败'));
    return;
  }
  res.json(successResponse(result, '已取消候补'));
});

router.post('/:id/assign', (req, res) => {
  const { space_id } = req.body;
  if (!space_id) {
    res.json(errorResponse('请指定车位'));
    return;
  }
  try {
    const result = WaitlistService.assignSpace(req.params.id, space_id);
    if (!result.success) {
      res.json(errorResponse(result.message || '分配失败'));
      return;
    }
    res.json(successResponse(result, '候补转正成功'));
  } catch (e: any) {
    res.json(errorResponse(e.message || '分配失败'));
  }
});

router.post('/auto-assign', (req, res) => {
  try {
    const count = WaitlistService.autoAssign();
    res.json(successResponse({ assigned_count: count }, `自动分配 ${count} 个车位`));
  } catch (e: any) {
    res.json(errorResponse(e.message || '自动分配失败'));
  }
});

router.delete('/:id', (req, res) => {
  const result = WaitlistService.delete(req.params.id);
  res.json(successResponse(null, result ? '删除成功' : '删除失败'));
});

export default router;
