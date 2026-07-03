import type { Request, Response } from 'express';

import { userService } from '@/modules/user/user.service';
import { User } from '@/modules/user/user.model';
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

  registerDevice: catchAsync(async (req: Request, res: Response) => {
    const { token, deviceId, platform, deviceName } = req.body as {
      token: string; deviceId: string; platform: 'android' | 'ios' | 'web'; deviceName?: string;
    };
    const userId = req.user!.id;

    await User.findByIdAndUpdate(
      userId,
      {
        // Remove any existing entry for this deviceId, then push the new one
        $pull: { fcmTokens: { deviceId } },
      },
    );

    await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          fcmTokens: {
            token,
            deviceId,
            platform,
            deviceName,
            lastUsed: new Date(),
            isActive: true,
          },
        },
      },
    );

    sendSuccess(res, null, 'Device registered');
  }),

  removeDevice: catchAsync(async (req: Request, res: Response) => {
    const { deviceId } = req.body as { deviceId: string };
    await User.findByIdAndUpdate(req.user!.id, { $pull: { fcmTokens: { deviceId } } });
    sendSuccess(res, null, 'Device removed');
  }),

  myDevices: catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id).select('fcmTokens').lean();
    sendSuccess(res, user?.fcmTokens ?? [], 'Devices fetched');
  }),
};
