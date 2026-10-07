import { Router } from 'express';

import authRoutes from '../../domains/auth/auth.routes.js';
import paymentRoutes from '../../domains/payment/payment.routes.js';
import transferRoutes from '../../domains/transfer/transfer.routes.js';
import walletRoutes from '../../domains/wallet/wallet.routes.js';
import withdrawalRoutes from '../../domains/withdrawal/withdrawal.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/payments', paymentRoutes);
router.use('/transfers', transferRoutes);
router.use('/withdrawals', withdrawalRoutes);

export default router;