import { Router } from 'express';
import { VehicleService } from '../services/vehicle.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { tenant_id, plate_no, is_family } = req.query;
  const result = VehicleService.getAll({
    tenant_id: tenant_id as string,
    plate_no: plate_no as string,
    is_family: is_family === 'true' ? true : is_family === 'false' ? false : undefined,
  });
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = VehicleService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('车辆不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.get('/plate/:plateNo', (req, res) => {
  const result = VehicleService.getByPlateNo(req.params.plateNo);
  if (!result) {
    res.json(errorResponse('车辆不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.get('/:id/tenant', (req, res) => {
  const result = VehicleService.getTenant(req.params.id);
  if (!result) {
    res.json(errorResponse('租户不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  try {
    const result = VehicleService.create(req.body);
    res.json(successResponse(result, '添加成功'));
  } catch (e: any) {
    res.json(errorResponse('添加失败', e.message));
  }
});

router.put('/:id', (req, res) => {
  const result = VehicleService.update(req.params.id, req.body);
  if (!result) {
    res.json(errorResponse('车辆不存在'));
    return;
  }
  res.json(successResponse(result, '更新成功'));
});

router.post('/:id/whitelist', (req, res) => {
  const { whitelisted } = req.body;
  const result = VehicleService.setWhitelist(req.params.id, whitelisted);
  if (!result) {
    res.json(errorResponse('车辆不存在'));
    return;
  }
  res.json(successResponse(result, '白名单状态更新成功'));
});

router.post('/:id/family', (req, res) => {
  const { is_family } = req.body;
  const result = VehicleService.setFamily(req.params.id, is_family);
  if (!result) {
    res.json(errorResponse('车辆不存在'));
    return;
  }
  res.json(successResponse(result, '家庭车辆状态更新成功'));
});

router.delete('/:id', (req, res) => {
  const result = VehicleService.delete(req.params.id);
  if (!result) {
    res.json(errorResponse('车辆不存在'));
    return;
  }
  res.json(successResponse(null, '删除成功'));
});

export default router;
