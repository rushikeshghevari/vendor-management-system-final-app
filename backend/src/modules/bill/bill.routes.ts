import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { uploadBillInvoice, uploadBillSupportingDocument } from '@/middleware/billUpload.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { billController } from '@/modules/bill/bill.controller';
import {
  billFinancialDecisionSchema,
  billDecisionSchema,
  billListQuerySchema,
  billPaymentStatusSchema,
  createBillSchema,
  updateBillSchema,
} from '@/modules/bill/bill.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();

router.use(authenticate);

router.post('/', authorize(ROLES.DEPARTMENT_USER), validate({ body: createBillSchema }), billController.create);

router.get('/', validate({ query: billListQuerySchema }), billController.list);

// Must be registered before the `/:id` route below, or "stats" would be parsed as an id.
router.get('/stats/accounts', authorize(ROLES.ACCOUNTS), billController.accountsStats);
router.get('/stats/payment', authorize(ROLES.PAYMENT_DEPARTMENT), billController.paymentStats);
router.get('/stats/director', authorize(ROLES.DIRECTOR), billController.directorStats);

router.get('/:id', validate({ params: mongoIdParamSchema() }), billController.getById);

router.patch(
  '/:id',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema(), body: updateBillSchema }),
  billController.update,
);

router.patch(
  '/:id/submit',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  billController.submit,
);

router.patch(
  '/:id/resubmit',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  billController.resubmit,
);

// Accounts-only — backend support for the next phase; no mobile UI yet.
router.patch(
  '/:id/decision',
  authorize(ROLES.ACCOUNTS),
  validate({ params: mongoIdParamSchema(), body: billDecisionSchema }),
  billController.decide,
);

// Director Financial Approval (Approval 2 — after 3-Way AI, before Accounts).
router.patch(
  '/:id/financial-decision',
  authorize(ROLES.DIRECTOR),
  validate({ params: mongoIdParamSchema(), body: billFinancialDecisionSchema }),
  billController.decideFinancialApproval,
);

// Payment Department-only — backend support for the future Payment module; no mobile UI yet.
router.patch(
  '/:id/payment-status',
  authorize(ROLES.PAYMENT_DEPARTMENT),
  validate({ params: mongoIdParamSchema(), body: billPaymentStatusSchema }),
  billController.updatePaymentStatus,
);

router.post(
  '/:id/invoice',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  uploadBillInvoice,
  billController.uploadInvoice,
);

router.post(
  '/:id/supporting-documents',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  uploadBillSupportingDocument,
  billController.uploadSupportingDocument,
);

router.delete('/:id', authorize(ROLES.DEPARTMENT_USER), validate({ params: mongoIdParamSchema() }), billController.remove);

export default router;
