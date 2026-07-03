import type { Request, Response } from 'express';

import { userService } from '@/modules/user/user.service';
import { User } from '@/modules/user/user.model';
import { roleTopic, deptTopic, subscribeToTopic, unsubscribeFromAllTopics } from '@/services/push/topicManager.service';
import { sendSuccess } from '@/utils/ApiResponse';
import { catchAsync } from '@/utils/catchAsync';
import type { Role } from '@/constants/roles';

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
    const role   = req.user!.role as Role;

    // Remove stale entry for this deviceId before re-registering
    await User.findByIdAndUpdate(userId, { $pull: { fcmTokens: { deviceId } } });
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          fcmTokens: {
            token, deviceId, platform, deviceName,
            lastUsed: new Date(),
            isActive: true,
          },
        },
      },
      { new: true },
    ).lean();

    // Subscribe to role + all_users topics; department topic if applicable
    const departmentId = updated?.department?.toString();
    subscribeToTopic([token], roleTopic(role)).catch(() => null);
    subscribeToTopic([token], 'all_users').catch(() => null);
    if (departmentId) subscribeToTopic([token], deptTopic(departmentId)).catch(() => null);

    sendSuccess(res, null, 'Device registered');
  }),

  removeDevice: catchAsync(async (req: Request, res: Response) => {
    const { deviceId } = req.body as { deviceId: string };
    const userId = req.user!.id;
    const role   = req.user!.role as Role;

    // Find the token before pulling so we can unsubscribe from FCM topics
    const userDoc = await User.findById(userId).select('fcmTokens department').lean();
    const entry   = userDoc?.fcmTokens?.find((t) => t.deviceId === deviceId);

    await User.findByIdAndUpdate(userId, { $pull: { fcmTokens: { deviceId } } });

    if (entry?.token) {
      const departmentId = userDoc?.department?.toString();
      unsubscribeFromAllTopics([entry.token], role, departmentId).catch(() => null);
    }

    sendSuccess(res, null, 'Device removed');
  }),

  myDevices: catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id).select('fcmTokens').lean();
    sendSuccess(res, user?.fcmTokens ?? [], 'Devices fetched');
  }),
};
