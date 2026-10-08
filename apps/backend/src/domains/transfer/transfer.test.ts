import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    ledgerEntries,
    transactions,
    transfers,
    users,
    wallets,
    WalletStatus,
    WalletType,
} from '@payledger/database';
import { and, eq, inArray, or } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';

import { register } from '../auth/auth.service.js';
import { findWalletByUserId } from '../wallet/wallet.repository.js';

import { getIstDayRangeUtc } from './transfer.service.js';
import { getDailyCompletedTransferAmount } from './transfer.repository.js';

const ACCESS_TOKEN_COOKIE = 'access_token';

const createdUserIds: string[] = [];

const createTestUser = async (initialBalancePaise = 0n) => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        {
            name: `Transfer Test ${Math.random().toString(36).slice(2, 8)}`,
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
        mobile,
        name: result.user.name,
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

const lookupRecipient = (cookie: string, mobile: string) =>
    request(app)
        .post('/api/v1/transfers/recipient')
        .set('Cookie', cookie)
        .send({ mobile });

const createTransfer = (
    cookie: string,
    recipientUserId: string,
    amount: number,
    idempotencyKey: string = randomUUID(),
) =>
    request(app)
        .post('/api/v1/transfers')
        .set('Cookie', cookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ recipientUserId, amount });

describe('Transfer domain', () => {
    beforeAll(async () => {
        const [systemWallet] = await db
            .select()
            .from(wallets)
            .where(eq(wallets.walletType, WalletType.SYSTEM))
            .limit(1);

        if (!systemWallet) {
            await db.insert(wallets).values({
                walletType: WalletType.SYSTEM,
                status: WalletStatus.ACTIVE,
            });
        }
    });

    afterAll(async () => {
        if (createdUserIds.length > 0) {
            const testWallets = await db
                .select()
                .from(wallets)
                .where(inArray(wallets.userId, createdUserIds));
            const walletIds = testWallets.map((w) => w.id);

            const testTransactions = await db
                .select({ id: transactions.id })
                .from(transactions)
                .where(inArray(transactions.userId, createdUserIds));
            const transactionIds = testTransactions.map((t) => t.id);

            // Delete by transactionId, not walletId: a TRANSFER's fee leg
            // lives on the (shared, not-per-test) system wallet, so
            // scoping only to test-user wallet ids would leave its ledger
            // entries behind and block deleting the transaction row.
            if (transactionIds.length > 0) {
                await db
                    .delete(ledgerEntries)
                    .where(inArray(ledgerEntries.transactionId, transactionIds));
            }

            if (walletIds.length > 0) {
                await db
                    .delete(transfers)
                    .where(
                        or(
                            inArray(transfers.senderWalletId, walletIds),
                            inArray(transfers.receiverWalletId, walletIds),
                        ),
                    );
            }

            await db
                .delete(transactions)
                .where(inArray(transactions.userId, createdUserIds));
            await db
                .delete(wallets)
                .where(inArray(wallets.userId, createdUserIds));
            await db
                .delete(users)
                .where(inArray(users.id, createdUserIds));
        }

        await closeConnection();
    });

    describe('getIstDayRangeUtc', () => {
        it('produces a 24-hour [start, end) range', () => {
            const { startUtc, endUtc } = getIstDayRangeUtc();

            expect(endUtc.getTime() - startUtc.getTime()).toBe(
                24 * 60 * 60 * 1000,
            );
        });

        it('excludes a transfer timestamped just before IST midnight and includes one just after', async () => {
            const sender = await createTestUser(100000n);
            const receiver = await createTestUser();

            const { startUtc, endUtc } = getIstDayRangeUtc();

            const yesterdayTransferId = randomUUID();
            const yesterdayCreatedAt = new Date(startUtc.getTime() - 1000);

            // A transfer row needs a transactionId; insert the matching
            // transaction first so the FK is satisfied.
            const [yesterdayTxn] = await db
                .insert(transactions)
                .values({
                    referenceId: randomUUID().replace(/-/g, '').slice(0, 13),
                    type: 'TRANSFER',
                    status: 'COMPLETED',
                    userId: sender.userId,
                    sourceType: 'TRANSFER',
                    sourceId: yesterdayTransferId,
                    completedAt: yesterdayCreatedAt,
                })
                .returning();

            await db.insert(transfers).values({
                id: yesterdayTransferId,
                transactionId: yesterdayTxn!.id,
                senderWalletId: sender.walletId,
                receiverWalletId: receiver.walletId,
                amountPaise: 500000n,
                feePaise: 100n,
                totalPaise: 500100n,
                idempotencyKey: randomUUID(),
                status: 'COMPLETED',
                createdAt: yesterdayCreatedAt,
            });

            const dailyTotal = await getDailyCompletedTransferAmount(
                sender.walletId,
                startUtc,
                endUtc,
                db,
            );

            expect(dailyTotal).toBe(0n);
        });
    });

    describe('POST /api/v1/transfers/recipient', () => {
        it('finds a recipient by mobile number', async () => {
            const sender = await createTestUser();
            const recipient = await createTestUser();

            const res = await lookupRecipient(sender.cookie, recipient.mobile);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual({
                userId: recipient.userId,
                name: recipient.name,
            });
            expect(res.body.data).not.toHaveProperty('email');
            expect(res.body.data).not.toHaveProperty('walletId');
            expect(res.body.data).not.toHaveProperty('balance');
        });

        it('rejects an unknown mobile number', async () => {
            const sender = await createTestUser();

            const res = await lookupRecipient(sender.cookie, '9000000000');

            expect(res.status).toBe(404);
        });

        it('rejects a self-transfer lookup', async () => {
            const sender = await createTestUser();

            const res = await lookupRecipient(sender.cookie, sender.mobile);

            expect(res.status).toBe(422);
        });

        it('rejects a recipient whose wallet is not eligible', async () => {
            const sender = await createTestUser();
            const recipient = await createTestUser();

            await db
                .update(wallets)
                .set({ status: WalletStatus.BLOCKED })
                .where(eq(wallets.id, recipient.walletId));

            const res = await lookupRecipient(sender.cookie, recipient.mobile);

            expect(res.status).toBe(422);
        });
    });

    describe('POST /api/v1/transfers', () => {
        it('completes a transfer with correct sender/receiver/system balances', async () => {
            const sender = await createTestUser(500000n); // ₹5,000
            const receiver = await createTestUser();
            const systemWalletBefore = await db
                .select()
                .from(wallets)
                .where(eq(wallets.walletType, WalletType.SYSTEM))
                .limit(1);
            const systemBalanceBefore = systemWalletBefore[0]!.balancePaise;

            const res = await createTransfer(
                sender.cookie,
                receiver.userId,
                1000,
            );

            expect(res.status).toBe(201);
            expect(res.body.data).toMatchObject({
                amount: 1000,
                fee: 10,
                total: 1010,
                status: 'COMPLETED',
                recipient: { userId: receiver.userId, name: receiver.name },
            });
            expect(res.body.data.referenceId).toMatch(/^[0-9A-V]{13}$/);

            const senderWallet = await getWallet(sender.walletId);
            const receiverWallet = await getWallet(receiver.walletId);
            const systemWalletAfter = await db
                .select()
                .from(wallets)
                .where(eq(wallets.walletType, WalletType.SYSTEM))
                .limit(1);

            expect(senderWallet.balancePaise).toBe(500000n - 101000n);
            expect(receiverWallet.balancePaise).toBe(100000n);
            expect(systemWalletAfter[0]!.balancePaise - systemBalanceBefore).toBe(
                1000n,
            );
        });

        it.each([
            [100, 1],
            [1000, 10],
            [2500, 20],
            [25000, 20],
        ])('charges ₹%i a fee of ₹%i', async (amount, expectedFee) => {
            const sender = await createTestUser(3000000n); // ₹30,000
            const receiver = await createTestUser();

            const res = await createTransfer(
                sender.cookie,
                receiver.userId,
                amount,
            );

            expect(res.status).toBe(201);
            expect(res.body.data.fee).toBe(expectedFee);
            expect(res.body.data.total).toBe(amount + expectedFee);
        });

        it('rejects an amount above the maximum transfer limit', async () => {
            const sender = await createTestUser(10_000_000n);
            const receiver = await createTestUser();

            const res = await createTransfer(
                sender.cookie,
                receiver.userId,
                25_001,
            );

            expect(res.status).toBe(422);
        });

        it("rejects a transfer when the sender's own wallet is blocked", async () => {
            const sender = await createTestUser(100000n);
            const receiver = await createTestUser();

            await db
                .update(wallets)
                .set({ status: WalletStatus.BLOCKED })
                .where(eq(wallets.id, sender.walletId));

            const res = await createTransfer(sender.cookie, receiver.userId, 100);

            expect(res.status).toBe(422);

            const senderWallet = await getWallet(sender.walletId);
            expect(senderWallet.balancePaise).toBe(100000n);
        });

        it('rejects a transfer when available balance is insufficient', async () => {
            const sender = await createTestUser(5000n); // ₹50
            const receiver = await createTestUser();

            const res = await createTransfer(
                sender.cookie,
                receiver.userId,
                100,
            );

            expect(res.status).toBe(422);
        });

        it('cannot spend held funds', async () => {
            const sender = await createTestUser(100000n); // ₹1,000
            const receiver = await createTestUser();

            await db
                .update(wallets)
                .set({ heldPaise: 95000n }) // ₹950 held, ₹50 available
                .where(eq(wallets.id, sender.walletId));

            const res = await createTransfer(
                sender.cookie,
                receiver.userId,
                100,
            );

            expect(res.status).toBe(422);

            const senderWallet = await getWallet(sender.walletId);
            expect(senderWallet.balancePaise).toBe(100000n);
        });

        it('rejects a self-transfer at creation time too', async () => {
            const sender = await createTestUser(100000n);

            const res = await createTransfer(sender.cookie, sender.userId, 100);

            expect(res.status).toBe(422);
        });

        it('fails the transfer if the recipient was blocked after lookup', async () => {
            const sender = await createTestUser(100000n);
            const receiver = await createTestUser();

            const lookup = await lookupRecipient(sender.cookie, receiver.mobile);
            expect(lookup.status).toBe(200);

            await db
                .update(wallets)
                .set({ status: WalletStatus.BLOCKED })
                .where(eq(wallets.id, receiver.walletId));

            const res = await createTransfer(
                sender.cookie,
                receiver.userId,
                100,
            );

            expect(res.status).toBe(422);

            const senderWallet = await getWallet(sender.walletId);
            expect(senderWallet.balancePaise).toBe(100000n);
        });

        it('rolls back sender debit and receiver credit if the fee credit fails', async () => {
            const sender = await createTestUser(100000n);
            const receiver = await createTestUser();

            await db
                .update(wallets)
                .set({ status: WalletStatus.BLOCKED })
                .where(eq(wallets.walletType, WalletType.SYSTEM));

            try {
                const res = await createTransfer(
                    sender.cookie,
                    receiver.userId,
                    100,
                );

                expect(res.status).toBe(422);

                const senderWallet = await getWallet(sender.walletId);
                const receiverWallet = await getWallet(receiver.walletId);

                expect(senderWallet.balancePaise).toBe(100000n);
                expect(receiverWallet.balancePaise).toBe(0n);
            } finally {
                await db
                    .update(wallets)
                    .set({ status: WalletStatus.ACTIVE })
                    .where(eq(wallets.walletType, WalletType.SYSTEM));
            }
        });

        it('returns the same transfer for a repeated Idempotency-Key', async () => {
            const sender = await createTestUser(100000n);
            const receiver = await createTestUser();
            const key = randomUUID();

            const first = await createTransfer(
                sender.cookie,
                receiver.userId,
                100,
                key,
            );
            const second = await createTransfer(
                sender.cookie,
                receiver.userId,
                100,
                key,
            );

            expect(first.status).toBe(201);
            expect(second.status).toBe(201);
            expect(second.body.data.id).toBe(first.body.data.id);

            const senderWallet = await getWallet(sender.walletId);
            expect(senderWallet.balancePaise).toBe(100000n - 10100n);
        });

        it('creates a balanced ledger and a correct TRANSFER transaction record', async () => {
            const sender = await createTestUser(200000n); // ₹2,000, comfortably above ₹1,010 needed
            const receiver = await createTestUser();

            const res = await createTransfer(
                sender.cookie,
                receiver.userId,
                1000,
            );
            expect(res.status).toBe(201);

            const [transaction] = await db
                .select()
                .from(transactions)
                .where(eq(transactions.referenceId, res.body.data.referenceId));

            expect(transaction?.type).toBe('TRANSFER');
            expect(transaction?.status).toBe('COMPLETED');
            expect(transaction?.sourceType).toBe('TRANSFER');
            expect(transaction?.sourceId).toBe(res.body.data.id);

            const entries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.transactionId, transaction!.id));

            expect(entries).toHaveLength(3);

            const signedSum = entries.reduce(
                (sum, entry) =>
                    sum +
                    (entry.direction === 'CREDIT'
                        ? entry.amountPaise
                        : -entry.amountPaise),
                0n,
            );
            expect(signedSum).toBe(0n);
        });

        it('enforces the ₹50,000 daily limit, counting only the amount (not the fee)', async () => {
            const sender = await createTestUser(10_000_000n); // ₹1,00,000
            const receiver = await createTestUser();

            // 49 transfers of ₹1,000 = ₹49,000 counted toward the limit.
            for (let i = 0; i < 49; i += 1) {
                const res = await createTransfer(
                    sender.cookie,
                    receiver.userId,
                    1000,
                );
                expect(res.status).toBe(201);
            }

            // ₹1,001 would push the counted amount to ₹50,001 -> reject.
            const overLimit = await createTransfer(
                sender.cookie,
                receiver.userId,
                1001,
            );
            expect(overLimit.status).toBe(422);

            // ₹1,000 brings the counted amount to exactly ₹50,000 -> allowed,
            // even though total debit (with fee) pushes past ₹50,000.
            const atLimit = await createTransfer(
                sender.cookie,
                receiver.userId,
                1000,
            );
            expect(atLimit.status).toBe(201);

            // Any further amount must now fail.
            const afterLimit = await createTransfer(
                sender.cookie,
                receiver.userId,
                1,
            );
            expect(afterLimit.status).toBe(422);
        });

        it('concurrent duplicate Idempotency-Key requests only create one transfer', async () => {
            const sender = await createTestUser(100000n);
            const receiver = await createTestUser();
            const key = randomUUID();

            const results = await Promise.all(
                Array.from({ length: 10 }, () =>
                    createTransfer(sender.cookie, receiver.userId, 100, key),
                ),
            );

            for (const res of results) {
                expect(res.status).toBe(201);
            }

            const transferIds = new Set(
                results.map((res) => res.body.data.id),
            );
            expect(transferIds.size).toBe(1);

            const rows = await db
                .select()
                .from(transfers)
                .where(eq(transfers.senderWalletId, sender.walletId));
            expect(rows).toHaveLength(1);

            const senderWallet = await getWallet(sender.walletId);
            expect(senderWallet.balancePaise).toBe(100000n - 10100n);
        });

        it('mandatory concurrency scenario: 50 concurrent ₹100 transfers against a ₹1,000 balance', async () => {
            const sender = await createTestUser(100000n); // ₹1,000
            const receiver = await createTestUser();
            const systemWalletBefore = (
                await db
                    .select()
                    .from(wallets)
                    .where(eq(wallets.walletType, WalletType.SYSTEM))
                    .limit(1)
            )[0]!;

            const results = await Promise.allSettled(
                Array.from({ length: 50 }, () =>
                    createTransfer(sender.cookie, receiver.userId, 100),
                ),
            );

            const succeeded = results.filter(
                (r) => r.status === 'fulfilled' && r.value.status === 201,
            );
            const failed = results.filter(
                (r) => r.status === 'rejected' || r.value.status !== 201,
            );

            expect(succeeded).toHaveLength(9);
            expect(failed).toHaveLength(41);

            const senderWallet = await getWallet(sender.walletId);
            const receiverWallet = await getWallet(receiver.walletId);
            const systemWalletAfter = (
                await db
                    .select()
                    .from(wallets)
                    .where(eq(wallets.walletType, WalletType.SYSTEM))
                    .limit(1)
            )[0]!;

            expect(senderWallet.balancePaise).toBe(9100n); // ₹91
            expect(receiverWallet.balancePaise).toBe(90000n); // ₹900
            expect(
                systemWalletAfter.balancePaise - systemWalletBefore.balancePaise,
            ).toBe(900n); // ₹9

            // Total ledger movement across every leg of every successful
            // transfer must still balance to zero. The system wallet is
            // shared across tests in this file, so its entries are scoped
            // to only this test's own transactions, not queried by wallet
            // id alone.
            const succeededTransferIds = succeeded.map(
                (r) =>
                    (r as PromiseFulfilledResult<request.Response>).value
                        .body.data.id as string,
            );

            const succeededTransfers = await db
                .select()
                .from(transfers)
                .where(inArray(transfers.id, succeededTransferIds));

            const transactionIds = succeededTransfers.map(
                (t) => t.transactionId,
            );

            const senderEntries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.walletId, sender.walletId));
            const receiverEntries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.walletId, receiver.walletId));
            const systemEntries = await db
                .select()
                .from(ledgerEntries)
                .where(
                    and(
                        eq(ledgerEntries.walletId, systemWalletBefore.id),
                        inArray(ledgerEntries.transactionId, transactionIds),
                    ),
                );

            const signedSum = (
                rows: { direction: string; amountPaise: bigint }[],
            ) =>
                rows.reduce(
                    (sum, r) =>
                        sum +
                        (r.direction === 'CREDIT' ? r.amountPaise : -r.amountPaise),
                    0n,
                );

            expect(senderEntries).toHaveLength(9);
            expect(receiverEntries).toHaveLength(9);
            expect(systemEntries).toHaveLength(9);
            expect(
                signedSum(senderEntries) +
                    signedSum(receiverEntries) +
                    signedSum(systemEntries),
            ).toBe(0n);
        });
    });
});
