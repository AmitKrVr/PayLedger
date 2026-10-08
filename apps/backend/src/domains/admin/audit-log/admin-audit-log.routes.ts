import { Router } from 'express';

import { requireAdminAuth } from '../../../middleware/auth.middleware.js';
import { validateQuery } from '../../../middleware/validation.middleware.js';

import { listAuditLogsController } from './admin-audit-log.controller.js';
import { listAuditLogsQuerySchema } from './admin-audit-log.validator.js';

const router = Router();

router.get(
    '/',
    requireAdminAuth,
    validateQuery(listAuditLogsQuerySchema),
    listAuditLogsController,
);

export default router;
