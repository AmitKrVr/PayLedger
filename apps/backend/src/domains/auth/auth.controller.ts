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

import {
    getProfile,
    login,
    logout,
    refresh,
    register,
} from './auth.service.js';
import type { RequestContext } from './auth.types.js';
import type {
    LoginInput,
    RegisterInput,
} from './auth.validator.js';

const extractRequestContext = (
    req: Request,
): RequestContext => ({
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    deviceName: req.get('x-device-name'),
});

export const registerController: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const body = req.body as RegisterInput;
        const context = extractRequestContext(req);

        const result = await register(body, context);

        setAuthCookies(
            res,
            'user',
            result.accessToken,
            result.refreshToken,
        );

        return sendSuccess(res, {
            statusCode: 201,
            code: SUCCESS_CODES.CREATED,
            message: SUCCESS_MESSAGES.REGISTERED_SUCCESSFULLY,
            data: result.user,
        });
    } catch (error) {
        next(error);
    }
};

export const loginController: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const body = req.body as LoginInput;
        const context = extractRequestContext(req);

        const result = await login(body, context);

        setAuthCookies(
            res,
            'user',
            result.accessToken,
            result.refreshToken,
        );

        return sendSuccess(res, {
            statusCode: 200,
            code: SUCCESS_CODES.SUCCESS,
            message: SUCCESS_MESSAGES.LOGIN_SUCCESSFULLY,
            data: result.user,
        });
    } catch (error) {
        next(error);
    }
};

export const refreshController: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const refreshToken =
            req.cookies?.[getRefreshTokenCookieName('user')];

        const context = extractRequestContext(req);

        const result = await refresh(
            refreshToken,
            context,
        );

        setAuthCookies(
            res,
            'user',
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
        clearAuthCookies(res, 'user');
        next(error);
    }
};

export const logoutController: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const refreshToken =
            req.cookies?.[getRefreshTokenCookieName('user')];

        const accessToken =
            req.cookies?.[getAccessTokenCookieName('user')];

        const context = extractRequestContext(req);

        await logout(
            refreshToken,
            accessToken,
            context,
        );

        clearAuthCookies(res, 'user');

        return sendSuccess(res, {
            statusCode: 200,
            code: SUCCESS_CODES.SUCCESS,
            message: SUCCESS_MESSAGES.LOGOUT_SUCCESSFULLY,
            data: null,
        });
    } catch (error) {
        clearAuthCookies(res, 'user');
        next(error);
    }
};

export const meController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const user = await getProfile(req.user!.userId);

        return sendSuccess(res, {
            data: user,
        });
    } catch (error) {
        next(error);
    }
};