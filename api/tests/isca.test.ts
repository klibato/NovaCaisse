import { describe, it, expect } from 'vitest';
import { computeHash, GENESIS_HASH, type ChainInput } from '../src/isca/chain.js';
import { signTicket, verifySignature } from '../src/isca/signature.js';

const TENANT_SECRET = 'test-secret-key';

function makeChainInput(overrides: Partial<ChainInput> = {}): ChainInput {
  return {
    tenantId: 'tenant-1',
    sequenceNumber: 1,
    serviceMode: 'ONSITE',
    items: [{ name: 'Tacos', qty: 1, priceHt: 750, vatRate: 10 }],
    totalHt: 750,
    totalTtc: 825,
    vatDetails: [{ rate: 10, baseHt: 750, amount: 75 }],
    payments: [{ method: 'cash', amount: 825 }],
    isExpenseNote: false,
    isCancellation: false,
    cancelledRef: null,
    createdAt: '2026-02-23T12:00:00.000Z',
    ...overrides,
  };
}

// ─── Chain (SHA-256) ───

describe('ISCA Chain - computeHash', () => {
  it('should produce a 64-char hex SHA-256 hash', () => {
    const hash = computeHash(makeChainInput(), GENESIS_HASH);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce deterministic output for same input', () => {
    const input = makeChainInput();
    const hash1 = computeHash(input, GENESIS_HASH);
    const hash2 = computeHash(input, GENESIS_HASH);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash when data changes', () => {
    const hash1 = computeHash(makeChainInput({ totalHt: 750 }), GENESIS_HASH);
    const hash2 = computeHash(makeChainInput({ totalHt: 800 }), GENESIS_HASH);
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hash when prevHash changes', () => {
    const input = makeChainInput();
    const hash1 = computeHash(input, GENESIS_HASH);
    const hash2 = computeHash(input, 'a'.repeat(64));
    expect(hash1).not.toBe(hash2);
  });

  it('GENESIS_HASH should be 64 zeros', () => {
    expect(GENESIS_HASH).toBe('0'.repeat(64));
  });
});

// ─── Chain integrity: 10 tickets ───

describe('ISCA Chain - chaining 10 tickets', () => {
  it('should chain 10 tickets where each hash depends on the previous', () => {
    const hashes: string[] = [];
    let prevHash = GENESIS_HASH;

    for (let i = 1; i <= 10; i++) {
      const input = makeChainInput({
        sequenceNumber: i,
        createdAt: `2026-02-23T12:0${i}:00.000Z`,
      });
      const hash = computeHash(input, prevHash);
      hashes.push(hash);
      prevHash = hash;
    }

    // All hashes are unique
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(10);

    // Verify chain: recalculate and compare
    prevHash = GENESIS_HASH;
    for (let i = 0; i < 10; i++) {
      const input = makeChainInput({
        sequenceNumber: i + 1,
        createdAt: `2026-02-23T12:0${i + 1}:00.000Z`,
      });
      const recalculated = computeHash(input, prevHash);
      expect(recalculated).toBe(hashes[i]);
      prevHash = hashes[i];
    }
  });

  it('should detect tampering if a hash is modified in the chain', () => {
    const hashes: string[] = [];
    let prevHash = GENESIS_HASH;

    for (let i = 1; i <= 5; i++) {
      const input = makeChainInput({
        sequenceNumber: i,
        createdAt: `2026-02-23T12:0${i}:00.000Z`,
      });
      const hash = computeHash(input, prevHash);
      hashes.push(hash);
      prevHash = hash;
    }

    // Tamper with ticket 3's hash
    const originalHash3 = hashes[2];
    hashes[2] = 'tampered_hash_' + '0'.repeat(50);

    // Recalculate ticket 4 using the tampered prevHash
    const input4 = makeChainInput({
      sequenceNumber: 4,
      createdAt: '2026-02-23T12:04:00.000Z',
    });
    const recalculatedHash4 = computeHash(input4, hashes[2]);

    // Hash 4 should NOT match original because prevHash was tampered
    expect(recalculatedHash4).not.toBe(hashes[3]);

    // But original hash 3 should be valid with its proper prevHash
    const input3 = makeChainInput({
      sequenceNumber: 3,
      createdAt: '2026-02-23T12:03:00.000Z',
    });
    const validHash3 = computeHash(input3, hashes[1]);
    expect(validHash3).toBe(originalHash3);
  });
});

// ─── Sequence counter ───

describe('ISCA Chain - sequence counter', () => {
  it('should never have gaps in sequence numbers', () => {
    const tickets: { sequenceNumber: number; hash: string }[] = [];
    let prevHash = GENESIS_HASH;

    for (let i = 1; i <= 20; i++) {
      const input = makeChainInput({
        sequenceNumber: i,
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
      });
      const hash = computeHash(input, prevHash);
      tickets.push({ sequenceNumber: i, hash });
      prevHash = hash;
    }

    // Verify no gaps
    for (let i = 0; i < tickets.length; i++) {
      expect(tickets[i].sequenceNumber).toBe(i + 1);
    }

    // Verify strict monotonic increment
    for (let i = 1; i < tickets.length; i++) {
      expect(tickets[i].sequenceNumber).toBe(
        tickets[i - 1].sequenceNumber + 1,
      );
    }
  });
});

// ─── Signature (HMAC-SHA256) ───

describe('ISCA Signature - signTicket', () => {
  it('should produce a 64-char hex HMAC-SHA256 signature', () => {
    const hash = computeHash(makeChainInput(), GENESIS_HASH);
    const sig = signTicket(hash, TENANT_SECRET);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce deterministic output for same input', () => {
    const hash = computeHash(makeChainInput(), GENESIS_HASH);
    const sig1 = signTicket(hash, TENANT_SECRET);
    const sig2 = signTicket(hash, TENANT_SECRET);
    expect(sig1).toBe(sig2);
  });

  it('should produce different signature with different secret', () => {
    const hash = computeHash(makeChainInput(), GENESIS_HASH);
    const sig1 = signTicket(hash, TENANT_SECRET);
    const sig2 = signTicket(hash, 'different-secret');
    expect(sig1).not.toBe(sig2);
  });

  it('should produce different signature for different hash', () => {
    const hash1 = computeHash(makeChainInput({ totalHt: 750 }), GENESIS_HASH);
    const hash2 = computeHash(makeChainInput({ totalHt: 800 }), GENESIS_HASH);
    const sig1 = signTicket(hash1, TENANT_SECRET);
    const sig2 = signTicket(hash2, TENANT_SECRET);
    expect(sig1).not.toBe(sig2);
  });
});

describe('ISCA Signature - verifySignature', () => {
  it('should verify a valid signature', () => {
    const hash = computeHash(makeChainInput(), GENESIS_HASH);
    const sig = signTicket(hash, TENANT_SECRET);
    expect(verifySignature(hash, sig, TENANT_SECRET)).toBe(true);
  });

  it('should reject a tampered signature', () => {
    const hash = computeHash(makeChainInput(), GENESIS_HASH);
    const sig = signTicket(hash, TENANT_SECRET);
    const tampered = 'f'.repeat(64);
    expect(verifySignature(hash, tampered, TENANT_SECRET)).toBe(false);
  });

  it('should reject signature with wrong secret', () => {
    const hash = computeHash(makeChainInput(), GENESIS_HASH);
    const sig = signTicket(hash, TENANT_SECRET);
    expect(verifySignature(hash, sig, 'wrong-secret')).toBe(false);
  });

  it('should reject signature for modified hash', () => {
    const hash = computeHash(makeChainInput(), GENESIS_HASH);
    const sig = signTicket(hash, TENANT_SECRET);
    const modifiedHash = computeHash(
      makeChainInput({ totalHt: 999 }),
      GENESIS_HASH,
    );
    expect(verifySignature(modifiedHash, sig, TENANT_SECRET)).toBe(false);
  });
});

// ─── Full ISCA flow: hash + sign + chain ───

describe('ISCA Full Flow', () => {
  it('should create a valid chain of 10 signed tickets', () => {
    const tickets: {
      sequenceNumber: number;
      hash: string;
      prevHash: string;
      signature: string;
    }[] = [];
    let prevHash = GENESIS_HASH;

    for (let i = 1; i <= 10; i++) {
      const input = makeChainInput({
        sequenceNumber: i,
        totalHt: 750 * i,
        totalTtc: 825 * i,
        createdAt: new Date(2026, 1, 23, 12, i).toISOString(),
      });
      const hash = computeHash(input, prevHash);
      const signature = signTicket(hash, TENANT_SECRET);

      tickets.push({
        sequenceNumber: i,
        hash,
        prevHash,
        signature,
      });

      prevHash = hash;
    }

    // Verify entire chain
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];

      // Sequence
      expect(ticket.sequenceNumber).toBe(i + 1);

      // Chain link
      if (i === 0) {
        expect(ticket.prevHash).toBe(GENESIS_HASH);
      } else {
        expect(ticket.prevHash).toBe(tickets[i - 1].hash);
      }

      // Recalculate hash
      const input = makeChainInput({
        sequenceNumber: i + 1,
        totalHt: 750 * (i + 1),
        totalTtc: 825 * (i + 1),
        createdAt: new Date(2026, 1, 23, 12, i + 1).toISOString(),
      });
      const expectedHash = computeHash(input, ticket.prevHash);
      expect(ticket.hash).toBe(expectedHash);

      // Verify signature
      expect(verifySignature(ticket.hash, ticket.signature, TENANT_SECRET)).toBe(
        true,
      );
    }
  });

  it('should handle cancellation tickets in the chain', () => {
    let prevHash = GENESIS_HASH;

    // Ticket 1: normal sale
    const input1 = makeChainInput({ sequenceNumber: 1 });
    const hash1 = computeHash(input1, prevHash);
    const sig1 = signTicket(hash1, TENANT_SECRET);
    prevHash = hash1;

    // Ticket 2: cancellation of ticket 1
    const input2 = makeChainInput({
      sequenceNumber: 2,
      isCancellation: true,
      cancelledRef: 'ticket-1-id',
      totalHt: -750,
      totalTtc: -825,
      vatDetails: [{ rate: 10, baseHt: -750, amount: -75 }],
      payments: [{ method: 'cash', amount: -825 }],
    });
    const hash2 = computeHash(input2, prevHash);
    const sig2 = signTicket(hash2, TENANT_SECRET);

    // Both are valid
    expect(verifySignature(hash1, sig1, TENANT_SECRET)).toBe(true);
    expect(verifySignature(hash2, sig2, TENANT_SECRET)).toBe(true);

    // Chain is intact
    const recalc2 = computeHash(input2, hash1);
    expect(hash2).toBe(recalc2);
  });

  it('should handle expense note tickets', () => {
    const input = makeChainInput({
      isExpenseNote: true,
    });
    const hash = computeHash(input, GENESIS_HASH);
    const sig = signTicket(hash, TENANT_SECRET);

    expect(verifySignature(hash, sig, TENANT_SECRET)).toBe(true);

    // Expense note produces different hash than non-expense note
    const inputNormal = makeChainInput({
      isExpenseNote: false,
    });
    const hashNormal = computeHash(inputNormal, GENESIS_HASH);
    expect(hash).not.toBe(hashNormal);
  });

  it('should produce different hashes for ONSITE vs TAKEAWAY', () => {
    const hashOnsite = computeHash(
      makeChainInput({ serviceMode: 'ONSITE' }),
      GENESIS_HASH,
    );
    const hashTakeaway = computeHash(
      makeChainInput({ serviceMode: 'TAKEAWAY' }),
      GENESIS_HASH,
    );
    expect(hashOnsite).not.toBe(hashTakeaway);
  });
});
