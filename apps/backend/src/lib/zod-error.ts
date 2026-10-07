import type { ZodError } from 'zod';

export type FieldValidationError = {
    field: string;
    message: string;
};

export const formatZodErrors = (
    error: ZodError,
): FieldValidationError[] => {
    const errors = new Map<string, string>();

    for (const issue of error.issues) {
        const field = issue.path.length > 0
            ? issue.path.join('.')
            : 'root';

        if (!errors.has(field)) {
            errors.set(field, issue.message);
        }
    }

    return Array.from(errors.entries()).map(
        ([field, message]) => ({
            field,
            message,
        }),
    );
};