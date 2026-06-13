import { Router } from 'express';
import { FiscalPeriodService } from '../services/fiscalPeriod.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const result = FiscalPeriodService.getAll();
  res.json(successResponse(result));
});

router.get('/by-date/:date', (req, res) => {
  const result = FiscalPeriodService.getByDate(req.params.date);
  res.json(successResponse(result));
});

router.get('/is-closed/:date', (req, res) => {
  const closed = FiscalPeriodService.isPeriodClosed(req.params.date);
  res.json(successResponse({ date: req.params.date, is_closed: closed }));
});

router.get('/:id', (req, res) => {
  const result = FiscalPeriodService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('会计期间不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  try {
    const result = FiscalPeriodService.create(req.body);
    res.json(successResponse(result, '创建成功'));
  } catch (e: any) {
    res.json(errorResponse(e.message || '创建失败'));
  }
});

router.post('/:id/close', (req, res) => {
  const { closed_by } = req.body;
  try {
    const result = FiscalPeriodService.closePeriod(req.params.id, closed_by || 'admin');
    res.json(successResponse(result, '关账成功'));
  } catch (e: any) {
    res.json(errorResponse(e.message || '关账失败'));
  }
});

router.post('/:id/reopen', (req, res) => {
  try {
    const result = FiscalPeriodService.reopenPeriod(req.params.id);
    res.json(successResponse(result, '反关账成功'));
  } catch (e: any) {
    res.json(errorResponse(e.message || '反关账失败'));
  }
});

router.delete('/:id', (req, res) => {
  try {
    const result = FiscalPeriodService.delete(req.params.id);
    res.json(successResponse(null, result ? '删除成功' : '删除失败'));
  } catch (e: any) {
    res.json(errorResponse(e.message || '删除失败'));
  }
});

export default router;
