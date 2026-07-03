import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { auditLogController } from '@/modules/auditLog/auditLog.controller';
import { createAuditLogSchema } from '@/modules/auditLog/auditLog.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();
router.use(authenticate);
router.use(authorize(ROLES.ACCOUNTS, ROLES.SUPER_ADMIN));

router.post('/', validate({ body: createAuditLogSchema }), auditLogController.create);
router.get('/', auditLogController.list);
router.get(
  '/by-po/:purchaseOrderId',
  validate({ params: mongoIdParamSchema('purchaseOrderId') }),
  auditLogController.listByPurchaseOrder,
);

export default router;
