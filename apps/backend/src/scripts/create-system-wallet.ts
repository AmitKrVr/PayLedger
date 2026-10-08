import { closeConnection, db, wallets, WalletStatus, WalletType } from '@payledger/database';
import { eq } from 'drizzle-orm';

/**
 * PayLedger requires exactly one SYSTEM wallet (used for transfer fee
 * collection, see transfer.repository.ts's findSystemWallet()). It is not
 * created by a migration (it is data, not schema) and no code path creates
 * one lazily -- a transfer fails with "System wallet is not configured" if
 * it's missing. This script is the one idempotent, intended way to create
 * it: safe to run on a fresh database and safe to re-run on an existing one.
 *
 * Uniqueness is enforced by the database itself (wallets_system_singleton_idx,
 * a partial unique index on wallet_type = 'SYSTEM'), the same way every
 * other idempotent create-flow in this codebase (createPayment,
 * createWithdrawal, createTransfer) treats its own unique index as the
 * final source of truth rather than trusting the check-then-insert alone --
 * two instances of this script racing each other both pass the initial
 * SELECT, but only one INSERT can win; the loser reports the winner's row
 * instead of erroring.
 */
const isUniqueViolation = (error: unknown): boolean => {
    const code =
        (error as { cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code;

    return code === '23505';
};

async function createSystemWallet(): Promise<void> {
    try {
        const [existing] = await db
            .select({ id: wallets.id })
            .from(wallets)
            .where(eq(wallets.walletType, WalletType.SYSTEM))
            .limit(1);

        if (existing) {
            console.log('SYSTEM wallet already exists. No changes made.');
            console.log(`  id: ${existing.id}`);
            return;
        }

        try {
            const [created] = await db
                .insert(wallets)
                .values({
                    userId: null,
                    walletType: WalletType.SYSTEM,
                    status: WalletStatus.ACTIVE,
                })
                .returning();

            if (!created) {
                throw new Error('Failed to create the SYSTEM wallet.');
            }

            console.log('Created the SYSTEM wallet.');
            console.log(`  id:                  ${created.id}`);
            console.log(`  walletType:          ${created.walletType}`);
            console.log(`  userId:              ${created.userId}`);
            console.log(`  balancePaise:        ${created.balancePaise}`);
            console.log(`  heldPaise:           ${created.heldPaise}`);
            console.log(`  totalCreditedPaise:  ${created.totalCreditedPaise}`);
            console.log(`  totalDebitedPaise:   ${created.totalDebitedPaise}`);
            console.log(`  currency:            ${created.currency}`);
            console.log(`  status:              ${created.status}`);
        } catch (error) {
            // Lost a race against another instance of this same script --
            // the database's own unique index is what actually prevented
            // the duplicate; re-read and report its winner, not an error.
            if (isUniqueViolation(error)) {
                const [winner] = await db
                    .select({ id: wallets.id })
                    .from(wallets)
                    .where(eq(wallets.walletType, WalletType.SYSTEM))
                    .limit(1);

                console.log('SYSTEM wallet already exists. No changes made.');
                console.log(`  id: ${winner?.id}`);
                return;
            }

            throw error;
        }
    } finally {
        await closeConnection();
    }
}

createSystemWallet().catch((error) => {
    console.error('Failed to create the SYSTEM wallet:', error);
    process.exitCode = 1;
});
