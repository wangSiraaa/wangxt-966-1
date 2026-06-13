import { Router } from 'express';
import { AuditLogService } from '../services/auditLog.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { module, action, operator, start_date, end_date, page, pageSize } = req.query;
  const result = AuditLogService.getAll({
    module: module as string,
    action: action as string,
    operator: operator as string,
    start_date: start_date as string,
    end_date: end_date as string,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json(successResponse(result));
});

router.get('/stats', (req, res) => {
  const result = AuditLogService.getStats();
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = AuditLogService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('日志不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.get('/module/:module', (req, res) => {
  const { limit } = req.query;
  const result = AuditLogService.getByModule(
    req.params.module,
    limit ? parseInt(limit as string) : 50
  );
  res.json(successResponse(result));
});

router.get('/target/:targetId', (req, res) => {
  const { limit } = req.query;
  const result = AuditLogService.getByTarget(
    req.params.targetId,
    limit ? parseInt(limit as string) : 50
  );
  res.json(successResponse(result));
});

export default router;
