import { Router } from 'express';

import { ROLES } from '@/constants/roles';
import { authenticate } from '@/middleware/auth.middleware';
import { authorize } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate.middleware';
import { settingController } from '@/modules/setting/setting.controller';
import { updateSettingSchema } from '@/modules/setting/setting.validation';

const router = Router();

router.use(authenticate);

router.get('/', settingController.get);

router.patch('/', authorize(ROLES.SUPER_ADMIN), validate({ body: updateSettingSchema }), settingController.update);

export default router;
