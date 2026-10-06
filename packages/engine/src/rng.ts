/**
 * Randomness.
 *
 * Two distinct needs (REQUIREMENTS 3.1, 4A.2):
 *  1. Real shuffles must be cryptographically secure and unpredictable.
 *     Use `cryptoShuffle`. In online play this runs on the server only.
 *  2. The grader's crib simulations must be *deterministic* — seeded from
 *     game ID + hand number so a re-grade gives the same answer every time.
 *     Use `seededRng`.
 */

/** Unbiased Fisher-Yates shuffle using a crypto-secure source. Returns a copy. */
export function cryptoShuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** A uniform integer in [0, maxExclusive) with rejection sampling (no modulo bias). */
export function cryptoRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error('maxExclusive must be > 0');
  if (maxExclusive === 1) return 0;
  const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % maxExclusive;
}

/** A deterministic PRNG (0..1), seedable from a string or number. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Fisher-Yates shuffle using this generator. Returns a copy. */
  shuffle<T>(input: readonly T[]): T[];
}

/**
 * Seeded, deterministic RNG. Same seed => same sequence, on any machine.
 * Uses a 32-bit string hash to seed mulberry32.
 */
export function seededRng(seed: string | number): Rng {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  // Avoid a zero state producing a degenerate stream.
  if (state === 0) state = 0x9e3779b9;

  function next(): number {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error('maxExclusive must be > 0');
    return Math.floor(next() * maxExclusive);
  }

  function shuffle<T>(input: readonly T[]): T[] {
    const arr = [...input];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }

  return { next, int, shuffle };
}

/** FNV-1a 32-bit string hash. */
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Thin wrapper so Node and browser both work without a build-time branch.
 * The Web Crypto API is global in Node 20+, Deno, and browsers; we type it
 * minimally so the engine needs no DOM lib.
 */
interface CryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

function getRandomValues(buf: Uint32Array): void {
  const g = globalThis as { crypto?: CryptoLike };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(buf);
    return;
  }
  throw new Error('No crypto.getRandomValues available in this environment');
}
