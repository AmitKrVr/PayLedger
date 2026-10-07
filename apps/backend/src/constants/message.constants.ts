export const SUCCESS_MESSAGES = {
    OPERATION_SUCCESSFUL: 'Operation successful',
    CREATED_SUCCESSFULLY: 'Created successfully',
    UPDATED_SUCCESSFULLY: 'Updated successfully',
    DELETED_SUCCESSFULLY: 'Deleted successfully',

    REGISTERED_SUCCESSFULLY: 'Account registered successfully',
    LOGIN_SUCCESSFULLY: 'Login successful',
    LOGOUT_SUCCESSFULLY: 'Logout successful',
    TOKEN_REFRESHED_SUCCESSFULLY: 'Token refreshed successfully',
} as const;

export const ERROR_MESSAGES = {
    VALIDATION_ERROR: 'Validation failed',
    BAD_REQUEST: 'Bad request',
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'Access denied',
    NOT_FOUND: 'Resource not found',
    CONFLICT: 'Resource already exists',
    RATE_LIMITED: 'Too many requests',
    INTERNAL_SERVER_ERROR: 'Internal server error',

    INVALID_CREDENTIALS: 'Invalid mobile number or password',
    ACCOUNT_BLOCKED: 'Your account is blocked',
    ACCOUNT_LOCKED: 'Your account is temporarily locked',
    INVALID_TOKEN: 'Invalid or expired access token',
    INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token',
    SESSION_NOT_FOUND: 'Authentication session not found',
    SESSION_REVOKED: 'Authentication session has been revoked',
    SESSION_EXPIRED: 'Authentication session has expired',
} as const;