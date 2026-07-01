import { Router } from 'express';

import authRoutes from '@/modules/auth/auth.routes';
import billRoutes from '@/modules/bill/bill.routes';
import departmentRoutes from '@/modules/department/department.routes';
import notificationRoutes from '@/modules/notification/notification.routes';
import paymentRoutes from '@/modules/payment/payment.routes';
import quotationRoutes from '@/modules/quotation/quotation.routes';
import settingRoutes from '@/modules/setting/setting.routes';
import userRoutes from '@/modules/user/user.routes';
import vendorRoutes from '@/modules/vendor/vendor.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/departments', departmentRoutes);
router.use('/users', userRoutes);
router.use('/vendors', vendorRoutes);
router.use('/quotations', quotationRoutes);
router.use('/bills', billRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingRoutes);
router.use('/payments', paymentRoutes);

export default router;
