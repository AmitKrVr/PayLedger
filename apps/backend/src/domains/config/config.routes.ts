import { Router } from 'express';

import { requireUserAuth } from '../../middleware/auth.middleware.js';

import { getLimitsController } from './config.controller.js';

const router = Router();

router.get('/limits', requireUserAuth, getLimitsController);

export default router;
