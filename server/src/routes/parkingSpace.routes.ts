import { Router } from 'express';
import { ParkingSpaceService } from '../services/parkingSpace.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { status, type, keyword } = req.query;
  const result = ParkingSpaceService.getAll({
    status: status as string,
    type: type as string,
    keyword: keyword as string,
  });
  res.json(successResponse(result));
});

router.get('/stats', (req, res) => {
  const stats = ParkingSpaceService.getPoolStats();
  res.json(successResponse(stats));
});

router.get('/available', (req, res) => {
  const result = ParkingSpaceService.getAvailableSpaces();
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = ParkingSpaceService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('车位不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  try {
    const result = ParkingSpaceService.create(req.body);
    res.json(successResponse(result, '创建成功'));
  } catch (e: any) {
    res.json(errorResponse('创建失败', e.message));
  }
});

router.put('/:id', (req, res) => {
  const result = ParkingSpaceService.update(req.params.id, req.body);
  if (!result) {
    res.json(errorResponse('车位不存在'));
    return;
  }
  res.json(successResponse(result, '更新成功'));
});

router.post('/:id/freeze', (req, res) => {
  const { reason } = req.body;
  const result = ParkingSpaceService.freeze(req.params.id, reason || '');
  if (!result) {
    res.json(errorResponse('车位不存在'));
    return;
  }
  res.json(successResponse(result, '冻结成功'));
});

router.post('/:id/unfreeze', (req, res) => {
  const result = ParkingSpaceService.unfreeze(req.params.id);
  if (!result) {
    res.json(errorResponse('车位不存在'));
    return;
  }
  res.json(successResponse(result, '解冻成功'));
});

router.post('/:id/lock', (req, res) => {
  const { lock_status } = req.body;
  const result = ParkingSpaceService.setLock(req.params.id, lock_status);
  if (!result) {
    res.json(errorResponse('车位不存在'));
    return;
  }
  res.json(successResponse(result, '车位锁状态更新成功'));
});

router.post('/:id/temp-occupied', (req, res) => {
  const { occupied } = req.body;
  const result = ParkingSpaceService.setTempOccupied(req.params.id, occupied);
  if (!result) {
    res.json(errorResponse('车位不存在'));
    return;
  }
  res.json(successResponse(result, '临停占用状态更新成功'));
});

router.delete('/:id', (req, res) => {
  const result = ParkingSpaceService.delete(req.params.id);
  if (!result) {
    res.json(errorResponse('车位不存在'));
    return;
  }
  res.json(successResponse(null, '删除成功'));
});

export default router;
