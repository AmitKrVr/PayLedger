import { Router } from 'express';

import { requireUserAuth } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';

import {
    createTransferController,
    lookupRecipientController,
} from './transfer.controller.js';
import {
    createTransferSchema,
    recipientLookupSchema,
} from './transfer.validator.js';

const router = Router();

// Literal path registered ahead of any future dynamic '/:id' route so it
// can never be shadowed.
router.post(
    '/recipient',
    requireUserAuth,
    validateBody(recipientLookupSchema),
    lookupRecipientController,
);

router.post(
    '/',
    requireUserAuth,
    validateBody(createTransferSchema),
    createTransferController,
);

export default router;
