import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { purchaseOrderController } from '@/modules/purchaseOrder/purchaseOrder.controller';
import { createPurchaseOrderSchema, poListQuerySchema } from '@/modules/purchaseOrder/purchaseOrder.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();
router.use(authenticate);

// Stats — must be before /:id to avoid "stats" being parsed as an id
router.get('/stats', purchaseOrderController.stats);

// Get PO by Quotation ID (used by mobile to check if PO exists for a quotation)
router.get(
  '/by-quotation/:quotationId',
  validate({ params: mongoIdParamSchema('quotationId') }),
  purchaseOrderController.getByQuotation,
);

router.get('/', validate({ query: poListQuerySchema }), purchaseOrderController.list);

// Department User and Super Admin can generate POs
router.post(
  '/',
  authorize(ROLES.DEPARTMENT_USER, ROLES.SUPER_ADMIN),
  validate({ body: createPurchaseOrderSchema }),
  purchaseOrderController.create,
);

router.get('/:id', validate({ params: mongoIdParamSchema() }), purchaseOrderController.getById);

// Accounts / Super Admin trigger AI verification on demand
router.post(
  '/:id/verify',
  authorize(ROLES.ACCOUNTS, ROLES.SUPER_ADMIN),
  validate({ params: mongoIdParamSchema() }),
  purchaseOrderController.triggerAiVerification,
);

// Download PO PDF
router.get(
  '/:id/pdf',
  validate({ params: mongoIdParamSchema() }),
  purchaseOrderController.downloadPdf,
);

export default router;
