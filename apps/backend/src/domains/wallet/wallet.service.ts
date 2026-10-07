import { ERROR_CODES } from '../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../constants/message.constants.js';
import { NotFoundError } from '../../middleware/error.middleware.js';

import { findWalletByUserId } from './wallet.repository.js';
import type { WalletResponse } from './wallet.types.js';

const PAISE_PER_INR = 100;

const paiseToInr = (paise: bigint): number => Number(paise) / PAISE_PER_INR;

export const getWallet = async (
    userId: string,
): Promise<WalletResponse> => {
    const wallet = await findWalletByUserId(userId);

    if (!wallet) {
        throw new NotFoundError(
            ERROR_MESSAGES.WALLET_NOT_FOUND,
            ERROR_CODES.WALLET_NOT_FOUND,
        );
    }

    const availablePaise = wallet.balancePaise - wallet.heldPaise;

    return {
        id: wallet.id,
        balance: paiseToInr(wallet.balancePaise),
        held: paiseToInr(wallet.heldPaise),
        available: paiseToInr(availablePaise),
        status: wallet.status,
    };
};
