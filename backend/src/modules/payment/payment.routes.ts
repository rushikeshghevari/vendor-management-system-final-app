import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { paymentController } from '@/modules/payment/payment.controller';
import {
  createPaymentSchema,
  markFailedSchema,
  markPaidSchema,
  paymentListQuerySchema,
  startProcessingSchema,
} from '@/modules/payment/payment.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();

router.use(authenticate);

router.post('/', authorize(ROLES.PAYMENT_DEPARTMENT), validate({ body: createPaymentSchema }), paymentController.create);

router.get(
  '/',
  authorize(ROLES.PAYMENT_DEPARTMENT, ROLES.ACCOUNTS, ROLES.SUPER_ADMIN, ROLES.DEPARTMENT_USER),
  validate({ query: paymentListQuerySchema }),
  paymentController.list,
);

// Must be registered before the `/:id` route below, or these would be parsed as an id.
router.get('/stats/payment-department', authorize(ROLES.PAYMENT_DEPARTMENT, ROLES.SUPER_ADMIN), paymentController.paymentDeptStats);
router.get('/stats/accounts', authorize(ROLES.ACCOUNTS, ROLES.SUPER_ADMIN), paymentController.accountsStats);
router.get('/stats/super-admin', authorize(ROLES.SUPER_ADMIN), paymentController.superAdminStats);
router.get('/stats/my-payments', authorize(ROLES.DEPARTMENT_USER), paymentController.myStats);

// CEO/Director's only window into Payment data — a narrow, single-record, read-only lookup
// embedded in Quotation Details. No list/full-detail access for these two roles.
router.get(
  '/by-quotation/:quotationId',
  authorize(ROLES.CEO, ROLES.DIRECTOR, ROLES.SUPER_ADMIN, ROLES.ACCOUNTS, ROLES.PAYMENT_DEPARTMENT),
  validate({ params: mongoIdParamSchema('quotationId') }),
  paymentController.getByQuotation,
);

router.get(
  '/:id',
  authorize(ROLES.PAYMENT_DEPARTMENT, ROLES.ACCOUNTS, ROLES.SUPER_ADMIN, ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  paymentController.getById,
);

router.patch(
  '/:id/start-processing',
  authorize(ROLES.PAYMENT_DEPARTMENT),
  validate({ params: mongoIdParamSchema(), body: startProcessingSchema }),
  paymentController.startProcessing,
);

router.patch(
  '/:id/mark-paid',
  authorize(ROLES.PAYMENT_DEPARTMENT),
  validate({ params: mongoIdParamSchema(), body: markPaidSchema }),
  paymentController.markPaid,
);

router.patch('/:id/mark-completed', authorize(ROLES.PAYMENT_DEPARTMENT), validate({ params: mongoIdParamSchema() }), paymentController.markCompleted);

router.patch(
  '/:id/mark-failed',
  authorize(ROLES.PAYMENT_DEPARTMENT),
  validate({ params: mongoIdParamSchema(), body: markFailedSchema }),
  paymentController.markFailed,
);

export default router;
