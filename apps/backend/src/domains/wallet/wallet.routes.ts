import { Router } from 'express';

import { requireUserAuth } from '../../middleware/auth.middleware.js';

import { getWalletController } from './wallet.controller.js';

const router = Router();

router.get('/', requireUserAuth, getWalletController);

export default router;
