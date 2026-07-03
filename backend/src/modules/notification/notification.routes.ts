import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { notificationController } from '@/modules/notification/notification.controller';
import {
  broadcastSchema,
  notificationListQuerySchema,
} from '@/modules/notification/notification.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();

router.use(authenticate);

router.get('/',            validate({ query: notificationListQuerySchema }), notificationController.list);
router.get('/unread-count',                                                  notificationController.unreadCount);
router.get('/analytics',   authorize(ROLES.SUPER_ADMIN),                     notificationController.analytics);

router.patch('/read-all',  notificationController.markAllRead);
router.delete('/all',      notificationController.deleteAll);

router.post(
  '/broadcast',
  authorize(ROLES.SUPER_ADMIN),
  validate({ body: broadcastSchema }),
  notificationController.broadcast,
);

router.patch('/:id/read',      validate({ params: mongoIdParamSchema() }), notificationController.markRead);
router.patch('/:id/archive',   validate({ params: mongoIdParamSchema() }), notificationController.archive);
router.patch('/:id/delivered', validate({ params: mongoIdParamSchema() }), notificationController.recordDelivery);
router.delete('/:id',          validate({ params: mongoIdParamSchema() }), notificationController.softDelete);

export default router;
