import type { Request, Response } from 'express';

import { departmentService } from '@/modules/department/department.service';
import { sendSuccess } from '@/utils/ApiResponse';
import { catchAsync } from '@/utils/catchAsync';

export const departmentController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const department = await departmentService.create(req.body, req.user!.id);
    sendSuccess(res, department, 'Department created', 201);
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await departmentService.list(req.query as Record<string, unknown>);
    sendSuccess(res, items, 'Departments fetched', 200, meta);
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const department = await departmentService.getById(req.params.id as string);
    sendSuccess(res, department, 'Department fetched');
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const department = await departmentService.update(req.params.id as string, req.body);
    sendSuccess(res, department, 'Department updated');
  }),

  setStatus: catchAsync(async (req: Request, res: Response) => {
    const department = await departmentService.update(req.params.id as string, { isActive: req.body.isActive });
    sendSuccess(res, department, 'Department status updated');
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await departmentService.remove(req.params.id as string);
    sendSuccess(res, null, 'Department deactivated');
  }),
};
