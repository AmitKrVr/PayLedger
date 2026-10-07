import { AdminRole } from "@payledger/database";

export { };

declare global {
    namespace Express {
        interface Request {
            requestId: string;
            validatedQuery?: unknown;
            validatedParams?: unknown;
            validatedHeaders?: unknown;

            cookies: Record<string, string>;

            user?: {
                userId: string;
                sessionId: string;
            };

            admin?: {
                adminId: string;
                sessionId: string;
                role: AdminRole;
            };
        }
    }
}