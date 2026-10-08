import type { RequestHandler } from 'express';

import { sendPaginated, sendSuccess } from '../../../lib/http.js';

import { getPayment, listPayments } from './admin-payment.service.js';
import type { ListPaymentsQuery, PaymentIdParams } from './admin-payment.validator.js';

export const listPaymentsController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const query = req.validatedQuery as ListPaymentsQuery;

        const { items, totalItems } = await listPayments(query);

        return sendPaginated(res, {
            data: items,
            page: query.page,
            limit: query.limit,
            totalItems,
        });
    } catch (error) {
        next(error);
    }
};

export const getPaymentController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { id } = req.validatedParams as PaymentIdParams;

        const payment = await getPayment(id);

        return sendSuccess(res, {
            data: payment,
        });
    } catch (error) {
        next(error);
    }
};
