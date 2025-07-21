// src/services/MinHashService.ts
import { x86 } from 'murmurhash3js-revisited';

export class MinHashService {
  // default number of permutations
  private static readonly DEFAULT_PERM = 32;
  // you can tweak these seeds; here we just use the first DEFAULT_PERM natural numbers
  private static readonly SEEDS = Array.from(
    { length: MinHashService.DEFAULT_PERM },
    (_, i) => i + 1
  );

  /**
   * Turn a string into a MinHash signature (array of length numPerm).
   */
  public static generateSignature(
    text: string,
    numPerm = MinHashService.DEFAULT_PERM
  ): number[] {
    const tokens = text.split(/\s+/);
    const sig = new Array<number>(numPerm).fill(Number.MAX_SAFE_INTEGER);

    for (const token of tokens) {
      for (let i = 0; i < numPerm; i++) {
        // murmurhash3 returns a 32‑bit integer
        const hash = x86.hash32(new TextEncoder().encode(token), MinHashService.SEEDS[i]);
        if (hash < sig[i]) sig[i] = hash;
      }
    }
    return sig;
  }

  /**
   * Estimate Jaccard similarity between two signatures [0..1].
   */
  public static similarity(sigA: number[], sigB: number[]): number {
    const len = Math.min(sigA.length, sigB.length);
    let matches = 0;
    for (let i = 0; i < len; i++) {
      if (sigA[i] === sigB[i]) matches++;
    }
    return matches / len;
  }
}
