import { Router } from 'express';

import adminAuthRoutes from '../../../domains/admin-auth/admin-auth.routes.js';

const adminRouter = Router();

adminRouter.use('/auth', adminAuthRoutes);

export default adminRouter;
