import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';

import { env } from '@payledger/config';
import {
    closeConnection,
    db,
    gatewayPayments,
} from '@payledger/database';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';

import app from '../../app.js';
import { buildSignedPayload } from '../../integrations/payledger-webhook/payledger-webhook.client.js';

import { simulateFailure, simulateSuccess } from './payment.service.js';

const createdOrderIds: string[] = [];

const createPaymentReq = (
    orderId: string,
    amount: number,
    currency: string = 'INR',
) => {
    createdOrderIds.push(orderId);

    return request(app)
        .post('/api/v1/gateway/payments')
        .send({ orderId, amount, currency });
};

const successReq = (paymentId: string) =>
    request(app)
        .post(`/api/v1/gateway/payments/${paymentId}/success`)
        .send();

const failureReq = (paymentId: string, reason?: string) =>
    request(app)
        .post(`/api/v1/gateway/payments/${paymentId}/failure`)
        .send(reason ? { reason } : {});

const getGatewayPaymentById = async (id: string) => {
    const [row] = await db
        .select()
        .from(gatewayPayments)
        .where(eq(gatewayPayments.id, id))
        .limit(1);

    if (!row) {
        throw new Error('Gateway payment not found');
    }

    return row;
};

const findGatewayPaymentsByOrderId = (orderId: string) =>
    db
        .select()
        .from(gatewayPayments)
        .where(eq(gatewayPayments.orderId, orderId));

// A tiny local HTTP server standing in for PayLedger's webhook endpoint,
// used only by the webhook-contract tests below (payload shape, paise
// amount, signature validity, resend behavior). Everything else in this
// file exercises the gateway's real HTTP API end-to-end.
let captureServer: Server;
let captureUrl: string;
const receivedRequests: Array<{
    body: string;
    headers: Record<string, string | string[] | undefined>;
}> = [];

beforeAll(async () => {
    captureServer = createServer((req, res) => {
        let data = '';

        req.on('data', (chunk: Buffer) => {
            data += chunk.toString('utf8');
        });

        req.on('end', () => {
            receivedRequests.push({ body: data, headers: req.headers });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
    });

    await new Promise<void>((resolve) => {
        captureServer.listen(0, '127.0.0.1', () => resolve());
    });

    const address = captureServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    captureUrl = `http://127.0.0.1:${port}/webhook`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => {
        captureServer.close(() => resolve());
    });

    if (createdOrderIds.length > 0) {
        const rows = await db
            .select({ id: gatewayPayments.id })
            .from(gatewayPayments)
            .where(inArray(gatewayPayments.orderId, createdOrderIds));

        if (rows.length > 0) {
            await db
                .delete(gatewayPayments)
                .where(inArray(gatewayPayments.id, rows.map((r) => r.id)));
        }
    }

    await closeConnection();
});

describe('Fake Payment Gateway — payment domain', () => {
    describe('POST /api/v1/gateway/payments', () => {
        it('creates a payment successfully', async () => {
            const orderId = randomUUID();

            const res = await createPaymentReq(orderId, 100000);

            expect(res.status).toBe(201);
            expect(res.body.data).toMatchObject({
                orderId,
                amount: 1000,
                currency: 'INR',
                status: 'CREATED',
            });
            expect(res.body.data.id).toBeTruthy();
            expect(res.body.data.paymentId).toBeTruthy();
        });

        it('initial state is CREATED', async () => {
            const orderId = randomUUID();
            const res = await createPaymentReq(orderId, 50000);

            const row = await getGatewayPaymentById(res.body.data.id);
            expect(row.status).toBe('CREATED');
            expect(row.paidAt).toBeNull();
            expect(row.amountPaise).toBe(50000n);
        });

        it('rejects a negative or zero amount', async () => {
            const negative = await createPaymentReq(randomUUID(), -100);
            expect(negative.status).toBe(422);

            const zero = await createPaymentReq(randomUUID(), 0);
            expect(zero.status).toBe(422);
        });

        it('rejects a non-integer amount', async () => {
            const res = await createPaymentReq(randomUUID(), 1000.5);
            expect(res.status).toBe(422);
        });

        it('rejects a non-INR currency', async () => {
            const res = await createPaymentReq(randomUUID(), 100000, 'USD');
            expect(res.status).toBe(422);
        });

        it('rejects an empty orderId', async () => {
            const res = await request(app)
                .post('/api/v1/gateway/payments')
                .send({ orderId: '', amount: 1000, currency: 'INR' });

            expect(res.status).toBe(422);
        });

        it('rejects a duplicate orderId', async () => {
            const orderId = randomUUID();

            const first = await createPaymentReq(orderId, 100000);
            expect(first.status).toBe(201);

            const second = await createPaymentReq(orderId, 200000);
            expect(second.status).toBe(409);

            const rows = await findGatewayPaymentsByOrderId(orderId);
            expect(rows).toHaveLength(1);
        });

        it('generates a unique paymentId per order', async () => {
            const first = await createPaymentReq(randomUUID(), 100000);
            const second = await createPaymentReq(randomUUID(), 100000);

            expect(first.body.data.paymentId).not.toBe(
                second.body.data.paymentId,
            );
        });
    });

    describe('POST /api/v1/gateway/payments/:paymentId/success', () => {
        it('changes CREATED to SUCCESS', async () => {
            const orderId = randomUUID();
            const created = await createPaymentReq(orderId, 100000);

            const res = await successReq(created.body.data.paymentId);

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('SUCCESS');

            const row = await getGatewayPaymentById(created.body.data.id);
            expect(row.status).toBe('SUCCESS');
        });

        it('populates paidAt on success', async () => {
            const created = await createPaymentReq(randomUUID(), 100000);

            await successReq(created.body.data.paymentId);

            const row = await getGatewayPaymentById(created.body.data.id);
            expect(row.paidAt).toBeTruthy();
        });

        it('returns 404 for an unknown paymentId', async () => {
            const res = await successReq(randomUUID());
            expect(res.status).toBe(404);
        });

        it('rejects FAILED to SUCCESS', async () => {
            const created = await createPaymentReq(randomUUID(), 100000);
            await failureReq(created.body.data.paymentId, 'Card declined');

            const res = await successReq(created.body.data.paymentId);

            expect(res.status).toBe(409);

            const row = await getGatewayPaymentById(created.body.data.id);
            expect(row.status).toBe('FAILED');
        });

        it('repeated SUCCESS does not create another payment record', async () => {
            const orderId = randomUUID();
            const created = await createPaymentReq(orderId, 100000);

            const first = await successReq(created.body.data.paymentId);
            const second = await successReq(created.body.data.paymentId);

            expect(first.status).toBe(200);
            expect(second.status).toBe(200);

            const rows = await findGatewayPaymentsByOrderId(orderId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).toBe('SUCCESS');
        });

        it('two concurrent success requests are safe', async () => {
            const orderId = randomUUID();
            const created = await createPaymentReq(orderId, 100000);
            const paymentId = created.body.data.paymentId;

            const [resA, resB] = await Promise.all([
                successReq(paymentId),
                successReq(paymentId),
            ]);

            expect(resA.status).toBe(200);
            expect(resB.status).toBe(200);
            expect(resA.body.data.status).toBe('SUCCESS');
            expect(resB.body.data.status).toBe('SUCCESS');

            const rows = await findGatewayPaymentsByOrderId(orderId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).toBe('SUCCESS');
        });

        it('concurrent success + failure requests are safe: only one terminal state wins', async () => {
            const orderId = randomUUID();
            const created = await createPaymentReq(orderId, 100000);
            const paymentId = created.body.data.paymentId;

            const [successRes, failureRes] = await Promise.all([
                successReq(paymentId),
                failureReq(paymentId, 'Racing failure'),
            ]);

            const statuses = [successRes.status, failureRes.status].sort();
            expect(statuses).toEqual([200, 409]);

            const rows = await findGatewayPaymentsByOrderId(orderId);
            expect(rows).toHaveLength(1);

            if (successRes.status === 200) {
                expect(rows[0]?.status).toBe('SUCCESS');
            } else {
                expect(rows[0]?.status).toBe('FAILED');
            }
        });
    });

    describe('POST /api/v1/gateway/payments/:paymentId/failure', () => {
        it('changes CREATED to FAILED', async () => {
            const created = await createPaymentReq(randomUUID(), 100000);

            const res = await failureReq(
                created.body.data.paymentId,
                'Payment declined',
            );

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('FAILED');

            const row = await getGatewayPaymentById(created.body.data.id);
            expect(row.status).toBe('FAILED');
        });

        it('stores the failure reason', async () => {
            const created = await createPaymentReq(randomUUID(), 100000);

            await failureReq(created.body.data.paymentId, 'Insufficient funds');

            const row = await getGatewayPaymentById(created.body.data.id);
            expect(row.failureReason).toBe('Insufficient funds');
        });

        it('defaults the failure reason when none is given', async () => {
            const created = await createPaymentReq(randomUUID(), 100000);

            const res = await failureReq(created.body.data.paymentId);
            expect(res.status).toBe(200);

            const row = await getGatewayPaymentById(created.body.data.id);
            expect(row.failureReason).toBeTruthy();
        });

        it('rejects SUCCESS to FAILED', async () => {
            const created = await createPaymentReq(randomUUID(), 100000);
            await successReq(created.body.data.paymentId);

            const res = await failureReq(created.body.data.paymentId);

            expect(res.status).toBe(409);

            const row = await getGatewayPaymentById(created.body.data.id);
            expect(row.status).toBe('SUCCESS');
        });

        it('returns 404 for an unknown paymentId', async () => {
            const res = await failureReq(randomUUID());
            expect(res.status).toBe(404);
        });
    });

    describe('Webhook contract', () => {
        it('contains the expected payload shape', async () => {
            const orderId = randomUUID();
            const amountPaise = 150000;
            const created = await createPaymentReq(orderId, amountPaise);
            const paymentId = created.body.data.paymentId;

            const before = receivedRequests.length;
            await simulateSuccess(paymentId, captureUrl);
            const received = receivedRequests[before];

            expect(received).toBeTruthy();
            const payload = JSON.parse(received!.body) as Record<
                string,
                unknown
            >;

            expect(payload).toMatchObject({
                orderId,
                paymentId,
                amount: amountPaise,
                currency: 'INR',
                status: 'SUCCESS',
            });
            expect(typeof payload.timestamp).toBe('string');
            expect(
                Number.isNaN(Date.parse(payload.timestamp as string)),
            ).toBe(false);
        });

        it('includes failureReason for a FAILED webhook', async () => {
            const orderId = randomUUID();
            const created = await createPaymentReq(orderId, 100000);
            const paymentId = created.body.data.paymentId;

            const before = receivedRequests.length;
            await simulateFailure(paymentId, 'Bank rejected', captureUrl);
            const received = receivedRequests[before];

            const payload = JSON.parse(received!.body) as Record<
                string,
                unknown
            >;

            expect(payload.status).toBe('FAILED');
            expect(payload.failureReason).toBe('Bank rejected');
        });

        it('amount is paise, not INR', async () => {
            const orderId = randomUUID();
            const amountPaise = 250000; // ₹2,500
            const created = await createPaymentReq(orderId, amountPaise);
            const paymentId = created.body.data.paymentId;

            expect(created.body.data.amount).toBe(2500); // the create response is INR

            const before = receivedRequests.length;
            await simulateSuccess(paymentId, captureUrl);
            const received = receivedRequests[before];
            const payload = JSON.parse(received!.body) as Record<
                string,
                unknown
            >;

            expect(payload.amount).toBe(amountPaise);
        });

        it('signature header is a valid HMAC-SHA256 of the exact raw body', async () => {
            const created = await createPaymentReq(randomUUID(), 100000);
            const paymentId = created.body.data.paymentId;

            const before = receivedRequests.length;
            await simulateSuccess(paymentId, captureUrl);
            const received = receivedRequests[before];

            const signatureHeader =
                received!.headers['x-payment-gateway-signature'];
            expect(typeof signatureHeader).toBe('string');

            const expected = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
                .update(received!.body)
                .digest('hex');

            expect(signatureHeader).toBe(expected);
        });

        it('signature is generated from the exact raw payload bytes', () => {
            const input = {
                orderId: 'order-exact-bytes',
                paymentId: randomUUID(),
                amountPaise: 12345n,
                currency: 'INR',
                status: 'SUCCESS' as const,
            };

            const { body, signature } = buildSignedPayload(input);

            const expected = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
                .update(body)
                .digest('hex');

            expect(signature).toBe(expected);

            // Any change to the exact bytes — even reserializing the same
            // logical value — must invalidate the signature.
            const tamperedBody = body.replace('12345', '99999');
            const tamperedSignature = createHmac(
                'sha256',
                env.PAYMENT_WEBHOOK_SECRET,
            )
                .update(tamperedBody)
                .digest('hex');

            expect(tamperedSignature).not.toBe(signature);
        });

        it('repeated SUCCESS calls resend the webhook each time', async () => {
            const orderId = randomUUID();
            const created = await createPaymentReq(orderId, 100000);
            const paymentId = created.body.data.paymentId;

            const before = receivedRequests.length;
            await simulateSuccess(paymentId, captureUrl);
            await simulateSuccess(paymentId, captureUrl);
            await simulateSuccess(paymentId, captureUrl);

            expect(receivedRequests.length - before).toBe(3);

            const rows = await findGatewayPaymentsByOrderId(orderId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).toBe('SUCCESS');
        });

        it('repeated FAILED calls resend the webhook each time', async () => {
            const orderId = randomUUID();
            const created = await createPaymentReq(orderId, 100000);
            const paymentId = created.body.data.paymentId;

            const before = receivedRequests.length;
            await simulateFailure(paymentId, 'Card declined', captureUrl);
            await simulateFailure(paymentId, undefined, captureUrl);

            expect(receivedRequests.length - before).toBe(2);

            const rows = await findGatewayPaymentsByOrderId(orderId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).toBe('FAILED');
            // The original failure reason is preserved — a later resend
            // never overwrites it.
            expect(rows[0]?.failureReason).toBe('Card declined');
        });

        it('webhook delivery failure does not revert the gateway payment state', async () => {
            const orderId = randomUUID();
            const created = await createPaymentReq(orderId, 100000);
            const paymentId = created.body.data.paymentId;

            // Port 1 is reserved and refuses connections — guarantees a
            // delivery failure regardless of what else is running locally.
            const result = await simulateSuccess(
                paymentId,
                'http://127.0.0.1:1',
            );

            expect(result.status).toBe('SUCCESS');

            const row = await getGatewayPaymentById(created.body.data.id);
            expect(row.status).toBe('SUCCESS');
            expect(row.paidAt).toBeTruthy();
        });
    });
});
