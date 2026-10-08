import { Router } from 'express';

import { requireAdminAuth } from '../../../middleware/auth.middleware.js';
import {
    validateParams,
    validateQuery,
} from '../../../middleware/validation.middleware.js';

import { getUserController, listUsersController } from './admin-user.controller.js';
import { listUsersQuerySchema, userIdParamsSchema } from './admin-user.validator.js';

const router = Router();

router.get(
    '/',
    requireAdminAuth,
    validateQuery(listUsersQuerySchema),
    listUsersController,
);

router.get(
    '/:id',
    requireAdminAuth,
    validateParams(userIdParamsSchema),
    getUserController,
);

export default router;
