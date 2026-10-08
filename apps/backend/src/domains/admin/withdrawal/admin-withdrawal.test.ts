import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    admins,
    adminSessions,
    ledgerEntries,
    transactions,
    users,
    wallets,
    withdrawals,
    AdminRole,
    AdminStatus,
    WalletStatus,
} from '@payledger/database';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../../../app.js';
import { hashPassword } from '../../../lib/auth/auth.js';

import { loginAdmin } from '../auth/admin-auth.service.js';
import { register } from '../../auth/auth.service.js';
import { findWalletByUserId } from '../../wallet/wallet.repository.js';
import { createWithdrawal } from '../../withdrawal/withdrawal.service.js';

const ADMIN_PASSWORD = 'AdminPass123!';

const createdAdminIds: string[] = [];
const createdUserIds: string[] = [];

const createTestAdmin = async () => {
    const email = `admin.${randomUUID()}@example.com`;
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    const [admin] = await db
        .insert(admins)
        .values({
            name: 'Test Admin',
            mobile,
            email,
            passwordHash,
            role: AdminRole.ADMIN,
            status: AdminStatus.ACTIVE,
        })
        .returning();

    if (!admin) {
        throw new Error('Failed to create test admin');
    }

    createdAdminIds.push(admin.id);

    const result = await loginAdmin({ email, password: ADMIN_PASSWORD }, {});

    return {
        id: admin.id,
        cookie: `admin_access_token=${result.accessToken}`,
    };
};

const createUserWithWithdrawal = async (
    balancePaise: bigint,
    withdrawAmountInr: number,
) => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        {
            name: `Admin Withdrawal Test ${Math.random().toString(36).slice(2, 8)}`,
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

    await db
        .update(wallets)
        .set({ balancePaise })
        .where(eq(wallets.id, wallet.id));

    const withdrawal = await createWithdrawal(
        result.user.id,
        { amount: withdrawAmountInr },
        randomUUID(),
    );

    return {
        userId: result.user.id,
        userName: result.user.name,
        walletId: wallet.id,
        withdrawalId: withdrawal.id,
        userCookie: `access_token=${result.accessToken}`,
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

const listWithdrawalsReq = (cookie: string, query = '') =>
    request(app)
        .get(`/api/v1/admin/withdrawals${query}`)
        .set('Cookie', cookie);

const getWithdrawalReq = (cookie: string, id: string) =>
    request(app)
        .get(`/api/v1/admin/withdrawals/${id}`)
        .set('Cookie', cookie);

const approveWithdrawalReq = (cookie: string, id: string, body?: object) =>
    request(app)
        .post(`/api/v1/admin/withdrawals/${id}/approve`)
        .set('Cookie', cookie)
        .send(body ?? {});

const rejectWithdrawalReq = (cookie: string, id: string, reason: string) =>
    request(app)
        .post(`/api/v1/admin/withdrawals/${id}/reject`)
        .set('Cookie', cookie)
        .send({ reason });

describe('Admin Withdrawal domain', () => {
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

            if (transactionIds.length > 0) {
                await db
                    .delete(ledgerEntries)
                    .where(inArray(ledgerEntries.transactionId, transactionIds));
            }

            if (walletIds.length > 0) {
                await db
                    .delete(withdrawals)
                    .where(inArray(withdrawals.walletId, walletIds));
            }

            await db
                .delete(transactions)
                .where(inArray(transactions.userId, createdUserIds));
            await db
                .delete(wallets)
                .where(inArray(wallets.userId, createdUserIds));
            await db.delete(users).where(inArray(users.id, createdUserIds));
        }

        if (createdAdminIds.length > 0) {
            await db
                .delete(adminSessions)
                .where(inArray(adminSessions.adminId, createdAdminIds));
            await db.delete(admins).where(inArray(admins.id, createdAdminIds));
        }

        await closeConnection();
    });

    describe('GET /api/v1/admin/withdrawals', () => {
        it('lists withdrawals', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(100000n, 100);

            const res = await listWithdrawalsReq(admin.cookie);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            const match = res.body.data.find(
                (w: { id: string }) => w.id === fixture.withdrawalId,
            );
            expect(match).toMatchObject({
                id: fixture.withdrawalId,
                user: { id: fixture.userId, name: fixture.userName },
                amount: 100,
                status: 'PENDING',
            });
            expect(match.processedAt).toBeNull();
        });

        it('paginates results', async () => {
            const admin = await createTestAdmin();

            const resPage1 = await listWithdrawalsReq(
                admin.cookie,
                '?page=1&limit=2',
            );

            expect(resPage1.status).toBe(200);
            expect(resPage1.body.data.length).toBeLessThanOrEqual(2);
            expect(resPage1.body.meta).toMatchObject({ page: 1, limit: 2 });
            expect(typeof resPage1.body.meta.totalItems).toBe('number');
        });

        it('filters by status', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(100000n, 100);

            const res = await listWithdrawalsReq(
                admin.cookie,
                '?status=PENDING&limit=100',
            );

            expect(res.status).toBe(200);
            for (const item of res.body.data) {
                expect(item.status).toBe('PENDING');
            }
            expect(
                res.body.data.some(
                    (w: { id: string }) => w.id === fixture.withdrawalId,
                ),
            ).toBe(true);
        });

        it('rejects a non-admin (user) token', async () => {
            const fixture = await createUserWithWithdrawal(100000n, 100);

            const res = await listWithdrawalsReq(fixture.userCookie);

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/admin/withdrawals/:id', () => {
        it('returns withdrawal details', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(100000n, 250);

            const res = await getWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
            );

            expect(res.status).toBe(200);
            expect(res.body.data).toMatchObject({
                id: fixture.withdrawalId,
                user: { id: fixture.userId, name: fixture.userName },
                amount: 250,
                status: 'PENDING',
                rejectionReason: null,
                processedByAdminName: null,
            });
        });
    });

    describe('POST /api/v1/admin/withdrawals/:id/approve', () => {
        it('approves a pending withdrawal and debits the wallet', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000); // ₹5,000 balance, ₹1,000 withdrawal

            const res = await approveWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
            );

            expect(res.status).toBe(200);
            expect(res.body.data).toMatchObject({
                id: fixture.withdrawalId,
                status: 'APPROVED',
            });
            expect(res.body.data.transactionId).toBeTruthy();
            expect(res.body.data.processedAt).toBeTruthy();

            const wallet = await getWallet(fixture.walletId);
            expect(wallet.balancePaise).toBe(400000n); // ₹4,000
            expect(wallet.heldPaise).toBe(0n);
            expect(wallet.balancePaise - wallet.heldPaise).toBe(400000n); // available

            const [row] = await db
                .select()
                .from(withdrawals)
                .where(eq(withdrawals.id, fixture.withdrawalId));
            expect(row?.status).toBe('APPROVED');
            expect(row?.processedByAdminId).toBe(admin.id);
            expect(row?.processedAt).toBeTruthy();
            expect(row?.transactionId).toBe(res.body.data.transactionId);

            const [transaction] = await db
                .select()
                .from(transactions)
                .where(eq(transactions.id, row!.transactionId!));
            expect(transaction?.type).toBe('WITHDRAWAL');
            expect(transaction?.status).toBe('COMPLETED');
            expect(transaction?.sourceType).toBe('WITHDRAWAL');
            expect(transaction?.sourceId).toBe(fixture.withdrawalId);
            expect(transaction?.referenceId).toMatch(/^[0-9A-V]{13}$/);
        });

        it('creates exactly one correct ledger entry for the debit', async () => {
            // Withdrawals model money leaving PayLedger to an external
            // bank account — like deposits (the mirror flow), the "other
            // side" is outside the ledger entirely, not the SYSTEM
            // wallet (which is reserved for fee revenue only). So a
            // single DEBIT entry is the correct, complete picture here;
            // there is no second leg for it to balance against within
            // this transaction.
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);
            const walletBefore = await getWallet(fixture.walletId);

            const res = await approveWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
            );
            expect(res.status).toBe(200);

            const entries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.walletId, fixture.walletId));

            expect(entries).toHaveLength(1);
            expect(entries[0]?.direction).toBe('DEBIT');
            expect(entries[0]?.amountPaise).toBe(100000n);
            expect(entries[0]?.balanceBeforePaise).toBe(
                walletBefore.balancePaise,
            );
            expect(entries[0]?.balanceAfterPaise).toBe(400000n);
        });

        it('rejects approval of an already-approved withdrawal', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const first = await approveWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
            );
            expect(first.status).toBe(200);

            const second = await approveWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
            );
            expect(second.status).toBe(409);
        });

        it('rejects approval of an already-rejected withdrawal', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const rejected = await rejectWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
                'Not eligible',
            );
            expect(rejected.status).toBe(200);

            const approveAfter = await approveWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
            );
            expect(approveAfter.status).toBe(409);
        });

        it('always stores the authenticated admin id, ignoring any client-supplied value', async () => {
            const admin = await createTestAdmin();
            const otherAdmin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const res = await approveWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
                { processedByAdminId: otherAdmin.id },
            );
            expect(res.status).toBe(200);

            const [row] = await db
                .select()
                .from(withdrawals)
                .where(eq(withdrawals.id, fixture.withdrawalId));

            expect(row?.processedByAdminId).toBe(admin.id);
            expect(row?.processedByAdminId).not.toBe(otherAdmin.id);
        });

        it('rolls back everything if the wallet operation fails mid-transaction', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            await db
                .update(wallets)
                .set({ status: WalletStatus.BLOCKED })
                .where(eq(wallets.id, fixture.walletId));

            try {
                const res = await approveWithdrawalReq(
                    admin.cookie,
                    fixture.withdrawalId,
                );

                expect(res.status).toBe(422);

                const [row] = await db
                    .select()
                    .from(withdrawals)
                    .where(eq(withdrawals.id, fixture.withdrawalId));
                expect(row?.status).toBe('PENDING');
                expect(row?.transactionId).toBeNull();

                const wallet = await getWallet(fixture.walletId);
                expect(wallet.balancePaise).toBe(500000n);
                expect(wallet.heldPaise).toBe(100000n);

                const txns = await db
                    .select()
                    .from(transactions)
                    .where(eq(transactions.sourceId, fixture.withdrawalId));
                expect(txns).toHaveLength(0);
            } finally {
                await db
                    .update(wallets)
                    .set({ status: WalletStatus.ACTIVE })
                    .where(eq(wallets.id, fixture.walletId));
            }
        });

        it('two concurrent approvals of the same withdrawal: exactly one succeeds', async () => {
            const adminA = await createTestAdmin();
            const adminB = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const [resA, resB] = await Promise.all([
                approveWithdrawalReq(adminA.cookie, fixture.withdrawalId),
                approveWithdrawalReq(adminB.cookie, fixture.withdrawalId),
            ]);

            const statuses = [resA.status, resB.status].sort();
            expect(statuses).toEqual([200, 409]);

            const wallet = await getWallet(fixture.walletId);
            expect(wallet.balancePaise).toBe(400000n);
            expect(wallet.heldPaise).toBe(0n);

            const entries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.walletId, fixture.walletId));
            expect(entries).toHaveLength(1);
        });

        it('concurrent approve + reject on the same withdrawal: exactly one succeeds, no mixed state', async () => {
            const adminA = await createTestAdmin();
            const adminB = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const [approveRes, rejectRes] = await Promise.all([
                approveWithdrawalReq(adminA.cookie, fixture.withdrawalId),
                rejectWithdrawalReq(
                    adminB.cookie,
                    fixture.withdrawalId,
                    'Racing rejection',
                ),
            ]);

            const outcomes = [approveRes.status, rejectRes.status].sort();
            expect(outcomes).toEqual([200, 409]);

            const [row] = await db
                .select()
                .from(withdrawals)
                .where(eq(withdrawals.id, fixture.withdrawalId));

            const wallet = await getWallet(fixture.walletId);

            if (approveRes.status === 200) {
                expect(row?.status).toBe('APPROVED');
                expect(row?.transactionId).toBeTruthy();
                expect(wallet.balancePaise).toBe(400000n);
                expect(wallet.heldPaise).toBe(0n);

                const txns = await db
                    .select()
                    .from(transactions)
                    .where(eq(transactions.sourceId, fixture.withdrawalId));
                expect(txns).toHaveLength(1);
            } else {
                expect(row?.status).toBe('REJECTED');
                expect(row?.transactionId).toBeNull();
                expect(wallet.balancePaise).toBe(500000n);
                expect(wallet.heldPaise).toBe(0n);

                const txns = await db
                    .select()
                    .from(transactions)
                    .where(eq(transactions.sourceId, fixture.withdrawalId));
                expect(txns).toHaveLength(0);
            }
        });
    });

    describe('POST /api/v1/admin/withdrawals/:id/reject', () => {
        it('rejects a pending withdrawal and releases the hold without any financial movement', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const res = await rejectWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
                'Unable to process withdrawal',
            );

            expect(res.status).toBe(200);
            expect(res.body.data).toMatchObject({
                id: fixture.withdrawalId,
                status: 'REJECTED',
                rejectionReason: 'Unable to process withdrawal',
            });
            expect(res.body.data.processedAt).toBeTruthy();

            const wallet = await getWallet(fixture.walletId);
            expect(wallet.balancePaise).toBe(500000n); // unchanged
            expect(wallet.heldPaise).toBe(0n); // released
            expect(wallet.balancePaise - wallet.heldPaise).toBe(500000n);

            const txns = await db
                .select()
                .from(transactions)
                .where(eq(transactions.sourceId, fixture.withdrawalId));
            expect(txns).toHaveLength(0);

            const entries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.walletId, fixture.walletId));
            expect(entries).toHaveLength(0);

            const [row] = await db
                .select()
                .from(withdrawals)
                .where(eq(withdrawals.id, fixture.withdrawalId));
            expect(row?.processedByAdminId).toBe(admin.id);
        });

        it('rejects rejection of an already-rejected withdrawal', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const first = await rejectWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
                'First reason',
            );
            expect(first.status).toBe(200);

            const second = await rejectWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
                'Second reason',
            );
            expect(second.status).toBe(409);
        });

        it('rejects rejection of an already-approved withdrawal', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const approved = await approveWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
            );
            expect(approved.status).toBe(200);

            const rejectAfter = await rejectWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
                'Too late',
            );
            expect(rejectAfter.status).toBe(409);
        });

        it('validates the rejection reason', async () => {
            const admin = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const res = await rejectWithdrawalReq(
                admin.cookie,
                fixture.withdrawalId,
                'x',
            );

            expect(res.status).toBe(422);
        });

        it('two concurrent rejections of the same withdrawal: exactly one succeeds', async () => {
            const adminA = await createTestAdmin();
            const adminB = await createTestAdmin();
            const fixture = await createUserWithWithdrawal(500000n, 1000);

            const [resA, resB] = await Promise.all([
                rejectWithdrawalReq(adminA.cookie, fixture.withdrawalId, 'First'),
                rejectWithdrawalReq(adminB.cookie, fixture.withdrawalId, 'Second'),
            ]);

            const statuses = [resA.status, resB.status].sort();
            expect(statuses).toEqual([200, 409]);

            const wallet = await getWallet(fixture.walletId);
            expect(wallet.balancePaise).toBe(500000n);
            expect(wallet.heldPaise).toBe(0n);

            const [row] = await db
                .select()
                .from(withdrawals)
                .where(eq(withdrawals.id, fixture.withdrawalId));
            expect(row?.status).toBe('REJECTED');
        });
    });
});
