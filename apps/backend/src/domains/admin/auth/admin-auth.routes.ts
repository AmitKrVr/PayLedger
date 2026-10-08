import { Router } from 'express';

import { requireAdminAuth } from '../../../middleware/auth.middleware.js';
import {
    adminLoginRateLimit,
    adminRefreshRateLimit,
} from '../../../middleware/rate-limit.middleware.js';
import { validateBody } from '../../../middleware/validation.middleware.js';

import {
    adminLoginController,
    adminLogoutController,
    adminMeController,
    adminRefreshController,
} from './admin-auth.controller.js';
import { adminLoginSchema } from './admin-auth.validator.js';

const router = Router();

router.post(
    '/login',
    adminLoginRateLimit,
    validateBody(adminLoginSchema),
    adminLoginController,
);

router.post(
    '/refresh',
    adminRefreshRateLimit,
    adminRefreshController,
);

router.post('/logout', adminLogoutController);

router.get('/me', requireAdminAuth, adminMeController);

export default router;
