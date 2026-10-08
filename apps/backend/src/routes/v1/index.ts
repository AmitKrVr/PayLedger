import { Router } from 'express';

import authRoutes from '../../domains/auth/auth.routes.js';
import paymentRoutes from '../../domains/payment/payment.routes.js';
import transactionRoutes from '../../domains/transaction/transaction.routes.js';
import transferRoutes from '../../domains/transfer/transfer.routes.js';
import walletRoutes from '../../domains/wallet/wallet.routes.js';
import withdrawalRoutes from '../../domains/withdrawal/withdrawal.routes.js';

import adminRouter from './admin/index.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/payments', paymentRoutes);
router.use('/transfers', transferRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/transactions', transactionRoutes);


router.use('/admin', adminRouter);

export default router;