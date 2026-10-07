import { env } from '@payledger/config';

/**
 * PayLedger business/reference ID generator. One-way only — there is no
 * decode, callers only ever see the final string.
 *
 *   current timestamp -> Snowflake 63-bit integer -> Base32hex -> 13 chars
 *
 * Snowflake, 63 bits total:
 *   41 bits  timestamp   (ms since SNOWFLAKE_EPOCH_MS)
 *   10 bits  worker ID   (0-1023, one value per running process)
 *   12 bits  sequence    (0-4095, resets every millisecond)
 *
 * Base32hex (RFC 4648 §7 — NOT standard Base32, NOT Crockford):
 *   alphabet "0123456789ABCDEFGHIJKLMNOPQRSTUV"
 *   63-bit value -> fixed 13-character output (ceil(63 / 5))
 */

const TIMESTAMP_BITS = 41;
const WORKER_ID_BITS = 10;
const SEQUENCE_BITS = 12;

export const MAX_WORKER_ID = 2 ** WORKER_ID_BITS - 1;
const MAX_SEQUENCE = 2n ** BigInt(SEQUENCE_BITS) - 1n;

const WORKER_ID_SHIFT = BigInt(SEQUENCE_BITS);
const TIMESTAMP_SHIFT = BigInt(WORKER_ID_BITS + SEQUENCE_BITS);

/** 2026-01-01T00:00:00.000Z */
const SNOWFLAKE_EPOCH_MS = 1767225600000n;

const MAX_ELAPSED_MS = 1n << BigInt(TIMESTAMP_BITS);
const MAX_CLOCK_ROLLBACK_MS = 5n;

const BASE32HEX_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
const BASE32HEX_BITS_PER_CHARACTER = 5;
const BUSINESS_ID_LENGTH = 13; // ceil(63 / 5)
const CHARACTER_MASK = 0b11111n;

/**
 * Encodes a 63-bit value into exactly 13 base32hex characters. Internal —
 * exported only so tests can check known values directly.
 */
export const encodeBase32Hex = (value: bigint): string => {
    if (value < 0n || value > (1n << 63n) - 1n) {
        throw new RangeError(`Value ${value} does not fit within 63 bits`);
    }

    let id = '';

    for (
        let shift = (BUSINESS_ID_LENGTH - 1) * BASE32HEX_BITS_PER_CHARACTER;
        shift >= 0;
        shift -= BASE32HEX_BITS_PER_CHARACTER
    ) {
        const charIndex = Number((value >> BigInt(shift)) & CHARACTER_MASK);
        id += BASE32HEX_ALPHABET[charIndex];
    }

    return id;
};

export type SnowflakeGenerator = {
    generate: () => string;
};

const assertValidWorkerId = (workerId: number): void => {
    if (
        !Number.isInteger(workerId) ||
        workerId < 0 ||
        workerId > MAX_WORKER_ID
    ) {
        throw new RangeError(
            `Snowflake worker ID must be an integer between 0 and ${MAX_WORKER_ID}, received ${workerId}`,
        );
    }
};

/**
 * Creates one Snowflake-backed business ID generator. The caller is
 * responsible for keeping exactly one instance per process.
 *
 * `now` defaults to `Date.now` and exists so tests can drive the clock
 * deterministically instead of depending on real wall-clock timing.
 */
export const createSnowflakeGenerator = (
    workerId: number,
    now: () => number = Date.now,
): SnowflakeGenerator => {
    assertValidWorkerId(workerId);

    const workerIdBits = BigInt(workerId) << WORKER_ID_SHIFT;

    let lastTimestampMs = -1n;
    let sequence = 0n;

    /**
     * generate() is fully synchronous and never awaits. Node's event loop
     * cannot interleave another call in the middle of a synchronous
     * function, so `lastTimestampMs`/`sequence` are implicitly protected
     * for the whole call — the single-threaded-runtime equivalent of
     * guarding them with a mutex.
     */
    const generate = (): string => {
        let timestampMs = BigInt(Math.trunc(now()));

        if (timestampMs < SNOWFLAKE_EPOCH_MS) {
            throw new RangeError(
                'Current time is before the Snowflake epoch',
            );
        }

        if (timestampMs < lastTimestampMs) {
            const rollbackMs = lastTimestampMs - timestampMs;

            if (rollbackMs > MAX_CLOCK_ROLLBACK_MS) {
                throw new Error(
                    `Clock moved backwards by ${rollbackMs}ms, refusing to generate a Snowflake ID`,
                );
            }

            while (timestampMs < lastTimestampMs) {
                timestampMs = BigInt(Math.trunc(now()));
            }
        }

        let nextSequence: bigint;

        if (timestampMs === lastTimestampMs) {
            nextSequence = (sequence + 1n) & MAX_SEQUENCE;

            if (nextSequence === 0n) {
                // Sequence space for this millisecond is exhausted; spin
                // until the clock actually reaches the next millisecond.
                do {
                    timestampMs = BigInt(Math.trunc(now()));
                } while (timestampMs <= lastTimestampMs);
            }
        } else {
            nextSequence = 0n;
        }

        const elapsedMs = timestampMs - SNOWFLAKE_EPOCH_MS;

        if (elapsedMs >= MAX_ELAPSED_MS) {
            throw new RangeError(
                'Current time exceeds the 41-bit Snowflake timestamp range',
            );
        }

        sequence = nextSequence;
        lastTimestampMs = timestampMs;

        // 41 + 10 + 12 = 63 bits, always <= 2^63 - 1 by construction.
        const value = (elapsedMs << TIMESTAMP_SHIFT) | workerIdBits | sequence;

        return encodeBase32Hex(value);
    };

    return { generate };
};

/**
 * One generator for this process. Every call to generateBusinessId() in
 * this process shares this instance's timestamp/sequence state — it must
 * never be re-created per call or per domain.
 */
const snowflakeGenerator = createSnowflakeGenerator(
    env.SNOWFLAKE_WORKER_ID,
);

/**
 * Generates PayLedger's shared 13-character business/reference ID.
 * Callers never see the numeric Snowflake value, its bit layout, or the
 * Base32 encoding — this is the only function domains should use.
 */
export const generateBusinessId = (): string =>
    snowflakeGenerator.generate();
