import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { departmentController } from '@/modules/department/department.controller';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  updateDepartmentStatusSchema,
} from '@/modules/department/department.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN),
  validate({ body: createDepartmentSchema }),
  departmentController.create,
);

router.get('/', departmentController.list);

router.get('/:id', validate({ params: mongoIdParamSchema() }), departmentController.getById);

router.put(
  '/:id',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema(), body: updateDepartmentSchema }),
  departmentController.update,
);

router.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema(), body: updateDepartmentSchema }),
  departmentController.update,
);

router.patch(
  '/:id/status',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema(), body: updateDepartmentStatusSchema }),
  departmentController.setStatus,
);

router.delete(
  '/:id',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema() }),
  departmentController.remove,
);

export default router;
