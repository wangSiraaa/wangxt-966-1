import { Router } from 'express';
import { InvoiceService } from '../services/invoice.service';
import { successResponse, errorResponse } from '../utils';

const router = Router();

router.get('/', (req, res) => {
  const { tenant_id, lease_id, status, page, pageSize } = req.query;
  const result = InvoiceService.getAll({
    tenant_id: tenant_id as string,
    lease_id: lease_id as string,
    status: status as string,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json(successResponse(result));
});

router.get('/:id', (req, res) => {
  const result = InvoiceService.getById(req.params.id);
  if (!result) {
    res.json(errorResponse('发票不存在'));
    return;
  }
  res.json(successResponse(result));
});

router.post('/', (req, res) => {
  try {
    const result = InvoiceService.create(req.body);
    res.json(successResponse(result, '创建成功'));
  } catch (e: any) {
    res.json(errorResponse('创建失败', e.message));
  }
});

router.post('/:id/issue', (req, res) => {
  const result = InvoiceService.issue(req.params.id);
  if (!result) {
    res.json(errorResponse('发票不存在或状态不正确'));
    return;
  }
  res.json(successResponse(result, '开票成功'));
});

router.post('/:id/cancel', (req, res) => {
  const result = InvoiceService.cancel(req.params.id);
  if (!result) {
    res.json(errorResponse('发票不存在或状态不正确'));
    return;
  }
  res.json(successResponse(result, '作废成功'));
});

router.delete('/:id', (req, res) => {
  const result = InvoiceService.delete(req.params.id);
  if (!result) {
    res.json(errorResponse('发票不存在'));
    return;
  }
  res.json(successResponse(null, '删除成功'));
});

export default router;
