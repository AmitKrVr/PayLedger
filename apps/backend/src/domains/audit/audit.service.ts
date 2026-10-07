import type { Request } from 'express';

import {
    db,
    type DatabaseOrTransaction,
} from '@payledger/database';

import * as auditRepository from './audit.repository.js';
import type {
    CreateAuditLogInput,
    LogFromRequestOptions,
} from './audit.types.js';
import { logger } from '../../lib/logger.js';

const getClientIpAddress = (req: Request): string | null => {
    return req.ip ?? null;
};

export const auditService = {
    async log(
        input: CreateAuditLogInput,
        executor: DatabaseOrTransaction = db,
    ): Promise<void> {
        try {
            await auditRepository.insertAuditLog(
                input,
                executor,
            );
        } catch (error) {
            logger.error(
                {
                    error,
                    category: input.category,
                    action: input.action,
                    actorType: input.actorType,
                    targetType: input.targetType,
                    targetId: input.targetId,
                },
                'Failed to record audit log',
            );
        }
    },

    async logFromRequest(
        options: LogFromRequestOptions,
        executor: DatabaseOrTransaction = db,
    ): Promise<void> {
        const {
            req,
            actorType = 'SYSTEM',
            actorUserId = null,
            actorAdminId = null,
            category,
            action,
            status = 'SUCCESS',
            targetType,
            targetId = null,
            metadata = null,
        } = options;

        await this.log(
            {
                category,
                action,
                status,
                actorType,
                actorUserId,
                actorAdminId,
                targetType,
                targetId,
                metadata,
                requestId: req.requestId ?? null,
                ipAddress: getClientIpAddress(req),
                userAgent: req.get('user-agent') ?? null,
            },
            executor,
        );
    },
};