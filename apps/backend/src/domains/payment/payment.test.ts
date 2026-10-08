import { createHmac, randomUUID } from 'node:crypto';

import { env } from '@payledger/config';
import {
    closeConnection,
    db,
    ledgerEntries,
    payments,
    transactions,
    users,
    wallets,
    WalletStatus,
} from '@payledger/database';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../../app.js';

import { register } from '../auth/auth.service.js';
import { findWalletByUserId } from '../wallet/wallet.repository.js';

import { verifyWebhookSignature } from './payment.controller.js';

const ACCESS_TOKEN_COOKIE = 'access_token';

const createdUserIds: string[] = [];

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
});
