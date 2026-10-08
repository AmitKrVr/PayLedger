import express from 'express';

import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware.js';
import paymentRoutes from './domains/payment/payment.routes.js';

const app = express();

app.disable('x-powered-by');

app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/v1/gateway/payments', paymentRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
