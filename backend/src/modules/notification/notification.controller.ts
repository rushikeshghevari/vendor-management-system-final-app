import type { Request, Response } from 'express';

import { notificationService } from '@/modules/notification/notification.service';
import { sendSuccess } from '@/utils/ApiResponse';
import { catchAsync } from '@/utils/catchAsync';

export const notificationController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await notificationService.list(req.query as Record<string, unknown>, req.user!);
    sendSuccess(res, items, 'Notifications fetched', 200, meta);
  }),

  unreadCount: catchAsync(async (req: Request, res: Response) => {
    const result = await notificationService.getUnreadCount(req.user!);
    sendSuccess(res, result, 'Unread notification count fetched');
  }),

  markRead: catchAsync(async (req: Request, res: Response) => {
    const notification = await notificationService.markRead(req.params.id as string, req.user!);
    sendSuccess(res, notification, 'Notification marked as read');
  }),

  markAllRead: catchAsync(async (req: Request, res: Response) => {
    await notificationService.markAllRead(req.user!);
    sendSuccess(res, null, 'All notifications marked as read');
  }),
};
