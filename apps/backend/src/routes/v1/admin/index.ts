import { Router } from 'express';

import adminAuditLogRoutes from '../../../domains/admin/audit-log/admin-audit-log.routes.js';
import adminAuthRoutes from '../../../domains/admin/auth/admin-auth.routes.js';
import adminDashboardRoutes from '../../../domains/admin/dashboard/admin-dashboard.routes.js';
import adminPaymentRoutes from '../../../domains/admin/payment/admin-payment.routes.js';
import adminTransactionRoutes from '../../../domains/admin/transaction/admin-transaction.routes.js';
import adminTransferRoutes from '../../../domains/admin/transfer/admin-transfer.routes.js';
import adminUserRoutes from '../../../domains/admin/user/admin-user.routes.js';
import adminWithdrawalRoutes from '../../../domains/admin/withdrawal/admin-withdrawal.routes.js';

const adminRouter = Router();

adminRouter.use('/auth', adminAuthRoutes);
adminRouter.use('/dashboard', adminDashboardRoutes);
adminRouter.use('/users', adminUserRoutes);
adminRouter.use('/payments', adminPaymentRoutes);
adminRouter.use('/transfers', adminTransferRoutes);
adminRouter.use('/transactions', adminTransactionRoutes);
adminRouter.use('/withdrawals', adminWithdrawalRoutes);
adminRouter.use('/audit-logs', adminAuditLogRoutes);

export default adminRouter;
