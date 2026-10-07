import { describe, expect, it } from 'vitest';

import {
    createSnowflakeGenerator,
    encodeBase32Hex,
    generateBusinessId,
    MAX_WORKER_ID,
} from './business-id.js';

const SNOWFLAKE_EPOCH_MS = 1767225600000;
const BASE32HEX_PATTERN = /^[0-9A-V]{13}$/;
const BASE_MS = SNOWFLAKE_EPOCH_MS + 1_000_000;

/**
 * Returns `values[i]` on the i-th call, clamped to the last entry once
 * exhausted. Lets tests script exactly what the generator's internal
 * busy-wait loops observe on each poll, without depending on real time.
 */
const scriptedClock = (values: number[]): (() => number) => {
    let callIndex = 0;

    return () => {
        const index = Math.min(callIndex, values.length - 1);
        callIndex += 1;
        return values[index]!;
    };
};

describe('encodeBase32Hex', () => {
    it('encodes 0 as 13 zero characters', () => {
        expect(encodeBase32Hex(0n)).toBe('0'.repeat(13));
    });

    it('encodes 1 as a zero-padded 13-character string', () => {
        expect(encodeBase32Hex(1n)).toBe('0'.repeat(12) + '1');
    });

    it('encodes the maximum valid 63-bit value as 13 characters', () => {
        const max = (1n << 63n) - 1n;

        expect(encodeBase32Hex(max)).toBe('7' + 'V'.repeat(12));
    });

    it('rejects values that do not fit within 63 bits', () => {
        expect(() => encodeBase32Hex(1n << 63n)).toThrow();
        expect(() => encodeBase32Hex(-1n)).toThrow();
    });
});

describe('createSnowflakeGenerator', () => {
    it('rejects an out-of-range or non-integer worker ID', () => {
        expect(() => createSnowflakeGenerator(-1)).toThrow();
        expect(() => createSnowflakeGenerator(MAX_WORKER_ID + 1)).toThrow();
        expect(() => createSnowflakeGenerator(1.5)).toThrow();
        expect(() => createSnowflakeGenerator(Number.NaN)).toThrow();
    });

    it('accepts the boundary worker IDs 0 and 1023', () => {
        expect(() => createSnowflakeGenerator(0)).not.toThrow();
        expect(() => createSnowflakeGenerator(MAX_WORKER_ID)).not.toThrow();
    });

    it('encodes the worker ID into the generated ID', () => {
        const generator = createSnowflakeGenerator(
            777,
            scriptedClock([BASE_MS]),
        );

        const elapsed = BigInt(BASE_MS) - BigInt(SNOWFLAKE_EPOCH_MS);
        const expected = encodeBase32Hex((elapsed << 22n) | (777n << 12n));

        expect(generator.generate()).toBe(expected);
    });

    it('produces lexicographically increasing IDs for a real-time sequence', () => {
        const generator = createSnowflakeGenerator(1);

        let previous = generator.generate();

        for (let i = 0; i < 1000; i += 1) {
            const next = generator.generate();
            expect(next > previous).toBe(true);
            previous = next;
        }
    });

    it('rolls the sequence over to the next millisecond after 4096 IDs', () => {
        // 4097 reads hold the clock at BASE_MS (the first 4096 calls fill
        // sequence 0..4095, and the 4097th call's initial read lands on
        // BASE_MS again), then the clock finally advances on the next poll
        // inside the overflow spin.
        const clock = scriptedClock([
            ...Array<number>(4097).fill(BASE_MS),
            BASE_MS + 1,
        ]);
        const generator = createSnowflakeGenerator(1, clock);

        const ids = Array.from({ length: 4097 }, () => generator.generate());

        for (let i = 1; i < 4096; i += 1) {
            expect(ids[i]! > ids[i - 1]!).toBe(true);
        }

        expect(ids[4096]! > ids[4095]!).toBe(true);
    });

    it('waits out a small clock rollback instead of failing', () => {
        const clock = scriptedClock([
            BASE_MS,
            BASE_MS - 3,
            BASE_MS - 1,
            BASE_MS,
        ]);
        const generator = createSnowflakeGenerator(1, clock);

        const first = generator.generate();
        const second = generator.generate();

        expect(second > first).toBe(true);
    });

    it('throws when the clock rolls back more than 5ms', () => {
        const clock = scriptedClock([BASE_MS, BASE_MS - 6]);
        const generator = createSnowflakeGenerator(1, clock);

        generator.generate();
        expect(() => generator.generate()).toThrow();
    });

    it('throws when the current time is before the Snowflake epoch', () => {
        const generator = createSnowflakeGenerator(
            1,
            scriptedClock([SNOWFLAKE_EPOCH_MS - 1]),
        );

        expect(() => generator.generate()).toThrow();
    });

    it('throws when elapsed time exceeds the 41-bit timestamp range', () => {
        const beyondRange = SNOWFLAKE_EPOCH_MS + Number(1n << 41n);
        const generator = createSnowflakeGenerator(
            1,
            scriptedClock([beyondRange]),
        );

        expect(() => generator.generate()).toThrow();
    });

    it('does not duplicate IDs across many synchronous/microtask-interleaved calls', async () => {
        const generator = createSnowflakeGenerator(1);

        const ids = await Promise.all(
            Array.from({ length: 5000 }, () =>
                Promise.resolve().then(() => generator.generate()),
            ),
        );

        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('generateBusinessId', () => {
    it('returns a 13-character uppercase base32hex string', () => {
        const id = generateBusinessId();

        expect(id).toHaveLength(13);
        expect(id).toMatch(BASE32HEX_PATTERN);
    });

    it('generates 10,000 unique IDs', () => {
        const ids = Array.from({ length: 10_000 }, () => generateBusinessId());

        expect(new Set(ids).size).toBe(ids.length);

        for (const id of ids) {
            expect(id).toMatch(BASE32HEX_PATTERN);
        }
    });

    it('is lexicographically increasing, matching generation order', () => {
        const ids = Array.from({ length: 2000 }, () => generateBusinessId());

        for (let i = 1; i < ids.length; i += 1) {
            expect(ids[i]! > ids[i - 1]!).toBe(true);
        }
    });

    it('does not duplicate IDs across concurrent callers', async () => {
        const ids = await Promise.all(
            Array.from({ length: 5000 }, () =>
                Promise.resolve().then(() => generateBusinessId()),
            ),
        );

        expect(new Set(ids).size).toBe(ids.length);
    });
});
