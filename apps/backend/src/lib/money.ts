const PAISE_PER_INR = 100;

/** Converts integer paise (database/ledger unit) to an INR number for API responses. */
export const paiseToInr = (paise: bigint): number => Number(paise) / PAISE_PER_INR;

/**
 * Converts an INR amount (API input) to integer paise. Rounds to the
 * nearest paisa so float representation error in the multiplication can't
 * leave a fractional paisa — every value downstream of this stays bigint.
 */
export const inrToPaise = (amountInr: number): bigint =>
    BigInt(Math.round(amountInr * PAISE_PER_INR));
