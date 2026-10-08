import { Router } from 'express';

import { requireAdminAuth } from '../../../middleware/auth.middleware.js';

import { getDashboardController } from './admin-dashboard.controller.js';

const router = Router();

router.get('/', requireAdminAuth, getDashboardController);

export default router;
