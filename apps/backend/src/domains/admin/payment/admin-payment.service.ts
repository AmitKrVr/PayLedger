import { ERROR_CODES } from '../../../constants/response.constants.js';
import { inrToPaise, paiseToInr } from '../../../lib/money.js';
import { NotFoundError } from '../../../middleware/error.middleware.js';

import {
    countPayments,
    findPaymentByIdWithUser,
    findPayments,
    type ListPaymentsFilters,
} from './admin-payment.repository.js';
import type { ListPaymentsQuery } from './admin-payment.validator.js';

export const listPayments = async (query: ListPaymentsQuery) => {
    const filters: ListPaymentsFilters = {
        search: query.search,
        status: query.status,
        from: query.from,
        to: query.to,
        minAmountPaise:
            query.minAmount !== undefined ? inrToPaise(query.minAmount) : undefined,
        maxAmountPaise:
            query.maxAmount !== undefined ? inrToPaise(query.maxAmount) : undefined,
        page: query.page,
        limit: query.limit,
    };

    const [rows, totalItems] = await Promise.all([
        findPayments(filters),
        countPayments(filters),
    ]);

    return {
        items: rows.map((row) => ({
            id: row.id,
            orderId: row.orderId,
            user: { id: row.userId, name: row.userName, mobile: row.userMobile },
            amount: paiseToInr(row.amountPaise),
            status: row.status,
            provider: row.provider,
            createdAt: row.createdAt,
            paidAt: row.paidAt,
            expiresAt: row.expiresAt,
        })),
        totalItems,
    };
};

export const getPayment = async (id: string) => {
    const row = await findPaymentByIdWithUser(id);

    if (!row) {
        throw new NotFoundError('Payment not found', ERROR_CODES.NOT_FOUND);
    }

    return {
        id: row.id,
        orderId: row.orderId,
        paymentId: row.paymentId,
        user: { id: row.userId, name: row.userName, mobile: row.userMobile },
        amount: paiseToInr(row.amountPaise),
        currency: row.currency,
        status: row.status,
        provider: row.provider,
        failureReason: row.failureReason,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        paidAt: row.paidAt,
        expiresAt: row.expiresAt,
    };
};
