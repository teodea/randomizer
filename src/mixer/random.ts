/** Returns a number in [0, 1). The mixer draws all of its randomness from one of these. */
export type Rng = () => number

/**
 * A small seeded generator (mulberry32). The same seed always yields the same
 * sequence, which keeps mixes reproducible in tests.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A fresh, unpredictable seed for a new mix. */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}
