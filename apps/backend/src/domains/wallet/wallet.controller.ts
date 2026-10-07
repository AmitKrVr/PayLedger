import type { RequestHandler } from 'express';

import { sendSuccess } from '../../lib/http.js';

import { getWallet } from './wallet.service.js';

export const getWalletController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const wallet = await getWallet(req.user!.userId);

        return sendSuccess(res, {
            data: wallet,
        });
    } catch (error) {
        next(error);
    }
};
