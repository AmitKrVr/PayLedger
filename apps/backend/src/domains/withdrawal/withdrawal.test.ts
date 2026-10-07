import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    ledgerEntries,
    transactions,
    users,
    wallets,
    withdrawals,
    WalletStatus,
} from '@payledger/database';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../../app.js';

import { register } from '../auth/auth.service.js';
import { holdWallet } from '../wallet/wallet.operations.js';
import { findWalletByUserId } from '../wallet/wallet.repository.js';

const ACCESS_TOKEN_COOKIE = 'access_token';

const createdUserIds: string[] = [];

const createTestUser = async (initialBalancePaise = 0n) => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        {
            name: `Withdrawal Test ${Math.random().toString(36).slice(2, 8)}`,
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

    if (initialBalancePaise > 0n) {
        await db
            .update(wallets)
            .set({ balancePaise: initialBalancePaise })
            .where(eq(wallets.id, wallet.id));
    }

    return {
        userId: result.user.id,
        walletId: wallet.id,
        cookie: `${ACCESS_TOKEN_COOKIE}=${result.accessToken}`,
    };
};

const getWallet = async (walletId: string) => {
    const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .limit(1);

    if (!wallet) {
        throw new Error('Wallet not found');
    }

    return wallet;
};

const createWithdrawalRequest = (
    cookie: string,
    amount: number,
    idempotencyKey: string = randomUUID(),
) =>
    request(app)
        .post('/api/v1/withdrawals')
        .set('Cookie', cookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ amount });

describe('Withdrawal domain', () => {
    afterAll(async () => {
        if (createdUserIds.length > 0) {
            const testWallets = await db
                .select()
                .from(wallets)
                .where(inArray(wallets.userId, createdUserIds));
            const walletIds = testWallets.map((w) => w.id);

            if (walletIds.length > 0) {
                await db
                    .delete(withdrawals)
                    .where(inArray(withdrawals.walletId, walletIds));
                await db
                    .delete(ledgerEntries)
                    .where(inArray(ledgerEntries.walletId, walletIds));
            }

            await db
                .delete(transactions)
                .where(inArray(transactions.userId, createdUserIds));
            await db
                .delete(wallets)
                .where(inArray(wallets.userId, createdUserIds));
            await db.delete(users).where(inArray(users.id, createdUserIds));
        }

        await closeConnection();
    });

    it('creates a PENDING withdrawal for a valid amount', async () => {
        const user = await createTestUser(500000n); // ₹5,000

        const res = await createWithdrawalRequest(user.cookie, 1000);

        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({
            amount: 1000,
            status: 'PENDING',
        });
        expect(res.body.data.requestedAt).toBeTruthy();
        expect(res.body.data).not.toHaveProperty('amountPaise');
        expect(res.body.data).not.toHaveProperty('walletId');
    });

    it('succeeds at exactly the minimum amount (₹100)', async () => {
        const user = await createTestUser(100000n);

        const res = await createWithdrawalRequest(user.cookie, 100);

        expect(res.status).toBe(201);
    });

    it('rejects an amount below the minimum (₹99)', async () => {
        const user = await createTestUser(100000n);

        const res = await createWithdrawalRequest(user.cookie, 99);

        expect(res.status).toBe(422);
    });

    it('succeeds at exactly the maximum amount (₹25,000)', async () => {
        const user = await createTestUser(2_500_000n);

        const res = await createWithdrawalRequest(user.cookie, 25_000);

        expect(res.status).toBe(201);
    });

    it('rejects an amount above the maximum (₹25,001)', async () => {
        const user = await createTestUser(10_000_000n);

        const res = await createWithdrawalRequest(user.cookie, 25_001);

        expect(res.status).toBe(422);
    });

    it('rejects a withdrawal when available balance is insufficient', async () => {
        const user = await createTestUser(50000n); // ₹500

        const res = await createWithdrawalRequest(user.cookie, 1000);

        expect(res.status).toBe(422);

        const wallet = await getWallet(user.walletId);
        expect(wallet.heldPaise).toBe(0n);
    });

    it('cannot withdraw funds that are already held', async () => {
        const user = await createTestUser(100000n); // ₹1,000

        await db
            .update(wallets)
            .set({ heldPaise: 90000n }) // ₹900 held, ₹100 available
            .where(eq(wallets.id, user.walletId));

        const res = await createWithdrawalRequest(user.cookie, 200);

        expect(res.status).toBe(422);

        const wallet = await getWallet(user.walletId);
        expect(wallet.heldPaise).toBe(90000n); // unchanged
    });

    it('holds the amount without changing balance, and creates no transaction/ledger entries', async () => {
        const user = await createTestUser(500000n); // ₹5,000

        const res = await createWithdrawalRequest(user.cookie, 1000);
        expect(res.status).toBe(201);

        const wallet = await getWallet(user.walletId);
        expect(wallet.balancePaise).toBe(500000n); // unchanged
        expect(wallet.heldPaise).toBe(100000n); // ₹1,000 now held

        const [withdrawalRow] = await db
            .select()
            .from(withdrawals)
            .where(eq(withdrawals.id, res.body.data.id));
        expect(withdrawalRow?.status).toBe('PENDING');
        expect(withdrawalRow?.transactionId).toBeNull();
        expect(withdrawalRow?.processedAt).toBeNull();
        expect(withdrawalRow?.processedByAdminId).toBeNull();

        const txns = await db
            .select()
            .from(transactions)
            .where(eq(transactions.userId, user.userId));
        expect(txns).toHaveLength(0);

        const entries = await db
            .select()
            .from(ledgerEntries)
            .where(eq(ledgerEntries.walletId, user.walletId));
        expect(entries).toHaveLength(0);
    });

    it('rejects withdrawal creation for a blocked wallet, with no hold created', async () => {
        const user = await createTestUser(100000n);

        await db
            .update(wallets)
            .set({ status: WalletStatus.BLOCKED })
            .where(eq(wallets.id, user.walletId));

        const res = await createWithdrawalRequest(user.cookie, 100);

        expect(res.status).toBe(422);

        const wallet = await getWallet(user.walletId);
        expect(wallet.heldPaise).toBe(0n);

        const rows = await db
            .select()
            .from(withdrawals)
            .where(eq(withdrawals.walletId, user.walletId));
        expect(rows).toHaveLength(0);
    });

    it('scopes the withdrawal to the authenticated user\'s own wallet only', async () => {
        const userA = await createTestUser(100000n);
        const userB = await createTestUser(100000n);

        const res = await createWithdrawalRequest(userA.cookie, 100);
        expect(res.status).toBe(201);

        const [withdrawalRow] = await db
            .select()
            .from(withdrawals)
            .where(eq(withdrawals.id, res.body.data.id));

        expect(withdrawalRow?.walletId).toBe(userA.walletId);
        expect(withdrawalRow?.walletId).not.toBe(userB.walletId);

        const walletB = await getWallet(userB.walletId);
        expect(walletB.heldPaise).toBe(0n); // untouched by userA's request
    });

    it('returns the same withdrawal for a repeated Idempotency-Key', async () => {
        const user = await createTestUser(100000n);
        const key = randomUUID();

        const first = await createWithdrawalRequest(user.cookie, 100, key);
        const second = await createWithdrawalRequest(user.cookie, 100, key);

        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
        expect(second.body.data.id).toBe(first.body.data.id);

        const wallet = await getWallet(user.walletId);
        expect(wallet.heldPaise).toBe(10000n); // held only once

        const rows = await db
            .select()
            .from(withdrawals)
            .where(eq(withdrawals.walletId, user.walletId));
        expect(rows).toHaveLength(1);
    });

    it('concurrent duplicate Idempotency-Key requests only create one withdrawal and one hold', async () => {
        const user = await createTestUser(100000n);
        const key = randomUUID();

        const results = await Promise.all(
            Array.from({ length: 10 }, () =>
                createWithdrawalRequest(user.cookie, 100, key),
            ),
        );

        for (const res of results) {
            expect(res.status).toBe(201);
        }

        const withdrawalIds = new Set(results.map((res) => res.body.data.id));
        expect(withdrawalIds.size).toBe(1);

        const rows = await db
            .select()
            .from(withdrawals)
            .where(eq(withdrawals.walletId, user.walletId));
        expect(rows).toHaveLength(1);

        const wallet = await getWallet(user.walletId);
        expect(wallet.heldPaise).toBe(10000n); // held only once
    });

    it('concurrent different withdrawals against the same wallet: row locking prevents overspending', async () => {
        const user = await createTestUser(100000n); // ₹1,000

        const results = await Promise.allSettled([
            createWithdrawalRequest(user.cookie, 700),
            createWithdrawalRequest(user.cookie, 700),
        ]);

        const succeeded = results.filter(
            (r) => r.status === 'fulfilled' && r.value.status === 201,
        );
        const failed = results.filter(
            (r) => r.status === 'rejected' || r.value.status !== 201,
        );

        expect(succeeded).toHaveLength(1);
        expect(failed).toHaveLength(1);

        const wallet = await getWallet(user.walletId);
        expect(wallet.balancePaise).toBe(100000n);
        expect(wallet.heldPaise).toBe(70000n);
        expect(wallet.balancePaise - wallet.heldPaise).toBe(30000n); // ₹300 available
    });

    it('rolls back the hold if something fails after it, inside the same transaction', async () => {
        // createWithdrawal has no further business step between holdWallet()
        // and the insert that a black-box HTTP test can realistically force
        // to fail without flaky timing tricks. This instead verifies the
        // same underlying guarantee directly: a Postgres transaction that
        // holds funds and then throws rolls the hold back too, using the
        // real holdWallet() operation and a real rollback.
        const user = await createTestUser(100000n);

        await expect(
            db.transaction(async (tx) => {
                await holdWallet({
                    walletId: user.walletId,
                    amountPaise: 50000n,
                    tx,
                });

                throw new Error('simulated failure after hold');
            }),
        ).rejects.toThrow('simulated failure after hold');

        const wallet = await getWallet(user.walletId);
        expect(wallet.heldPaise).toBe(0n);
        expect(wallet.balancePaise).toBe(100000n);
    });
});
