/**
 * Integration tests for the "add post" decision flow.
 *
 * Tests the REAL usePosts.handleAddPost hook (rendered via react-test-renderer)
 * against a real in-memory SQLite database.  The production resolveAddDecision
 * function is exercised end-to-end — no logic is mirrored in these tests.
 *
 * Every test scenario verifies which callback the hook invokes, and optionally
 * what data it passes.  A regression in handleAddPost's branching, or in
 * resolveAddDecision, will cause the correct test to fail.
 *
 * Scenarios covered:
 *   Normal add / add-to-archive  x  exact duplicate / MinHash similar  x  active / archived / deleted
 *   (2 modes) x (2 match types x 3 states) = 12 cases
 *   Plus 3 happy-path "no conflict" cases = 15 total
 */

import React, { act } from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer') as { create: (el: any, opts?: any) => any };
import { Alert } from 'react-native';
import {
  usePosts,
  resetSharedPostsState,
  setSharedRepoForTesting,
  HandleAddPostOptions,
  UsePostsResult,
} from '@/hooks/usePosts';
import { PostRepository } from '@/repository/PostRepository';
import { MinHashService } from '@/services/MinHashService';
import { Post } from '@/models/models';
import {
  createInMemoryDb,
  AsyncDbAdapter,
} from './utils/createInMemoryDb';

// -- Repo factory (constructor is private; cast to any is the accepted pattern) -

function makeRepo(db: AsyncDbAdapter): PostRepository {
  return new (PostRepository as any)(db);
}

// -- Body text fixtures --------------------------------------------------------

/** Body texts that produce very high MinHash similarity (>= 0.8). */
const BODY_A =
  'The quick brown fox jumps over the lazy dog. ' +
  'Pack my box with five dozen liquor jugs. '.repeat(10);

/** One word changed -- Jaccard similarity is still very high (>0.9) */
const BODY_B =
  'The quick brown fox jumps over the lazy cat. ' +
  'Pack my box with five dozen liquor jugs. '.repeat(10);

/** Completely different content -- similarity will be near 0. */
const BODY_UNRELATED = 'Completely different topic about space exploration. '.repeat(10);

// -- Test helpers -------------------------------------------------------------

/** Seeds a post with the given redditId, bodyText, and state flags. */
async function seedWithState(
  db: AsyncDbAdapter,
  opts: {
    redditId: string;
    bodyText: string;
    isArchived?: boolean;
    isDeleted?: boolean;
  },
): Promise<number> {
  const sig = MinHashService.generateSignature(opts.bodyText);
  const minhash = sig ? JSON.stringify(sig) : null;
  const r = await db.runAsync(
    `INSERT INTO posts
       (redditId, url, title, bodyText, bodyMinHash, author, subreddit,
        redditCreatedAt, addedAt, updatedAt, syncedAt,
        isRead, isFavorite, isArchived, isDeleted, wordCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
             0, 0, ?, ?, ?)`,
    opts.redditId,
    `https://reddit.com/r/test/comments/${opts.redditId}`,
    'Existing Post',
    opts.bodyText,
    minhash,
    'existinguser',
    'test',
    opts.isArchived ? 1 : 0,
    opts.isDeleted ? 1 : 0,
    opts.bodyText.trim().split(/\s+/).length,
  );
  return r.lastInsertRowId;
}

/** Builds a minimal Post object for getPostData mocks. */
function makePostData(overrides: { redditId: string; bodyText: string }): Post {
  return {
    id: 0,
    redditId: overrides.redditId,
    url: `https://reddit.com/r/test/comments/${overrides.redditId}`,
    title: 'Test Post',
    bodyText: overrides.bodyText,
    author: 'testuser',
    subreddit: 'test',
    redditCreatedAt: new Date('2024-01-01T00:00:00Z'),
    addedAt: new Date(),
    updatedAt: new Date(),
    isRead: false,
    isFavorite: false,
    isArchived: false,
    isDeleted: false,
    folderIds: [],
  };
}

/** Spy bundle returned by callHandleAddPost. */
type Spies = {
  onSuccess: jest.Mock;
  onDuplicateFound: jest.Mock;
  onSimilarFound: jest.Mock;
  onFoundDeleted: jest.Mock;
};

/**
 * Calls the REAL hook's handleAddPost with spy callbacks.
 * All async state updates are wrapped in `act` so React does not warn.
 */
async function callHandleAddPost(
  hookResult: UsePostsResult,
  postInfo: { redditId: string; bodyText: string },
  extraOptions: Partial<HandleAddPostOptions> = {},
): Promise<Spies> {
  const onSuccess = jest.fn();
  const onDuplicateFound = jest.fn();
  const onSimilarFound = jest.fn();
  const onFoundDeleted = jest.fn();

  await act(async () => {
    await hookResult.handleAddPost(
      `https://reddit.com/r/test/comments/${postInfo.redditId}`,
      {
        getPostData: jest.fn().mockResolvedValue(makePostData(postInfo)),
        syncSinglePost: jest.fn().mockResolvedValue(undefined),
        onSuccess,
        onDuplicateFound,
        onSimilarFound,
        onFoundDeleted,
        ...extraOptions,
      },
    );
  });

  return { onSuccess, onDuplicateFound, onSimilarFound, onFoundDeleted };
}

// -- Test setup ---------------------------------------------------------------

let db: AsyncDbAdapter;
let hooks: UsePostsResult;

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(async () => {
  db = createInMemoryDb();
  resetSharedPostsState();
  setSharedRepoForTesting(makeRepo(db));

  // Render the hook into a headless component; capture the result reference.
  await act(async () => {
    TestRenderer.create(
      React.createElement(function CaptureHook() {
        hooks = usePosts();
        return null;
      }),
    );
  });
});

afterEach(async () => {
  await db.closeAsync();
});

// -- MinHash sanity checks -----------------------------------------------------

describe('MinHash sanity checks', () => {
  it('BODY_A and BODY_B have similarity >= 0.8', () => {
    const sigA = MinHashService.generateSignature(BODY_A);
    const sigB = MinHashService.generateSignature(BODY_B);
    expect(MinHashService.similarity(sigA, sigB)).toBeGreaterThanOrEqual(0.8);
  });

  it('BODY_A and BODY_UNRELATED have similarity < 0.5', () => {
    const sigA = MinHashService.generateSignature(BODY_A);
    const sigU = MinHashService.generateSignature(BODY_UNRELATED);
    expect(MinHashService.similarity(sigA, sigU)).toBeLessThan(0.5);
  });
});

// -- MATRIX SECTION A: Normal add ---------------------------------------------

describe('Normal add -- exact redditId match', () => {
  const EXISTING_ID = 'normal_exact_id';

  it('A1: existing post is active -> onDuplicateFound, isArchived = false', async () => {
    await seedWithState(db, { redditId: EXISTING_ID, bodyText: BODY_UNRELATED });

    const { onDuplicateFound, onSimilarFound, onFoundDeleted, onSuccess } =
      await callHandleAddPost(hooks, { redditId: EXISTING_ID, bodyText: BODY_UNRELATED });

    expect(onDuplicateFound).toHaveBeenCalledTimes(1);
    expect(onSimilarFound).not.toHaveBeenCalled();
    expect(onFoundDeleted).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    const [dupes] = onDuplicateFound.mock.calls[0] as [any[], unknown];
    expect(dupes[0].isArchived).toBeFalsy();
  });

  it('A2: existing post is archived -> onDuplicateFound, isArchived = true', async () => {
    await seedWithState(db, { redditId: EXISTING_ID, bodyText: BODY_UNRELATED, isArchived: true });

    const { onDuplicateFound, onSimilarFound, onFoundDeleted } =
      await callHandleAddPost(hooks, { redditId: EXISTING_ID, bodyText: BODY_UNRELATED });

    expect(onDuplicateFound).toHaveBeenCalledTimes(1);
    expect(onSimilarFound).not.toHaveBeenCalled();
    expect(onFoundDeleted).not.toHaveBeenCalled();
    const [dupes] = onDuplicateFound.mock.calls[0] as [any[], unknown];
    expect(dupes[0].isArchived).toBe(true);
  });

  it('A3: existing post is deleted -> onFoundDeleted', async () => {
    await seedWithState(db, { redditId: EXISTING_ID, bodyText: BODY_UNRELATED, isDeleted: true });

    const { onFoundDeleted, onDuplicateFound, onSimilarFound } =
      await callHandleAddPost(hooks, { redditId: EXISTING_ID, bodyText: BODY_UNRELATED });

    expect(onFoundDeleted).toHaveBeenCalledTimes(1);
    expect(onDuplicateFound).not.toHaveBeenCalled();
    expect(onSimilarFound).not.toHaveBeenCalled();
    const [foundPost] = onFoundDeleted.mock.calls[0] as [Post, unknown];
    expect(foundPost.isDeleted).toBe(true);
  });
});

describe('Normal add -- MinHash similar match', () => {
  const NEW_ID = 'brand_new_id';

  it('A4: similar body exists on active post -> onSimilarFound', async () => {
    await seedWithState(db, { redditId: 'existing_1', bodyText: BODY_A });

    const { onSimilarFound, onDuplicateFound, onFoundDeleted } =
      await callHandleAddPost(hooks, { redditId: NEW_ID, bodyText: BODY_B });

    expect(onSimilarFound).toHaveBeenCalledTimes(1);
    expect(onDuplicateFound).not.toHaveBeenCalled();
    expect(onFoundDeleted).not.toHaveBeenCalled();
    const [similarPosts] = onSimilarFound.mock.calls[0] as [Post[], unknown];
    expect(similarPosts[0].isDeleted).toBeFalsy();
    expect(similarPosts[0].isArchived).toBeFalsy();
  });

  it('A5: similar body exists on deleted post -> onSimilarFound (deleted)', async () => {
    await seedWithState(db, { redditId: 'existing_del', bodyText: BODY_A, isDeleted: true });

    const { onSimilarFound, onDuplicateFound } =
      await callHandleAddPost(hooks, { redditId: NEW_ID, bodyText: BODY_B });

    expect(onSimilarFound).toHaveBeenCalledTimes(1);
    expect(onDuplicateFound).not.toHaveBeenCalled();
    const [similarPosts] = onSimilarFound.mock.calls[0] as [Post[], unknown];
    expect(similarPosts[0].isDeleted).toBe(true);
  });

  it('A6: similar body exists on archived post -> onSimilarFound (archived)', async () => {
    await seedWithState(db, { redditId: 'existing_arch', bodyText: BODY_A, isArchived: true });

    const { onSimilarFound, onDuplicateFound } =
      await callHandleAddPost(hooks, { redditId: NEW_ID, bodyText: BODY_B });

    expect(onSimilarFound).toHaveBeenCalledTimes(1);
    expect(onDuplicateFound).not.toHaveBeenCalled();
    const [similarPosts] = onSimilarFound.mock.calls[0] as [Post[], unknown];
    expect(similarPosts[0].isArchived).toBe(true);
  });
});

// -- MATRIX SECTION B: Add to archive -----------------------------------------

describe('Add to archive -- exact redditId match', () => {
  const ARC_ID = 'archive_candidate';

  it('B1: existing post is active -> onDuplicateFound (dedup applies first)', async () => {
    await seedWithState(db, { redditId: ARC_ID, bodyText: BODY_UNRELATED });

    const { onDuplicateFound, onSuccess } = await callHandleAddPost(
      hooks,
      { redditId: ARC_ID, bodyText: BODY_UNRELATED },
      { addToArchive: true },
    );

    expect(onDuplicateFound).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('B2: existing post is archived -> onDuplicateFound', async () => {
    await seedWithState(db, { redditId: ARC_ID, bodyText: BODY_UNRELATED, isArchived: true });

    const { onDuplicateFound } = await callHandleAddPost(
      hooks,
      { redditId: ARC_ID, bodyText: BODY_UNRELATED },
      { addToArchive: true },
    );

    expect(onDuplicateFound).toHaveBeenCalledTimes(1);
    const [dupes] = onDuplicateFound.mock.calls[0] as [any[], unknown];
    expect(dupes[0].isArchived).toBe(true);
  });

  it('B3: existing post is deleted -> onFoundDeleted (same regardless of mode)', async () => {
    await seedWithState(db, { redditId: ARC_ID, bodyText: BODY_UNRELATED, isDeleted: true });

    const { onFoundDeleted, onDuplicateFound } = await callHandleAddPost(
      hooks,
      { redditId: ARC_ID, bodyText: BODY_UNRELATED },
      { addToArchive: true },
    );

    expect(onFoundDeleted).toHaveBeenCalledTimes(1);
    expect(onDuplicateFound).not.toHaveBeenCalled();
  });
});

describe('Add to archive -- MinHash similar match', () => {
  const NEW_ARC_ID = 'brand_new_archive_id';

  it('B4: similar body on active post -> onSimilarFound (dedup applies before archive)', async () => {
    await seedWithState(db, { redditId: 'existing_a', bodyText: BODY_A });

    const { onSimilarFound, onSuccess } = await callHandleAddPost(
      hooks,
      { redditId: NEW_ARC_ID, bodyText: BODY_B },
      { addToArchive: true },
    );

    expect(onSimilarFound).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('B5: similar body on deleted post -> onSimilarFound (deleted)', async () => {
    await seedWithState(db, { redditId: 'existing_d', bodyText: BODY_A, isDeleted: true });

    const { onSimilarFound } = await callHandleAddPost(
      hooks,
      { redditId: NEW_ARC_ID, bodyText: BODY_B },
      { addToArchive: true },
    );

    expect(onSimilarFound).toHaveBeenCalledTimes(1);
    const [posts] = onSimilarFound.mock.calls[0] as [Post[], unknown];
    expect(posts[0].isDeleted).toBe(true);
  });

  it('B6: similar body on archived post -> onSimilarFound (archived)', async () => {
    await seedWithState(db, { redditId: 'existing_ar', bodyText: BODY_A, isArchived: true });

    const { onSimilarFound } = await callHandleAddPost(
      hooks,
      { redditId: NEW_ARC_ID, bodyText: BODY_B },
      { addToArchive: true },
    );

    expect(onSimilarFound).toHaveBeenCalledTimes(1);
    const [posts] = onSimilarFound.mock.calls[0] as [Post[], unknown];
    expect(posts[0].isArchived).toBe(true);
  });
});

// -- SECTION C: Happy-path adds (no conflicts) --------------------------------

describe('Happy path -- new post with no conflicts', () => {
  it('C1: normal add -> onSuccess called, DB contains active post', async () => {
    const { onSuccess, onDuplicateFound, onSimilarFound } = await callHandleAddPost(hooks, {
      redditId: 'unique_normal',
      bodyText: BODY_A,
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onDuplicateFound).not.toHaveBeenCalled();
    expect(onSimilarFound).not.toHaveBeenCalled();

    const [createdPost] = onSuccess.mock.calls[0] as [Post];
    expect(createdPost.isArchived).toBeFalsy();
    expect(createdPost.isDeleted).toBeFalsy();
    expect(createdPost.redditId).toBe('unique_normal');
  });

  it('C2: add to archive -> onSuccess called, post is archived in DB', async () => {
    const { onSuccess } = await callHandleAddPost(
      hooks,
      { redditId: 'unique_archive', bodyText: BODY_A },
      { addToArchive: true },
    );

    expect(onSuccess).toHaveBeenCalledTimes(1);
    const [createdPost] = onSuccess.mock.calls[0] as [Post];
    expect(createdPost.isArchived).toBe(true);

    // Verify the DB record directly as well
    const repo = makeRepo(db);
    const stored = await repo.getByIdAny(createdPost.id);
    expect(stored?.isArchived).toBe(true);
  });

  it('C3: unrelated existing post does not trigger similar match -> onSuccess', async () => {
    await seedWithState(db, { redditId: 'unrelated_existing', bodyText: BODY_UNRELATED });

    const { onSuccess, onSimilarFound } = await callHandleAddPost(hooks, {
      redditId: 'unique_fresh_id',
      bodyText: BODY_A,
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSimilarFound).not.toHaveBeenCalled();
  });
});