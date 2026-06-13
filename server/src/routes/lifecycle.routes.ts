import { Router } from 'express';
import { LifecycleService } from '../services/lifecycle.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/space/:spaceId', (req, res) => {
  const result = LifecycleService.getSpaceLifecycle(req.params.spaceId);
  res.json(successResponse(result));
});

router.get('/space/:spaceId/full', (req, res) => {
  const result = LifecycleService.getSpaceFullLifecycle(req.params.spaceId);
  if (!result) {
    res.json(errorResponse('车位不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.get('/space/:spaceId/lock-anomaly', (req, res) => {
  const result = LifecycleService.detectLockAnomaly(req.params.spaceId);
  res.json(successResponse(result));
});

router.get('/tenant/:tenantId/family-merge', (req, res) => {
  const result = LifecycleService.detectFamilyMultiCarMerge(req.params.tenantId);
  res.json(successResponse(result));
});

router.post('/batch-conflict-check', (req, res) => {
  const { lease_ids } = req.body;
  const result = LifecycleService.checkBatchRenewalConflicts(lease_ids || []);
  res.json(successResponse(result));
});

router.post('/validate/renew/:leaseId', (req, res) => {
  const result = LifecycleService.validateForRenew(req.params.leaseId);
  res.json(successResponse(result));
});

router.post('/validate/terminate/:leaseId', (req, res) => {
  const result = LifecycleService.validateForTerminate(req.params.leaseId);
  res.json(successResponse(result));
});

router.post('/validate/swap/:leaseId', (req, res) => {
  const { new_space_id } = req.body;
  if (!new_space_id) {
    res.json(errorResponse('请指定目标车位'));
    return;
  }
  const result = LifecycleService.validateForSwap(req.params.leaseId, new_space_id);
  res.json(successResponse(result));
});

router.post('/validate/plate-change/:leaseId', (req, res) => {
  const { new_plate_no } = req.body;
  if (!new_plate_no) {
    res.json(errorResponse('请指定新车牌号'));
    return;
  }
  const result = LifecycleService.validateForPlateChange(req.params.leaseId, new_plate_no);
  res.json(successResponse(result));
});

router.post('/plate-change/:leaseId', (req, res) => {
  const { new_plate_no, reason, operator } = req.body;
  if (!new_plate_no) {
    res.json(errorResponse('请指定新车牌号'));
    return;
  }
  const result = LifecycleService.changePlate(req.params.leaseId, new_plate_no, reason, operator);
  if (!result.success) {
    res.json(errorResponse(result.message || '更换车牌失败'));
    return;
  }
  res.json(successResponse(result.plateChangeLog, '车牌更换成功'));
});

export default router;
