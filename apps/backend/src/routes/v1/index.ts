import { Router } from 'express';

import authRoutes from '../../domains/auth/auth.routes.js';
import paymentRoutes from '../../domains/payment/payment.routes.js';
import walletRoutes from '../../domains/wallet/wallet.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/payments', paymentRoutes);

export default router;