import { Router } from 'express';
import { PriceTierService } from '../services/priceTier.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { active_only } = req.query;
  const result = PriceTierService.getAll(active_only === 'true');
  res.json(successResponse(result));
});

router.get('/applicable/:months', (req, res) => {
  const months = parseInt(req.params.months);
  const result = PriceTierService.getApplicableTier(months);
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = PriceTierService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('阶梯价不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  try {
    const result = PriceTierService.create(req.body);
    res.json(successResponse(result, '创建成功'));
  } catch (e: any) {
    res.json(errorResponse('创建失败', e.message));
  }
});

router.put('/:id', (req, res) => {
  const result = PriceTierService.update(req.params.id, req.body);
  if (!result) {
    res.json(errorResponse('阶梯价不存在'));
    return;
  }
  res.json(successResponse(result, '更新成功'));
});

router.delete('/:id', (req, res) => {
  const result = PriceTierService.delete(req.params.id);
  if (!result) {
    res.json(errorResponse('阶梯价不存在'));
    return;
  }
  res.json(successResponse(null, '删除成功'));
});

export default router;
