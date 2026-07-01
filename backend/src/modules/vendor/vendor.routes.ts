import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { vendorController } from '@/modules/vendor/vendor.controller';
import {
  createVendorSchema,
  updateVendorSchema,
  updateVendorStatusSchema,
  vendorListQuerySchema,
} from '@/modules/vendor/vendor.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();

router.use(authenticate);

// Vendor registration belongs ONLY to Department Users — Super Admin must never create,
// edit, or delete a vendor (read access is still open below, for the Dashboard vendor count).
router.post(
  '/',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ body: createVendorSchema }),
  vendorController.create,
);

// Directors (and any other role) have no standalone access to the Vendor module — a
// Director only ever sees vendor information embedded inside a submitted Quotation.
router.get(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.DEPARTMENT_USER),
  validate({ query: vendorListQuerySchema }),
  vendorController.list,
);

router.get(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  vendorController.getById,
);

router.patch(
  '/:id',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema(), body: updateVendorSchema }),
  vendorController.update,
);

router.patch(
  '/:id/status',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema(), body: updateVendorStatusSchema }),
  vendorController.setStatus,
);

router.delete(
  '/:id',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  vendorController.remove,
);

export default router;
