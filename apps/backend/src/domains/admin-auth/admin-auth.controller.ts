import type {
    NextFunction,
    Request,
    RequestHandler,
    Response,
} from 'express';

import { SUCCESS_CODES } from '../../constants/response.constants.js';
import { SUCCESS_MESSAGES } from '../../constants/message.constants.js';
import {
    clearAuthCookies,
    getAccessTokenCookieName,
    getRefreshTokenCookieName,
    setAuthCookies,
} from '../../lib/auth/cookies.js';
import { sendSuccess } from '../../lib/http.js';

import type { RequestContext } from '../auth/auth.types.js';

import {
    getAdminProfile,
    loginAdmin,
    logoutAdmin,
    refreshAdmin,
} from './admin-auth.service.js';
import type { AdminLoginInput } from './admin-auth.validator.js';

const extractRequestContext = (
    req: Request,
): RequestContext => ({
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    deviceName: req.get('x-device-name'),
});

export const adminLoginController: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const body = req.body as AdminLoginInput;
        const context = extractRequestContext(req);

        const result = await loginAdmin(body, context);

        setAuthCookies(
            res,
            result.accessToken,
            result.refreshToken,
        );

        return sendSuccess(res, {
            statusCode: 200,
            code: SUCCESS_CODES.SUCCESS,
            message: SUCCESS_MESSAGES.LOGIN_SUCCESSFULLY,
            data: result.admin,
        });
    } catch (error) {
        next(error);
    }
};

export const adminRefreshController: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const refreshToken =
            req.cookies?.[getRefreshTokenCookieName()];

        const context = extractRequestContext(req);

        const result = await refreshAdmin(refreshToken, context);

        setAuthCookies(
            res,
            result.accessToken,
            result.refreshToken,
        );

        return sendSuccess(res, {
            statusCode: 200,
            code: SUCCESS_CODES.SUCCESS,
            message: SUCCESS_MESSAGES.TOKEN_REFRESHED_SUCCESSFULLY,
            data: null,
        });
    } catch (error) {
        clearAuthCookies(res);
        next(error);
    }
};

export const adminLogoutController: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const refreshToken =
            req.cookies?.[getRefreshTokenCookieName()];

        const accessToken =
            req.cookies?.[getAccessTokenCookieName()];

        const context = extractRequestContext(req);

        await logoutAdmin(refreshToken, accessToken, context);

        clearAuthCookies(res);

        return sendSuccess(res, {
            statusCode: 200,
            code: SUCCESS_CODES.SUCCESS,
            message: SUCCESS_MESSAGES.LOGOUT_SUCCESSFULLY,
            data: null,
        });
    } catch (error) {
        clearAuthCookies(res);
        next(error);
    }
};

export const adminMeController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const admin = await getAdminProfile(req.admin!.adminId);

        return sendSuccess(res, {
            data: admin,
        });
    } catch (error) {
        next(error);
    }
};
