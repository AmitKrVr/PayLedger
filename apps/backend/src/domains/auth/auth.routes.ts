import { Router } from 'express';

import { requireUserAuth } from '../../middleware/auth.middleware.js';
import {
    loginRateLimit,
    refreshRateLimit,
    registerRateLimit,
} from '../../middleware/rate-limit.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';

import {
    loginSchema,
    registerSchema,
} from './auth.validator.js';
import { loginController, logoutController, meController, refreshController, registerController } from './auth.controller.js';

const router = Router();

router.post(
    '/register',
    registerRateLimit,
    validateBody(registerSchema),
    registerController,
);

router.post(
    '/login',
    loginRateLimit,
    validateBody(loginSchema),
    loginController,
);

router.post(
    '/refresh',
    refreshRateLimit,
    refreshController,
);

router.post('/logout', logoutController);

router.get('/me', requireUserAuth, meController);

export default router;