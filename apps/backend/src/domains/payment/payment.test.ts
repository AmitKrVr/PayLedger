import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';

import { env } from '@payledger/config';
import {
    closeConnection,
    db,
    ledgerEntries,
    payments,
    transactions,
    users,
    wallets,
    PaymentStatus,
    WalletStatus,
} from '@payledger/database';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { inrToPaise } from '../../lib/money.js';

import { register } from '../auth/auth.service.js';
import { findWalletByUserId } from '../wallet/wallet.repository.js';

import { verifyWebhookSignature } from './payment.controller.js';
import { createPayment } from './payment.service.js';

const ACCESS_TOKEN_COOKIE = 'access_token';

const createdUserIds: string[] = [];

/**
 * Stands in for the Fake Payment Gateway at its real configured address
 * (env.PAYMENT_GATEWAY_BASE_URL, http://localhost:5002 by default) for
 * the duration of this file — createPayment() always calls that address
 * when no override is given, so every pre-existing test below that goes
 * through the real HTTP controller (createPaymentFor) transparently
 * integrates with this mock instead of requiring a manually-run gateway.
 * Always responds CREATED, echoing back the request's own orderId/amount.
 */
let defaultMockGatewayServer: Server;

beforeAll(async () => {
    const gatewayUrl = new URL(env.PAYMENT_GATEWAY_BASE_URL);

    defaultMockGatewayServer = createServer((req, res) => {
        let data = '';

        req.on('data', (chunk: Buffer) => {
            data += chunk.toString('utf8');
        });

        req.on('end', () => {
            const parsed = JSON.parse(data) as {
                orderId: string;
                amount: number;
            };

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    success: true,
                    code: 'CREATED',
                    message: 'Operation successful',
                    requestId: randomUUID(),
                    data: {
                        id: randomUUID(),
                        orderId: parsed.orderId,
                        paymentId: randomUUID(),
                        amount: parsed.amount / 100,
                        currency: 'INR',
                        status: 'CREATED',
                    },
                }),
            );
        });
    });

    await new Promise<void>((resolve, reject) => {
        defaultMockGatewayServer.once('error', reject);
        defaultMockGatewayServer.listen(
            Number(gatewayUrl.port),
            gatewayUrl.hostname,
            () => resolve(),
        );
    });
});

const createTestUser = async () => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        {
            name: 'Payment Test User',
            mobile,
            password: 'Password123!',
        },
        {},
    );

    createdUserIds.push(result.user.id);

    const wallet = await findWalletByUserId(result.user.id);

    if (!wallet) {
        throw new Error('Test user was created without a wallet');
    }

    return {
        userId: result.user.id,
        walletId: wallet.id,
        cookie: `${ACCESS_TOKEN_COOKIE}=${result.accessToken}`,
    };
};

const getWalletBalance = async (walletId: string): Promise<bigint> => {
    const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .limit(1);

    if (!wallet) {
        throw new Error('Wallet not found');
    }

    return wallet.balancePaise;
};

const signBody = (rawBody: string): string =>
    createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

const postWebhook = (payload: Record<string, unknown>, signature?: string) => {
    const rawBody = JSON.stringify(payload);
    const sig = signature ?? signBody(rawBody);

    return request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-payment-gateway-signature', sig)
        .send(rawBody);
};

const createPaymentFor = async (
    cookie: string,
    amount: number,
    idempotencyKey: string = randomUUID(),
) =>
    request(app)
        .post('/api/v1/payments')
        .set('Cookie', cookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ amount });

describe('Payment domain', () => {
    afterAll(async () => {
        for (const userId of createdUserIds) {
            const [wallet] = await db
                .select()
                .from(wallets)
                .where(eq(wallets.userId, userId))
                .limit(1);

            if (wallet) {
                await db
                    .delete(ledgerEntries)
                    .where(eq(ledgerEntries.walletId, wallet.id));
            }

            await db.delete(transactions).where(eq(transactions.userId, userId));
            await db.delete(payments).where(eq(payments.userId, userId));
            await db.delete(wallets).where(eq(wallets.userId, userId));
            await db.delete(users).where(eq(users.id, userId));
        }

        await new Promise<void>((resolve) => {
            defaultMockGatewayServer.close(() => resolve());
        });

        await closeConnection();
    });

    describe('verifyWebhookSignature (pure)', () => {
        it('accepts a correctly signed body', () => {
            const body = Buffer.from('{"hello":"world"}');
            const signature = createHmac(
                'sha256',
                env.PAYMENT_WEBHOOK_SECRET,
            )
                .update(body)
                .digest('hex');

            expect(verifyWebhookSignature(body, signature)).toBe(true);
        });

        it('rejects a tampered body', () => {
            const signed = Buffer.from('{"amount":1000}');
            const tampered = Buffer.from('{"amount":9000}');
            const signature = createHmac(
                'sha256',
                env.PAYMENT_WEBHOOK_SECRET,
            )
                .update(signed)
                .digest('hex');

            expect(verifyWebhookSignature(tampered, signature)).toBe(false);
        });

        it('rejects a missing signature', () => {
            expect(
                verifyWebhookSignature(Buffer.from('{}'), undefined),
            ).toBe(false);
        });
    });

    describe('POST /api/v1/payments', () => {
        it('creates a payment with a valid amount', async () => {
            const user = await createTestUser();

            const res = await createPaymentFor(user.cookie, 1000);

            expect(res.status).toBe(201);
            expect(res.body.data).toMatchObject({
                amount: 1000,
                status: 'CREATED',
            });
            expect(res.body.data.id).toBeTruthy();
            expect(res.body.data.orderId).toBeTruthy();
            expect(res.body.data).not.toHaveProperty('currency');
        });

        it('rejects an amount below the configured minimum', async () => {
            const user = await createTestUser();

            const res = await createPaymentFor(
                user.cookie,
                env.PAYMENT_MIN_DEPOSIT_INR - 1,
            );

            expect(res.status).toBe(422);
        });

        it('rejects an amount above the configured maximum', async () => {
            const user = await createTestUser();

            const res = await createPaymentFor(
                user.cookie,
                env.PAYMENT_MAX_DEPOSIT_INR + 1,
            );

            expect(res.status).toBe(422);
        });

        it('returns the same payment for a repeated Idempotency-Key', async () => {
            const user = await createTestUser();
            const key = randomUUID();

            const first = await createPaymentFor(user.cookie, 500, key);
            const second = await createPaymentFor(user.cookie, 500, key);

            expect(first.status).toBe(201);
            expect(second.status).toBe(201);
            expect(second.body.data.id).toBe(first.body.data.id);

            const rows = await db
                .select()
                .from(payments)
                .where(eq(payments.userId, user.userId));

            expect(rows).toHaveLength(1);
        });

        it('creates separate payments for different Idempotency-Key values', async () => {
            const user = await createTestUser();

            const first = await createPaymentFor(user.cookie, 500, randomUUID());
            const second = await createPaymentFor(
                user.cookie,
                500,
                randomUUID(),
            );

            expect(first.body.data.id).not.toBe(second.body.data.id);
        });

        it('concurrent duplicate Idempotency-Key requests only create one payment', async () => {
            const user = await createTestUser();
            const key = randomUUID();

            const results = await Promise.all([
                createPaymentFor(user.cookie, 500, key),
                createPaymentFor(user.cookie, 500, key),
            ]);

            for (const res of results) {
                expect(res.status).toBe(201);
            }

            const ids = new Set(results.map((res) => res.body.data.id));
            expect(ids.size).toBe(1);

            const rows = await db
                .select()
                .from(payments)
                .where(eq(payments.userId, user.userId));

            expect(rows).toHaveLength(1);
        });
    });

    describe('GET /api/v1/payments/:id', () => {
        it('rejects access to another user\'s payment', async () => {
            const owner = await createTestUser();
            const intruder = await createTestUser();

            const created = await createPaymentFor(owner.cookie, 500);
            const paymentId = created.body.data.id;

            const res = await request(app)
                .get(`/api/v1/payments/${paymentId}`)
                .set('Cookie', intruder.cookie);

            expect(res.status).toBe(404);
        });

        it('returns the owner\'s own payment', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 500);

            const res = await request(app)
                .get(`/api/v1/payments/${created.body.data.id}`)
                .set('Cookie', user.cookie);

            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(created.body.data.id);
        });
    });

    describe('POST /api/v1/payments/webhook', () => {
        it('rejects a webhook with an invalid signature without touching the DB', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 1000);
            const balanceBefore = await getWalletBalance(user.walletId);

            const res = await postWebhook(
                {
                    orderId: created.body.data.orderId,
                    paymentId: randomUUID(),
                    status: 'SUCCESS',
                    amount: 100000,
                },
                '0'.repeat(64),
            );

            expect(res.status).toBe(401);

            const [payment] = await db
                .select()
                .from(payments)
                .where(eq(payments.id, created.body.data.id));
            expect(payment?.status).toBe('CREATED');

            expect(await getWalletBalance(user.walletId)).toBe(balanceBefore);
        });

        it('rejects a webhook whose amount does not match the payment', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 1000);

            const res = await postWebhook({
                orderId: created.body.data.orderId,
                paymentId: randomUUID(),
                status: 'SUCCESS',
                amount: 90000,
            });

            expect(res.status).toBe(422);

            const [payment] = await db
                .select()
                .from(payments)
                .where(eq(payments.id, created.body.data.id));
            expect(payment?.status).toBe('CREATED');
        });

        it('rejects a webhook whose orderId does not match any payment', async () => {
            const res = await postWebhook({
                orderId: `nonexistent-${randomUUID()}`,
                paymentId: randomUUID(),
                status: 'SUCCESS',
                amount: 100000,
            });

            expect(res.status).toBe(404);
        });

        it('marks a failed webhook as FAILED without crediting the wallet', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 1000);
            const balanceBefore = await getWalletBalance(user.walletId);

            const res = await postWebhook({
                orderId: created.body.data.orderId,
                paymentId: randomUUID(),
                status: 'FAILED',
                amount: 100000,
                failureReason: 'insufficient funds at bank',
            });

            expect(res.status).toBe(200);

            const [payment] = await db
                .select()
                .from(payments)
                .where(eq(payments.id, created.body.data.id));
            expect(payment?.status).toBe('FAILED');
            expect(payment?.failureReason).toBe('insufficient funds at bank');

            expect(await getWalletBalance(user.walletId)).toBe(balanceBefore);
        });

        it('expires a payment instead of crediting it once past expiresAt', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 1000);
            const balanceBefore = await getWalletBalance(user.walletId);

            await db
                .update(payments)
                .set({ expiresAt: new Date(Date.now() - 1000) })
                .where(eq(payments.id, created.body.data.id));

            const res = await postWebhook({
                orderId: created.body.data.orderId,
                paymentId: randomUUID(),
                status: 'SUCCESS',
                amount: 100000,
            });

            expect(res.status).toBe(200);

            const [payment] = await db
                .select()
                .from(payments)
                .where(eq(payments.id, created.body.data.id));
            expect(payment?.status).toBe('EXPIRED');

            expect(await getWalletBalance(user.walletId)).toBe(balanceBefore);
        });

        it('does not credit an already-terminal (CANCELLED) payment', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 1000);
            const balanceBefore = await getWalletBalance(user.walletId);

            await db
                .update(payments)
                .set({ status: 'CANCELLED' })
                .where(eq(payments.id, created.body.data.id));

            const res = await postWebhook({
                orderId: created.body.data.orderId,
                paymentId: randomUUID(),
                status: 'SUCCESS',
                amount: 100000,
            });

            expect(res.status).toBe(200);

            const [payment] = await db
                .select()
                .from(payments)
                .where(eq(payments.id, created.body.data.id));
            expect(payment?.status).toBe('CANCELLED');

            expect(await getWalletBalance(user.walletId)).toBe(balanceBefore);
        });

        it('a valid webhook credits the wallet exactly once and creates a balanced DEPOSIT transaction', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 1000);
            const balanceBefore = await getWalletBalance(user.walletId);
            const gatewayPaymentId = randomUUID();

            const res = await postWebhook({
                orderId: created.body.data.orderId,
                paymentId: gatewayPaymentId,
                status: 'SUCCESS',
                amount: 100000,
            });

            expect(res.status).toBe(200);

            const [payment] = await db
                .select()
                .from(payments)
                .where(eq(payments.id, created.body.data.id));
            expect(payment?.status).toBe('SUCCESS');
            expect(payment?.paymentId).toBe(gatewayPaymentId);
            expect(payment?.paidAt).toBeTruthy();

            const balanceAfter = await getWalletBalance(user.walletId);
            expect(balanceAfter - balanceBefore).toBe(100000n);

            const [depositTx] = await db
                .select()
                .from(transactions)
                .where(eq(transactions.sourceId, payment!.id));
            expect(depositTx?.type).toBe('DEPOSIT');
            expect(depositTx?.status).toBe('COMPLETED');
            expect(depositTx?.sourceType).toBe('PAYMENT');
            expect(depositTx?.referenceId).toHaveLength(13);

            const entries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.transactionId, depositTx!.id));
            expect(entries).toHaveLength(1);
            expect(entries[0]?.direction).toBe('CREDIT');
            expect(entries[0]?.amountPaise).toBe(100000n);
            expect(entries[0]?.balanceBeforePaise).toBe(balanceBefore);
            expect(entries[0]?.balanceAfterPaise).toBe(balanceAfter);
        });

        it('delivering the same successful webhook five times only credits once', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 1000);
            const balanceBefore = await getWalletBalance(user.walletId);
            const payload = {
                orderId: created.body.data.orderId,
                paymentId: randomUUID(),
                status: 'SUCCESS' as const,
                amount: 100000,
            };

            for (let i = 0; i < 5; i += 1) {
                const res = await postWebhook(payload);
                expect(res.status).toBe(200);
            }

            const balanceAfter = await getWalletBalance(user.walletId);
            expect(balanceAfter - balanceBefore).toBe(100000n);

            const [payment] = await db
                .select()
                .from(payments)
                .where(eq(payments.id, created.body.data.id));
            const entries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.walletId, user.walletId));
            const depositEntries = entries.filter(
                (entry) => entry.amountPaise === 100000n,
            );

            expect(payment?.status).toBe('SUCCESS');
            expect(depositEntries).toHaveLength(1);
        });

        it('concurrent duplicate webhook deliveries only credit once', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 1000);
            const balanceBefore = await getWalletBalance(user.walletId);
            const payload = {
                orderId: created.body.data.orderId,
                paymentId: randomUUID(),
                status: 'SUCCESS' as const,
                amount: 100000,
            };

            const results = await Promise.all(
                Array.from({ length: 10 }, () => postWebhook(payload)),
            );

            for (const res of results) {
                expect(res.status).toBe(200);
            }

            const balanceAfter = await getWalletBalance(user.walletId);
            expect(balanceAfter - balanceBefore).toBe(100000n);
        });

        it('does not credit a blocked wallet — the whole transaction rolls back atomically', async () => {
            const user = await createTestUser();
            const created = await createPaymentFor(user.cookie, 1000);
            const balanceBefore = await getWalletBalance(user.walletId);

            await db
                .update(wallets)
                .set({ status: WalletStatus.BLOCKED })
                .where(eq(wallets.id, user.walletId));

            const res = await postWebhook({
                orderId: created.body.data.orderId,
                paymentId: randomUUID(),
                status: 'SUCCESS',
                amount: 100000,
            });

            expect(res.status).toBe(422);

            const [payment] = await db
                .select()
                .from(payments)
                .where(eq(payments.id, created.body.data.id));
            expect(payment?.status).toBe('CREATED');
            expect(payment?.paidAt).toBeNull();

            expect(await getWalletBalance(user.walletId)).toBe(balanceBefore);

            const [depositTx] = await db
                .select()
                .from(transactions)
                .where(eq(transactions.sourceId, payment!.id));
            expect(depositTx).toBeUndefined();
        });
    });

    describe('createPayment → Fake Payment Gateway integration', () => {
        type GatewayRequestBody = {
            orderId: string;
            amount: number;
            currency: string;
        };

        type GatewayResponder = (
            body: GatewayRequestBody,
        ) => { statusCode: number; payload: unknown };

        /** A per-test controlled gateway, bound to a throwaway dynamic
         * port and passed explicitly via createPayment()'s gatewayBaseUrl
         * override — never touches the real/default gateway address. */
        const startControlledGateway = async (responder: GatewayResponder) => {
            const calls: GatewayRequestBody[] = [];

            const server = createServer((req, res) => {
                let data = '';

                req.on('data', (chunk: Buffer) => {
                    data += chunk.toString('utf8');
                });

                req.on('end', () => {
                    const body = JSON.parse(data) as GatewayRequestBody;
                    calls.push(body);

                    const { statusCode, payload } = responder(body);

                    res.writeHead(statusCode, {
                        'Content-Type': 'application/json',
                    });
                    res.end(
                        typeof payload === 'string'
                            ? payload
                            : JSON.stringify(payload),
                    );
                });
            });

            await new Promise<void>((resolve) => {
                server.listen(0, '127.0.0.1', () => resolve());
            });

            const address = server.address();
            const port =
                typeof address === 'object' && address ? address.port : 0;

            return {
                url: `http://127.0.0.1:${port}`,
                calls,
                close: () =>
                    new Promise<void>((resolve) => server.close(() => resolve())),
            };
        };

        const successPayload = (
            body: GatewayRequestBody,
            overrides: Partial<{
                orderId: string;
                amount: number;
                currency: string;
                status: string;
            }> = {},
        ) => ({
            success: true,
            code: 'CREATED',
            message: 'Operation successful',
            requestId: randomUUID(),
            data: {
                id: randomUUID(),
                orderId: overrides.orderId ?? body.orderId,
                paymentId: randomUUID(),
                amount: overrides.amount ?? body.amount / 100,
                currency: overrides.currency ?? 'INR',
                status: overrides.status ?? 'CREATED',
            },
        });

        it('calls the gateway when creating a payment', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body),
            }));

            try {
                await createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    gateway.url,
                );

                expect(gateway.calls).toHaveLength(1);
            } finally {
                await gateway.close();
            }
        });

        it('sends the same PayLedger orderId it generated', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body),
            }));

            try {
                const result = await createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    gateway.url,
                );

                expect(gateway.calls[0]?.orderId).toBe(result.orderId);
            } finally {
                await gateway.close();
            }
        });

        it('sends the amount in paise, not INR', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body),
            }));

            try {
                await createPayment(
                    user.userId,
                    { amount: 1500 },
                    randomUUID(),
                    gateway.url,
                );

                expect(gateway.calls[0]?.amount).toBe(
                    Number(inrToPaise(1500)),
                );
            } finally {
                await gateway.close();
            }
        });

        it('sends currency INR', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body),
            }));

            try {
                await createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    gateway.url,
                );

                expect(gateway.calls[0]?.currency).toBe('INR');
            } finally {
                await gateway.close();
            }
        });

        it("persists the gateway's response onto the PayLedger payment row", async () => {
            const user = await createTestUser();
            let issuedPaymentId = '';
            const gateway = await startControlledGateway((body) => {
                issuedPaymentId = randomUUID();
                return {
                    statusCode: 201,
                    payload: {
                        success: true,
                        code: 'CREATED',
                        message: 'Operation successful',
                        requestId: randomUUID(),
                        data: {
                            id: randomUUID(),
                            orderId: body.orderId,
                            paymentId: issuedPaymentId,
                            amount: body.amount / 100,
                            currency: 'INR',
                            status: 'CREATED',
                        },
                    },
                };
            });

            try {
                const result = await createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    gateway.url,
                );

                const [row] = await db
                    .select()
                    .from(payments)
                    .where(eq(payments.id, result.id));

                expect(row?.paymentId).toBe(issuedPaymentId);
            } finally {
                await gateway.close();
            }
        });

        it('stores the FAKE_GATEWAY provider', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body),
            }));

            try {
                const result = await createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    gateway.url,
                );

                const [row] = await db
                    .select()
                    .from(payments)
                    .where(eq(payments.id, result.id));

                expect(row?.provider).toBe('FAKE_GATEWAY');
            } finally {
                await gateway.close();
            }
        });

        it('returns the existing PayLedger response contract to the client', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body),
            }));

            try {
                const result = await createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    gateway.url,
                );

                expect(result).toMatchObject({
                    amount: 1000,
                    status: 'CREATED',
                });
                expect(result.id).toBeTruthy();
                expect(result.orderId).toBeTruthy();
                expect(result.expiresAt).toBeInstanceOf(Date);
                expect(result).not.toHaveProperty('paymentId');
            } finally {
                await gateway.close();
            }
        });

        it('does not call the gateway twice for the same Idempotency-Key', async () => {
            const user = await createTestUser();
            const key = randomUUID();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body),
            }));

            try {
                await createPayment(
                    user.userId,
                    { amount: 1000 },
                    key,
                    gateway.url,
                );
                await createPayment(
                    user.userId,
                    { amount: 1000 },
                    key,
                    gateway.url,
                );

                expect(gateway.calls).toHaveLength(1);
            } finally {
                await gateway.close();
            }
        });

        it('returns the existing payment for a repeated Idempotency-Key', async () => {
            const user = await createTestUser();
            const key = randomUUID();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body),
            }));

            try {
                const first = await createPayment(
                    user.userId,
                    { amount: 1000 },
                    key,
                    gateway.url,
                );
                const second = await createPayment(
                    user.userId,
                    { amount: 1000 },
                    key,
                    gateway.url,
                );

                expect(second.id).toBe(first.id);
            } finally {
                await gateway.close();
            }
        });

        it('creates a new gateway order for a different Idempotency-Key', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body),
            }));

            try {
                const first = await createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    gateway.url,
                );
                const second = await createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    gateway.url,
                );

                expect(second.id).not.toBe(first.id);
                expect(gateway.calls).toHaveLength(2);
            } finally {
                await gateway.close();
            }
        });

        it('handles a gateway non-2xx response safely', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway(() => ({
                statusCode: 500,
                payload: { success: false, message: 'boom' },
            }));

            try {
                await expect(
                    createPayment(
                        user.userId,
                        { amount: 1000 },
                        randomUUID(),
                        gateway.url,
                    ),
                ).rejects.toMatchObject({ statusCode: expect.any(Number) });
            } finally {
                await gateway.close();
            }
        });

        it('handles an unreachable gateway safely', async () => {
            const user = await createTestUser();

            // Port 1 is reserved and refuses connections — a fast,
            // deterministic stand-in for "gateway unavailable"; the same
            // AbortError/fetch-rejection path also covers a real timeout.
            await expect(
                createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    'http://127.0.0.1:1',
                ),
            ).rejects.toMatchObject({ statusCode: expect.any(Number) });
        });

        it('rejects a malformed gateway response', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway(() => ({
                statusCode: 201,
                payload: { success: true, data: { foo: 'bar' } },
            }));

            try {
                await expect(
                    createPayment(
                        user.userId,
                        { amount: 1000 },
                        randomUUID(),
                        gateway.url,
                    ),
                ).rejects.toThrow();
            } finally {
                await gateway.close();
            }
        });

        it('rejects a gateway response with a mismatched orderId', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body, { orderId: 'not-the-real-order-id' }),
            }));

            try {
                await expect(
                    createPayment(
                        user.userId,
                        { amount: 1000 },
                        randomUUID(),
                        gateway.url,
                    ),
                ).rejects.toThrow();
            } finally {
                await gateway.close();
            }
        });

        it('rejects a gateway response with a mismatched amount', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body, { amount: 1 }),
            }));

            try {
                await expect(
                    createPayment(
                        user.userId,
                        { amount: 1000 },
                        randomUUID(),
                        gateway.url,
                    ),
                ).rejects.toThrow();
            } finally {
                await gateway.close();
            }
        });

        it('rejects a gateway response with a status other than CREATED', async () => {
            const user = await createTestUser();
            const gateway = await startControlledGateway((body) => ({
                statusCode: 201,
                payload: successPayload(body, { status: 'SUCCESS' }),
            }));

            try {
                await expect(
                    createPayment(
                        user.userId,
                        { amount: 1000 },
                        randomUUID(),
                        gateway.url,
                    ),
                ).rejects.toThrow();
            } finally {
                await gateway.close();
            }
        });

        it('marks the PayLedger payment FAILED when the gateway call fails, and never credits the wallet, creates a DEPOSIT transaction, or creates ledger entries', async () => {
            const user = await createTestUser();
            const balanceBefore = await getWalletBalance(user.walletId);
            const gateway = await startControlledGateway(() => ({
                statusCode: 500,
                payload: { success: false, message: 'boom' },
            }));

            let failedPaymentId: string | undefined;

            try {
                await createPayment(
                    user.userId,
                    { amount: 1000 },
                    randomUUID(),
                    gateway.url,
                );
                throw new Error('expected createPayment to reject');
            } catch {
                const [row] = await db
                    .select()
                    .from(payments)
                    .where(eq(payments.userId, user.userId));

                failedPaymentId = row?.id;
                expect(row?.status).toBe(PaymentStatus.FAILED);
                expect(row?.failureReason).toBeTruthy();
            } finally {
                await gateway.close();
            }

            expect(await getWalletBalance(user.walletId)).toBe(balanceBefore);

            const txns = failedPaymentId
                ? await db
                    .select()
                    .from(transactions)
                    .where(eq(transactions.sourceId, failedPaymentId))
                : [];
            expect(txns).toHaveLength(0);

            const entries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.walletId, user.walletId));
            expect(entries).toHaveLength(0);
        });
    });
});
