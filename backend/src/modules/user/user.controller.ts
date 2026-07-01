import type { Request, Response } from 'express';

import { userService } from '@/modules/user/user.service';
import { sendSuccess } from '@/utils/ApiResponse';
import { catchAsync } from '@/utils/catchAsync';

export const userController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const user = await userService.create(req.body);
    sendSuccess(res, user, 'User created', 201);
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await userService.list(req.query as Record<string, unknown>);
    sendSuccess(res, items, 'Users fetched', 200, meta);
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const user = await userService.getById(req.params.id as string);
    sendSuccess(res, user, 'User fetched');
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const user = await userService.update(req.params.id as string, req.body);
    sendSuccess(res, user, 'User updated');
  }),

  setStatus: catchAsync(async (req: Request, res: Response) => {
    const user = await userService.setStatus(req.params.id as string, req.body.isActive);
    sendSuccess(res, user, 'User status updated');
  }),

  deactivate: catchAsync(async (req: Request, res: Response) => {
    await userService.deactivate(req.params.id as string);
    sendSuccess(res, null, 'User deactivated');
  }),

  changePassword: catchAsync(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user!.id, currentPassword, newPassword);
    sendSuccess(res, null, 'Password updated');
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    await userService.resetPassword(req.params.id as string, req.body.newPassword);
    sendSuccess(res, null, 'Password reset');
  }),
};
