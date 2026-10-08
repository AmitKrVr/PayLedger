import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    admins,
    adminSessions,
    auditLogs,
    ledgerEntries,
    transactions,
    transfers,
    users,
    wallets,
    AdminRole,
    AdminStatus,
    WalletStatus,
    WalletType,
} from '@payledger/database';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../../../app.js';
import { hashPassword } from '../../../lib/auth/auth.js';

import { loginAdmin } from '../auth/admin-auth.service.js';
import { register } from '../../auth/auth.service.js';
import { findWalletByUserId } from '../../wallet/wallet.repository.js';
import { createTransfer } from '../../transfer/transfer.service.js';

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
        cookie: `access_token=${result.accessToken}`,
    };
};

const createTestUser = async (balancePaise: bigint) => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        {
            name: `Admin Transfer Test ${Math.random().toString(36).slice(2, 8)}`,
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

    return {
        userId: result.user.id,
        userName: result.user.name,
        walletId: wallet.id,
        userCookie: `access_token=${result.accessToken}`,
    };
};

/** Creates a sender (with the given balance) and receiver, then completes
 * a real transfer of `amountInr` between them via the Transfer domain's
 * own service (never faked), returning everything a reversal test needs. */
const createCompletedTransfer = async (
    senderBalancePaise: bigint,
    amountInr: number,
) => {
    const sender = await createTestUser(senderBalancePaise);
    const receiver = await createTestUser(0n);

    const transfer = await createTransfer(
        sender.userId,
        { recipientUserId: receiver.userId, amount: amountInr },
        randomUUID(),
    );

    return { sender, receiver, transfer };
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

const getTransfer = async (transferId: string) => {
    const [transfer] = await db
        .select()
        .from(transfers)
        .where(eq(transfers.id, transferId))
        .limit(1);

    if (!transfer) {
        throw new Error('Transfer not found');
    }

    return transfer;
};

const reverseTransferReq = (cookie: string, transferId: string) =>
    request(app)
        .post(`/api/v1/admin/transfers/${transferId}/reverse`)
        .set('Cookie', cookie)
        .send({});

describe('Admin Transfer Reversal domain', () => {
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
                    .where(
                        inArray(ledgerEntries.transactionId, transactionIds),
                    );
            }

            if (walletIds.length > 0) {
                await db
                    .delete(transfers)
                    .where(inArray(transfers.senderWalletId, walletIds));
                await db
                    .delete(transfers)
                    .where(inArray(transfers.receiverWalletId, walletIds));
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

    describe('POST /api/v1/admin/transfers/:id/reverse', () => {
        it('reverses a completed transfer successfully', async () => {
            const admin = await createTestAdmin();
            const { sender, receiver, transfer } =
                await createCompletedTransfer(100000n, 500); // ₹1,000 balance, ₹500 transfer
            const transferRow = await getTransfer(transfer.id);

            const res = await reverseTransferReq(admin.cookie, transfer.id);

            expect(res.status).toBe(200);
            expect(res.body.data).toMatchObject({
                transferId: transfer.id,
                status: 'REVERSED',
            });
            expect(res.body.data.reversalTransactionId).toBeTruthy();
            expect(res.body.data.referenceId).toMatch(/^[0-9A-V]{13}$/);
            expect(res.body.data.processedAt).toBeTruthy();
            expect(res.body.data.senderWalletId).toBeUndefined();
            expect(res.body.data.balancePaise).toBeUndefined();

            const senderWallet = await getWallet(sender.walletId);
            const receiverWallet = await getWallet(receiver.walletId);
            // Sender gets back exactly the amount; the fee is never
            // refunded.
            expect(senderWallet.balancePaise).toBe(
                100000n - transferRow.feePaise,
            );
            expect(receiverWallet.balancePaise).toBe(0n);
        });

        it('marks the original transfer REVERSED and leaves every other field unchanged', async () => {
            const admin = await createTestAdmin();
            const { transfer } = await createCompletedTransfer(100000n, 500);
            const before = await getTransfer(transfer.id);

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(200);

            const after = await getTransfer(transfer.id);
            expect(after.status).toBe('REVERSED');
            expect(after.transactionId).toBe(before.transactionId);
            expect(after.senderWalletId).toBe(before.senderWalletId);
            expect(after.receiverWalletId).toBe(before.receiverWalletId);
            expect(after.amountPaise).toBe(before.amountPaise);
            expect(after.feePaise).toBe(before.feePaise);
            expect(after.totalPaise).toBe(before.totalPaise);
            expect(after.completedAt?.getTime()).toBe(
                before.completedAt?.getTime(),
            );
        });

        it('never modifies the original transaction or its ledger entries', async () => {
            const admin = await createTestAdmin();
            const { transfer } = await createCompletedTransfer(100000n, 500);
            const originalTransactionId = (await getTransfer(transfer.id))
                .transactionId;

            const [originalTxBefore] = await db
                .select()
                .from(transactions)
                .where(eq(transactions.id, originalTransactionId));
            const ledgerBefore = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.transactionId, originalTransactionId));

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(200);

            const [originalTxAfter] = await db
                .select()
                .from(transactions)
                .where(eq(transactions.id, originalTransactionId));
            expect(originalTxAfter).toEqual(originalTxBefore);

            const ledgerAfter = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.transactionId, originalTransactionId));
            expect(ledgerAfter).toEqual(ledgerBefore);
        });

        it('creates a new TRANSFER_REVERSAL transaction with correct type/status/source/reference', async () => {
            const admin = await createTestAdmin();
            const { transfer } = await createCompletedTransfer(100000n, 500);

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(200);

            const [reversalTx] = await db
                .select()
                .from(transactions)
                .where(eq(transactions.id, res.body.data.reversalTransactionId));

            expect(reversalTx?.type).toBe('TRANSFER_REVERSAL');
            expect(reversalTx?.status).toBe('COMPLETED');
            expect(reversalTx?.sourceType).toBe('REVERSAL');
            expect(reversalTx?.sourceId).toBe(transfer.id);
            expect(reversalTx?.referenceId).toBe(res.body.data.referenceId);
            expect(reversalTx?.referenceId).toMatch(/^[0-9A-V]{13}$/);
        });

        it('debits the receiver and credits the sender by exactly the original amount (fee not returned)', async () => {
            const admin = await createTestAdmin();
            const { sender, receiver, transfer } =
                await createCompletedTransfer(200000n, 1000); // ₹2,000 balance, ₹1,000 transfer

            const senderBeforeReversal = await getWallet(sender.walletId);
            const receiverBeforeReversal = await getWallet(receiver.walletId);
            const transferRow = await getTransfer(transfer.id);

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(200);

            const senderAfter = await getWallet(sender.walletId);
            const receiverAfter = await getWallet(receiver.walletId);

            expect(senderAfter.balancePaise).toBe(
                senderBeforeReversal.balancePaise + transferRow.amountPaise,
            );
            expect(receiverAfter.balancePaise).toBe(
                receiverBeforeReversal.balancePaise - transferRow.amountPaise,
            );
            // Fee stays with the sender's original debit forever.
            expect(senderAfter.balancePaise).toBe(
                200000n - transferRow.feePaise,
            );
        });

        it('leaves the system (fee) wallet balance untouched', async () => {
            const admin = await createTestAdmin();
            const { transfer } = await createCompletedTransfer(200000n, 1000);

            const [systemWalletBefore] = await db
                .select()
                .from(wallets)
                .where(eq(wallets.walletType, WalletType.SYSTEM));

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(200);

            const [systemWalletAfter] = await db
                .select()
                .from(wallets)
                .where(eq(wallets.walletType, WalletType.SYSTEM));

            expect(systemWalletAfter?.balancePaise).toBe(
                systemWalletBefore?.balancePaise,
            );
        });

        it('creates a balanced reversal ledger: receiver DEBIT, sender CREDIT, signed sum zero, correct before/after balances', async () => {
            const admin = await createTestAdmin();
            const { sender, receiver, transfer } =
                await createCompletedTransfer(100000n, 500);

            const senderBefore = await getWallet(sender.walletId);
            const receiverBefore = await getWallet(receiver.walletId);
            const transferRow = await getTransfer(transfer.id);

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(200);

            const entries = await db
                .select()
                .from(ledgerEntries)
                .where(
                    eq(
                        ledgerEntries.transactionId,
                        res.body.data.reversalTransactionId,
                    ),
                );

            expect(entries).toHaveLength(2);

            const receiverEntry = entries.find(
                (e) => e.walletId === receiver.walletId,
            );
            const senderEntry = entries.find(
                (e) => e.walletId === sender.walletId,
            );

            expect(receiverEntry?.direction).toBe('DEBIT');
            expect(receiverEntry?.amountPaise).toBe(transferRow.amountPaise);
            expect(receiverEntry?.balanceBeforePaise).toBe(
                receiverBefore.balancePaise,
            );
            expect(receiverEntry?.balanceAfterPaise).toBe(
                receiverBefore.balancePaise - transferRow.amountPaise,
            );

            expect(senderEntry?.direction).toBe('CREDIT');
            expect(senderEntry?.amountPaise).toBe(transferRow.amountPaise);
            expect(senderEntry?.balanceBeforePaise).toBe(
                senderBefore.balancePaise,
            );
            expect(senderEntry?.balanceAfterPaise).toBe(
                senderBefore.balancePaise + transferRow.amountPaise,
            );

            const signedSum = entries.reduce((sum, e) => {
                const signed =
                    e.direction === 'CREDIT' ? e.amountPaise : -e.amountPaise;
                return sum + signed;
            }, 0n);
            expect(signedSum).toBe(0n);
        });

        it('rejects reversal when receiver has insufficient available balance', async () => {
            const admin = await createTestAdmin();
            const { receiver, transfer } = await createCompletedTransfer(
                100000n,
                500,
            );

            // Receiver spent the money already.
            await db
                .update(wallets)
                .set({ balancePaise: 0n })
                .where(eq(wallets.id, receiver.walletId));

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(422);

            const after = await getTransfer(transfer.id);
            expect(after.status).toBe('COMPLETED');
        });

        it('rejects reversal when receiver has enough total balance but insufficient available due to held funds', async () => {
            const admin = await createTestAdmin();
            const { receiver, transfer } = await createCompletedTransfer(
                100000n,
                500,
            );

            // Receiver's balance covers it, but it's all held (e.g. by a
            // pending withdrawal) — available must still gate the debit.
            const receiverWallet = await getWallet(receiver.walletId);
            await db
                .update(wallets)
                .set({ heldPaise: receiverWallet.balancePaise })
                .where(eq(wallets.id, receiver.walletId));

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(422);

            const after = await getTransfer(transfer.id);
            expect(after.status).toBe('COMPLETED');

            const walletAfter = await getWallet(receiver.walletId);
            expect(walletAfter.balancePaise).toBe(
                receiverWallet.balancePaise,
            );
            expect(walletAfter.heldPaise).toBe(receiverWallet.balancePaise);
        });

        it('leaves no partial state when rejected for insufficient balance', async () => {
            const admin = await createTestAdmin();
            const { sender, receiver, transfer } =
                await createCompletedTransfer(100000n, 500);
            const transferRow = await getTransfer(transfer.id);
            const senderBefore = await getWallet(sender.walletId);

            await db
                .update(wallets)
                .set({ balancePaise: 0n })
                .where(eq(wallets.id, receiver.walletId));

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(422);

            const senderAfter = await getWallet(sender.walletId);
            expect(senderAfter.balancePaise).toBe(senderBefore.balancePaise);
            expect(senderAfter.balancePaise).toBe(
                100000n - transferRow.totalPaise,
            );

            const txns = await db
                .select()
                .from(transactions)
                .where(eq(transactions.sourceId, transfer.id));
            expect(
                txns.filter((t) => t.sourceType === 'REVERSAL'),
            ).toHaveLength(0);
        });

        it('rejects reversal of a PENDING transfer', async () => {
            const admin = await createTestAdmin();
            const { transfer } = await createCompletedTransfer(100000n, 500);

            await db
                .update(transfers)
                .set({ status: 'PENDING' })
                .where(eq(transfers.id, transfer.id));

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(409);
        });

        it('rejects reversal of a FAILED transfer', async () => {
            const admin = await createTestAdmin();
            const { transfer } = await createCompletedTransfer(100000n, 500);

            await db
                .update(transfers)
                .set({ status: 'FAILED' })
                .where(eq(transfers.id, transfer.id));

            const res = await reverseTransferReq(admin.cookie, transfer.id);
            expect(res.status).toBe(409);
        });

        it('rejects reversing an already-reversed transfer', async () => {
            const admin = await createTestAdmin();
            const { transfer } = await createCompletedTransfer(100000n, 500);

            const first = await reverseTransferReq(admin.cookie, transfer.id);
            expect(first.status).toBe(200);

            const second = await reverseTransferReq(admin.cookie, transfer.id);
            expect(second.status).toBe(409);
        });

        it('returns 404 for a non-existent transfer', async () => {
            const admin = await createTestAdmin();

            const res = await reverseTransferReq(admin.cookie, randomUUID());
            expect(res.status).toBe(404);
        });

        it('rejects a non-admin (user) token', async () => {
            const { sender, transfer } = await createCompletedTransfer(
                100000n,
                500,
            );

            const res = await reverseTransferReq(
                sender.userCookie,
                transfer.id,
            );
            expect(res.status).toBe(401);
        });

        it('validates the transfer id path param', async () => {
            const admin = await createTestAdmin();

            const res = await reverseTransferReq(admin.cookie, 'not-a-uuid');
            expect(res.status).toBe(422);
        });

        it('records the authenticated admin identity in the audit log, never from the request body', async () => {
            const admin = await createTestAdmin();
            const otherAdmin = await createTestAdmin();
            const { transfer } = await createCompletedTransfer(100000n, 500);

            const res = await request(app)
                .post(`/api/v1/admin/transfers/${transfer.id}/reverse`)
                .set('Cookie', admin.cookie)
                .send({ adminId: otherAdmin.id });

            expect(res.status).toBe(200);

            const logs = await db
                .select()
                .from(auditLogs)
                .where(eq(auditLogs.targetId, transfer.id));
            const entry = logs.find(
                (log) => log.action === 'TRANSFER_REVERSED',
            );

            expect(entry).toBeTruthy();
            expect(entry?.actorAdminId).toBe(admin.id);
            expect(entry?.actorAdminId).not.toBe(otherAdmin.id);
        });

        it('rolls back everything if the receiver debit fails mid-transaction', async () => {
            const admin = await createTestAdmin();
            const { sender, receiver, transfer } =
                await createCompletedTransfer(100000n, 500);
            const senderBefore = await getWallet(sender.walletId);

            await db
                .update(wallets)
                .set({ status: WalletStatus.BLOCKED })
                .where(eq(wallets.id, receiver.walletId));

            try {
                const res = await reverseTransferReq(
                    admin.cookie,
                    transfer.id,
                );

                expect(res.status).toBe(422);

                const after = await getTransfer(transfer.id);
                expect(after.status).toBe('COMPLETED');

                const senderWallet = await getWallet(sender.walletId);
                expect(senderWallet.balancePaise).toBe(
                    senderBefore.balancePaise,
                );

                const txns = await db
                    .select()
                    .from(transactions)
                    .where(eq(transactions.sourceId, transfer.id));
                expect(
                    txns.filter((t) => t.sourceType === 'REVERSAL'),
                ).toHaveLength(0);
            } finally {
                await db
                    .update(wallets)
                    .set({ status: WalletStatus.ACTIVE })
                    .where(eq(wallets.id, receiver.walletId));
            }
        });

        it('two concurrent reversals of the same transfer: exactly one succeeds', async () => {
            const adminA = await createTestAdmin();
            const adminB = await createTestAdmin();
            const { sender, receiver, transfer } =
                await createCompletedTransfer(100000n, 500);
            const transferRow = await getTransfer(transfer.id);

            const [resA, resB] = await Promise.all([
                reverseTransferReq(adminA.cookie, transfer.id),
                reverseTransferReq(adminB.cookie, transfer.id),
            ]);

            const statuses = [resA.status, resB.status].sort();
            expect(statuses).toEqual([200, 409]);

            const after = await getTransfer(transfer.id);
            expect(after.status).toBe('REVERSED');

            const senderWallet = await getWallet(sender.walletId);
            const receiverWallet = await getWallet(receiver.walletId);
            expect(senderWallet.balancePaise).toBe(
                100000n - transferRow.feePaise,
            );
            expect(receiverWallet.balancePaise).toBe(0n);

            const txns = await db
                .select()
                .from(transactions)
                .where(eq(transactions.sourceId, transfer.id));
            const reversalTxns = txns.filter(
                (t) => t.sourceType === 'REVERSAL',
            );
            expect(reversalTxns).toHaveLength(1);

            const entries = await db
                .select()
                .from(ledgerEntries)
                .where(eq(ledgerEntries.transactionId, reversalTxns[0]!.id));
            expect(entries).toHaveLength(2);
        });
    });
});
