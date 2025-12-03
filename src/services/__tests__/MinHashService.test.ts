import { MinHashService } from "../MinHashService";

describe("MinHashService.generateSignature", () => {
  it("returns an array of default length (32)", () => {
    const sig = MinHashService.generateSignature("test string");
    expect(sig).toHaveLength(32);
  });

  it("returns an array of specified length", () => {
    const length = 10;
    const sig = MinHashService.generateSignature("test string", length);
    expect(sig).toHaveLength(length);
  });

  it("is deterministic for the same input", () => {
    const s1 = MinHashService.generateSignature("hello world");
    const s2 = MinHashService.generateSignature("hello world");
    expect(s1).toEqual(s2);
  });

  it("is order insensitive (token order does not affect signature)", () => {
    const s1 = MinHashService.generateSignature("a b c d e");
    const s2 = MinHashService.generateSignature("e d c b a");
    expect(s1).toEqual(s2);
  });

  it("handles empty string input", () => {
    const sig = MinHashService.generateSignature("");
    expect(sig).toHaveLength(32);
    for (const v of sig) {
      expect(typeof v).toBe("number");
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe("MinHashService.similarity", () => {
  it("returns 1 for identical signatures", () => {
    const sig = MinHashService.generateSignature("hello");
    const sim = MinHashService.similarity(sig, sig);
    expect(sim).toBe(1);
  });

  it("returns 0 for completely different arrays", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const sim = MinHashService.similarity(a, b);
    expect(sim).toBe(0);
  });

  it("handles signatures of different lengths by using the shorter length", () => {
    const a = [1, 1, 1, 1];
    const b = [1, 1];
    const sim = MinHashService.similarity(a, b);
    // 2 matches out of 2 positions
    expect(sim).toBe(1);
  });

  it("returns a fraction between 0 and 1 for partial matches", () => {
    const a = [1, 2, 3, 4];
    const b = [1, 2, 5, 6];
    const sim = MinHashService.similarity(a, b);
    expect(sim).toBeCloseTo(0.5);
  });
});
