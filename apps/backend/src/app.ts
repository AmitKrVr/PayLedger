import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from '@payledger/config';

import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware.js';
import healthRoutes from './routes/health.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import apiRouter from './routes/index.js';

const app = express();

app.disable('x-powered-by');

app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());

app.use(
    cors({
        origin: env.CORS_ORIGINS,
        credentials: true,
    }),
);

app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

app.use(cookieParser());

app.use(
    express.json({
        limit: '1mb',
    }),
);

app.use(
    express.urlencoded({
        extended: true,
    }),
);

app.use('/health', healthRoutes);
app.use('/api', apiRouter);


app.use(notFoundHandler);
app.use(errorHandler);

export default app;