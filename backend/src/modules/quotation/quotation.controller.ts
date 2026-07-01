import type { Request, Response } from 'express';

import { quotationService } from '@/modules/quotation/quotation.service';
import { ApiError } from '@/utils/ApiError';
import { sendSuccess } from '@/utils/ApiResponse';
import { catchAsync } from '@/utils/catchAsync';

export const quotationController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const quotation = await quotationService.create(req.body, req.user!);
    sendSuccess(res, quotation, 'Quotation created', 201);
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await quotationService.list(req.query as Record<string, unknown>, req.user!);
    sendSuccess(res, items, 'Quotations fetched', 200, meta);
  }),

  directorStats: catchAsync(async (req: Request, res: Response) => {
    const stats = await quotationService.getDirectorStats(req.user!);
    sendSuccess(res, stats, 'Director dashboard stats fetched');
  }),

  ceoStats: catchAsync(async (req: Request, res: Response) => {
    const stats = await quotationService.getCeoStats(req.user!);
    sendSuccess(res, stats, 'CEO dashboard stats fetched');
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const quotation = await quotationService.getById(req.params.id as string, req.user!);
    sendSuccess(res, quotation, 'Quotation fetched');
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const quotation = await quotationService.update(req.params.id as string, req.body, req.user!);
    sendSuccess(res, quotation, 'Quotation updated');
  }),

  submit: catchAsync(async (req: Request, res: Response) => {
    const quotation = await quotationService.submit(req.params.id as string, req.user!);
    sendSuccess(res, quotation, 'Quotation submitted');
  }),

  resubmit: catchAsync(async (req: Request, res: Response) => {
    const quotation = await quotationService.resubmit(req.params.id as string, req.user!);
    sendSuccess(res, quotation, 'Quotation resubmitted');
  }),

  decide: catchAsync(async (req: Request, res: Response) => {
    const quotation = await quotationService.decide(req.params.id as string, req.body, req.user!);
    sendSuccess(res, quotation, 'Decision recorded');
  }),

  uploadPdf: catchAsync(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('A PDF file is required');
    const url = `/uploads/quotations/${req.file.filename}`;
    const quotation = await quotationService.uploadPdf(
      req.params.id as string,
      req.file.originalname,
      url,
      req.user!,
    );
    sendSuccess(res, quotation, 'PDF uploaded');
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await quotationService.remove(req.params.id as string, req.user!);
    sendSuccess(res, null, 'Quotation deleted');
  }),
};
