export const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
} as const;

export const ERROR_MESSAGES = {
    PAYMENT_NOT_FOUND: 'Gateway payment not found',
    DUPLICATE_ORDER_ID: 'A gateway payment for this orderId already exists',
    ALREADY_FAILED:
        'This payment has already failed and cannot be marked successful',
    ALREADY_SUCCEEDED:
        'This payment has already succeeded and cannot be marked failed',
} as const;
