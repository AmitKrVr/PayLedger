import { Router } from 'express';

import adminAuthRoutes from '../../../domains/admin/auth/admin-auth.routes.js';
import adminTransferRoutes from '../../../domains/admin/transfer/admin-transfer.routes.js';
import adminWithdrawalRoutes from '../../../domains/admin/withdrawal/admin-withdrawal.routes.js';

const adminRouter = Router();

adminRouter.use('/auth', adminAuthRoutes);
adminRouter.use('/withdrawals', adminWithdrawalRoutes);
adminRouter.use('/transfers', adminTransferRoutes);

export default adminRouter;
