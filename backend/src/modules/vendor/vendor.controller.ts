import type { Request, Response } from 'express';

import { vendorService } from '@/modules/vendor/vendor.service';
import { sendSuccess } from '@/utils/ApiResponse';
import { catchAsync } from '@/utils/catchAsync';

export const vendorController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorService.create(req.body, req.user!);
    sendSuccess(res, vendor, 'Vendor created', 201);
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await vendorService.list(req.query as Record<string, unknown>, req.user!);
    sendSuccess(res, items, 'Vendors fetched', 200, meta);
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorService.getById(req.params.id as string, req.user!);
    sendSuccess(res, vendor, 'Vendor fetched');
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorService.update(req.params.id as string, req.body, req.user!);
    sendSuccess(res, vendor, 'Vendor updated');
  }),

  setStatus: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorService.setStatus(req.params.id as string, req.body.status, req.user!);
    sendSuccess(res, vendor, 'Vendor status updated');
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await vendorService.remove(req.params.id as string, req.user!);
    sendSuccess(res, null, 'Vendor deactivated');
  }),
};
