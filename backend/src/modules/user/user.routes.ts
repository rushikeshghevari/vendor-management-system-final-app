import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { userController } from '@/modules/user/user.controller';
import {
  changePasswordSchema,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  updateUserStatusSchema,
  userListQuerySchema,
} from '@/modules/user/user.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();

router.use(authenticate);

router.patch('/me/password', validate({ body: changePasswordSchema }), userController.changePassword);

router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN),
  validate({ body: createUserSchema }),
  userController.create,
);

router.get(
  '/',
  authorize(ROLES.SUPER_ADMIN),
  validate({ query: userListQuerySchema }),
  userController.list,
);

router.get(
  '/:id',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema() }),
  userController.getById,
);

router.put(
  '/:id',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema(), body: updateUserSchema }),
  userController.update,
);

router.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema(), body: updateUserSchema }),
  userController.update,
);

router.patch(
  '/:id/status',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema(), body: updateUserStatusSchema }),
  userController.setStatus,
);

router.patch(
  '/:id/reset-password',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema(), body: resetPasswordSchema }),
  userController.resetPassword,
);

router.delete(
  '/:id',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema() }),
  userController.deactivate,
);

export default router;
