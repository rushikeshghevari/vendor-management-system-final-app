import type { Request, Response } from 'express';

import { purchaseOrderService } from '@/modules/purchaseOrder/purchaseOrder.service';
import { generatePurchaseOrderPdf } from '@/services/pdf/pdf.service';
import { sendSuccess } from '@/utils/ApiResponse';
import { catchAsync } from '@/utils/catchAsync';

export const purchaseOrderController = {

  create: catchAsync(async (req: Request, res: Response) => {
    const po = await purchaseOrderService.create(req.body, req.user!);
    sendSuccess(res, po, 'Purchase Order generated successfully', 201);
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await purchaseOrderService.list(
      req.query as Record<string, unknown> as Parameters<typeof purchaseOrderService.list>[0],
      req.user!,
    );
    sendSuccess(res, items, 'Purchase Orders fetched', 200, meta);
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const po = await purchaseOrderService.getById(req.params.id as string, req.user!);
    sendSuccess(res, po, 'Purchase Order fetched');
  }),

  getByQuotation: catchAsync(async (req: Request, res: Response) => {
    const po = await purchaseOrderService.getByQuotation(req.params.quotationId as string, req.user!);
    sendSuccess(res, po, po ? 'Purchase Order fetched' : 'No Purchase Order found for this Quotation');
  }),

  triggerAiVerification: catchAsync(async (req: Request, res: Response) => {
    const po = await purchaseOrderService.triggerAiVerification(req.params.id as string, req.user!);
    sendSuccess(res, po, 'AI Verification completed');
  }),

  downloadPdf: catchAsync(async (req: Request, res: Response) => {
    const po = await purchaseOrderService.getById(req.params.id as string, req.user!);
    const { filePath, fileName } = await generatePurchaseOrderPdf(po);
    res.download(filePath, fileName);
  }),

  stats: catchAsync(async (req: Request, res: Response) => {
    const stats = await purchaseOrderService.getStats(req.user!);
    sendSuccess(res, stats, 'Purchase Order stats fetched');
  }),
};
