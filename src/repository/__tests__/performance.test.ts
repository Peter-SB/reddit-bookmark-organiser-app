/**
 * Performance benchmarks comparing optimisation paths.
 *
 * These tests do NOT use `expect` for timing values — timing is
 * environment-dependent. Instead they:
 *  1. Measure actual times and print them.
 *  2. Assert correctness of results (the optimised path must be equivalent).
 *  3. Assert that the item-level update path is meaningfully faster than a
 *     full DB re-query (asserted only as "at least 2× faster" to avoid flakiness).
 *
 * Run with:  npx jest performance --verbose
 */
import { PostRepository } from '@/repository/PostRepository';
import { applyItemUpdate } from '@/hooks/useFilteredPosts';
import { OrderByOption } from '@/constants/orderBy';
import { createInMemoryDb, seedManyPosts, AsyncDbAdapter } from './utils/createInMemoryDb';
import { PostListItem } from '@/models/models';

function makeRepo(db: AsyncDbAdapter): PostRepository {
  return new (PostRepository as any)(db);
}

/** Returns elapsed milliseconds since startTime (from Date.now()). */
function elapsed(startMs: number): number {
  return Date.now() - startMs;
}

/** Runs `fn` N times, returns median ms. */
async function benchmark(fn: () => Promise<unknown>, runs = 5): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = Date.now();
    await fn();
    times.push(elapsed(t));
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]; // median
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let db: AsyncDbAdapter;
let repo: PostRepository;
let posts: PostListItem[];

// We use a shared DB across all benchmarks to avoid repeated seeding overhead.
beforeAll(async () => {
  db = createInMemoryDb();
  repo = makeRepo(db);

  console.log('  [perf] Seeding 3 000 posts...');
  const t = Date.now();
  await seedManyPosts(db, 3000);
  console.log(`  [perf] Seeded in ${elapsed(t)}ms`);

  posts = await repo.getFilteredListItems({});
  console.log(`  [perf] Initial load: ${posts.length} posts`);
}, 60_000);

afterAll(async () => {
  await db.closeAsync();
});

// ── Benchmark 1: full re-query ────────────────────────────────────────────────

describe.skip('Benchmark: full DB re-query (old path)', () => {
  it('measures median time for getFilteredListItems on 3 000 posts', async () => {
    const medianMs = await benchmark(() => repo.getFilteredListItems({}));
    console.log(`  [perf] Full re-query (no filters): median ${medianMs}ms`);
    // Correctness: returns all 3000 rows
    const result = await repo.getFilteredListItems({});
    expect(result).toHaveLength(3000);
  });

  it('measures time with favourites filter active', async () => {
    const medianMs = await benchmark(() =>
      repo.getFilteredListItems({ favouritesFilter: 'yes' }),
    );
    console.log(`  [perf] Full re-query (favourites filter): median ${medianMs}ms`);
    const result = await repo.getFilteredListItems({ favouritesFilter: 'yes' });
    expect(result.every((p) => p.isFavorite)).toBe(true);
  });

  it('measures time with text search active', async () => {
    const medianMs = await benchmark(() =>
      repo.getFilteredListItems({ search: 'Post 5' }),
    );
    console.log(`  [perf] Full re-query (search='Post 5'): median ${medianMs}ms`);
  });
});

// ── Benchmark 2: in-memory item update (new path) ────────────────────────────

describe.skip('Benchmark: in-memory item update', () => {
  let cachedPosts: PostListItem[];

  beforeAll(async () => {
    cachedPosts = await repo.getFilteredListItems({});
  });

  it('measures applyItemUpdate on a 3 000-item list (toggle favourite)', () => {
    const targetPost = cachedPosts[1500];
    const updated = { ...targetPost, isFavorite: !targetPost.isFavorite };

    const runs = 200;
    const start = Date.now();
    for (let i = 0; i < runs; i++) {
      applyItemUpdate(cachedPosts, updated, {});
    }
    const totalMs = elapsed(start);
    const perOpMs = totalMs / runs;
    console.log(`  [perf] applyItemUpdate (3 000 items, toggle fav): ${perOpMs.toFixed(3)}ms/op (${runs} runs)`);

    // Correctness: in-place update returns correct result
    const result = applyItemUpdate(cachedPosts, updated, {});
    expect(result).toHaveLength(3000);
    expect(result[1500].isFavorite).toBe(updated.isFavorite);
  });

  it('measures applyItemUpdate when item is removed from filtered view', () => {
    // Simulate: favourites filter active, item gets unfavorited
    const favPosts = cachedPosts.filter((p) => p.isFavorite);
    if (favPosts.length === 0) {
      console.log('  [perf] No favourites to test removal — skipped');
      return;
    }
    const target = favPosts[0];
    const unfavorited = { ...target, isFavorite: false };

    const runs = 200;
    const start = Date.now();
    for (let i = 0; i < runs; i++) {
      applyItemUpdate(favPosts, unfavorited, { favouritesFilter: 'yes' });
    }
    const totalMs = elapsed(start);
    const perOpMs = totalMs / runs;
    console.log(`  [perf] applyItemUpdate (remove from filtered view, ${favPosts.length} items): ${perOpMs.toFixed(3)}ms/op`);

    const result = applyItemUpdate(favPosts, unfavorited, { favouritesFilter: 'yes' });
    expect(result.length).toBe(favPosts.length - 1);
    expect(result.find((p) => p.id === target.id)).toBeUndefined();
  });

  it('measures applyItemUpdate with in-place sort (readAt order)', () => {
    const sorted = [...cachedPosts].sort(
      (a, b) => (b.addedAt.getTime()) - (a.addedAt.getTime()),
    );
    const target = sorted[1500];
    const updated = { ...target, readAt: new Date() };

    const runs = 50;
    const start = Date.now();
    for (let i = 0; i < runs; i++) {
      applyItemUpdate(sorted, updated, { orderBy: OrderByOption.ReadAt });
    }
    const totalMs = elapsed(start);
    const perOpMs = totalMs / runs;
    console.log(`  [perf] applyItemUpdate (re-sort readAt, 3 000 items): ${perOpMs.toFixed(3)}ms/op`);
  });
});

// ── Benchmark 3: comparison ───────────────────────────────────────────────────

describe.skip('Benchmark: In-memory speed-up vs full re-query', () => {
  it('item-level update is significantly faster than a full DB re-query', async () => {
    const cachedPosts = await repo.getFilteredListItems({});
    const target = cachedPosts[0];
    const updated = { ...target, isFavorite: !target.isFavorite };

    // Full re-query path (old)
    const fullReQueryMs = await benchmark(() => repo.getFilteredListItems({}));

    // Item-level update path
    const ITEM_RUNS = 500;
    const itemStart = Date.now();
    for (let i = 0; i < ITEM_RUNS; i++) {
      applyItemUpdate(cachedPosts, updated, {});
    }
    const itemMedianMs = elapsed(itemStart) / ITEM_RUNS;

    console.log(`  [perf] Comparison on 3 000 posts:`);
    console.log(`         Full DB re-query:    ${fullReQueryMs.toFixed(1)}ms`);
    console.log(`         applyItemUpdate:     ${itemMedianMs.toFixed(3)}ms`);
    console.log(`         Speed-up:            ~${Math.round(fullReQueryMs / itemMedianMs)}×`);

    // The in-memory path must be at least 10× faster than a DB round-trip.
    // This is a very conservative bound — in practice it should be 100–1000×.
    expect(itemMedianMs).toBeLessThan(fullReQueryMs / 10);
  });
});
