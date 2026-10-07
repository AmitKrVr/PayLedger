import { Router } from 'express';

import authRoutes from '../../domains/auth/auth.routes.js';

const router = Router();

router.use('/auth', authRoutes);

export default router;