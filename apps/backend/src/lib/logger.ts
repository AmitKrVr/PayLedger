import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = isProduction
    ? pino({
        level: process.env.LOG_LEVEL ?? 'info',
        base: {
            service: 'payledger-backend',
        },
        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'password',
                'passwordHash',
                'accessToken',
                'refreshToken',
                'token',
            ],
            censor: '[REDACTED]',
        },
    })
    : pino(
        {
            level: process.env.LOG_LEVEL ?? 'info',
            base: {
                service: 'payledger-backend',
            },
            redact: {
                paths: [
                    'req.headers.authorization',
                    'req.headers.cookie',
                    'password',
                    'passwordHash',
                    'accessToken',
                    'refreshToken',
                    'token',
                ],
                censor: '[REDACTED]',
            },
        },
        pino.transport({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                singleLine: false,
                ignore: 'pid,hostname',
            },
        }),
    );