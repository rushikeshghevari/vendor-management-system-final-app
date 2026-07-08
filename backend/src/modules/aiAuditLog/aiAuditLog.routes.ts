import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { mongoIdParamSchema } from '@/utils/commonValidation';
import { aiAuditLogController } from '@/modules/aiAuditLog/aiAuditLog.controller';

const router = Router();
router.use(authenticate);

// GET /ai-audit-logs — Super Admin only: full list with pagination + filters
router.get('/', authorize(ROLES.SUPER_ADMIN), aiAuditLogController.list);

// GET /ai-audit-logs/po/:purchaseOrderId — Accounts + Super Admin
router.get(
  '/po/:purchaseOrderId',
  authorize(ROLES.ACCOUNTS, ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema('purchaseOrderId') }),
  aiAuditLogController.listByPurchaseOrder,
);

export default router;
