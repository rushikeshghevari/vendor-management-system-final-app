import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { uploadQuotationPdf } from '@/middleware/upload.middleware';
import { validate } from '@/middleware/validate.middleware';
import { quotationController } from '@/modules/quotation/quotation.controller';
import {
  createQuotationSchema,
  decisionSchema,
  quotationListQuerySchema,
  updateQuotationSchema,
} from '@/modules/quotation/quotation.validation';
import { mongoIdParamSchema } from '@/utils/commonValidation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ body: createQuotationSchema }),
  quotationController.create,
);

router.get('/', validate({ query: quotationListQuerySchema }), quotationController.list);

// Must be registered before the `/:id` route below, or "stats" would be parsed as an id.
router.get('/stats/director', authorize(ROLES.DIRECTOR), quotationController.directorStats);
router.get('/stats/ceo', authorize(ROLES.CEO, ROLES.SUPER_ADMIN), quotationController.ceoStats);

router.get('/:id', validate({ params: mongoIdParamSchema() }), quotationController.getById);

router.patch(
  '/:id',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema(), body: updateQuotationSchema }),
  quotationController.update,
);

router.patch(
  '/:id/submit',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  quotationController.submit,
);

router.patch(
  '/:id/resubmit',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  quotationController.resubmit,
);

// Director or CEO — which one is actually authorized for a given quotation is resolved
// inside quotationService.decide() by amount vs the CEO Approval Limit.
router.patch(
  '/:id/decision',
  authorize(ROLES.DIRECTOR, ROLES.CEO),
  validate({ params: mongoIdParamSchema(), body: decisionSchema }),
  quotationController.decide,
);

router.post(
  '/:id/pdf',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  uploadQuotationPdf,
  quotationController.uploadPdf,
);

router.delete(
  '/:id',
  authorize(ROLES.DEPARTMENT_USER),
  validate({ params: mongoIdParamSchema() }),
  quotationController.remove,
);

export default router;
