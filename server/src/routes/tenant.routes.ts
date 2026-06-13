import { Router } from 'express';
import { TenantService } from '../services/tenant.service';
import { VehicleService } from '../services/vehicle.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { keyword, blacklisted } = req.query;
  const result = TenantService.getAll({
    keyword: keyword as string,
    blacklisted: blacklisted === 'true' ? true : blacklisted === 'false' ? false : undefined,
  });
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = TenantService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('租户不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.get('/:id/vehicles', (req, res) => {
  const result = TenantService.getVehicles(req.params.id);
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  try {
    const result = TenantService.create(req.body);
    res.json(successResponse(result, '创建成功'));
  } catch (e: any) {
    res.json(errorResponse('创建失败', e.message));
  }
});

router.put('/:id', (req, res) => {
  const result = TenantService.update(req.params.id, req.body);
  if (!result) {
    res.json(errorResponse('租户不存在'));
    return;
  }
  res.json(successResponse(result, '更新成功'));
});

router.post('/:id/blacklist', (req, res) => {
  const { reason } = req.body;
  const result = TenantService.addToBlacklist(req.params.id, reason || '');
  if (!result) {
    res.json(errorResponse('租户不存在'));
    return;
  }
  res.json(successResponse(result, '已加入黑名单'));
});

router.post('/:id/unblacklist', (req, res) => {
  const result = TenantService.removeFromBlacklist(req.params.id);
  if (!result) {
    res.json(errorResponse('租户不存在'));
    return;
  }
  res.json(successResponse(result, '已移出黑名单'));
});

router.delete('/:id', (req, res) => {
  const result = TenantService.delete(req.params.id);
  if (!result) {
    res.json(errorResponse('租户不存在'));
    return;
  }
  res.json(successResponse(null, '删除成功'));
});

export default router;
