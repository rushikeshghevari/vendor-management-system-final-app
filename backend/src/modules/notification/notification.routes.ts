import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { notificationController } from '@/modules/notification/notification.controller';
import { notificationListQuerySchema } from '@/modules/notification/notification.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: notificationListQuerySchema }), notificationController.list);

router.get('/unread-count', notificationController.unreadCount);

router.patch('/read-all', notificationController.markAllRead);

router.patch('/:id/read', validate({ params: mongoIdParamSchema() }), notificationController.markRead);

export default router;
