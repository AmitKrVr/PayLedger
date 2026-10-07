import type { AdminAuthContext, UserAuthContext } from '../domains/auth/auth.types.js';

export { };

declare global {
    namespace Express {
        interface Request {
            requestId: string;
            validatedQuery?: unknown;
            validatedParams?: unknown;
            validatedHeaders?: unknown;

            cookies: Record<string, string>;

            user?: UserAuthContext;

            admin?: AdminAuthContext;
        }
    }
}