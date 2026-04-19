/**
 * Tests for the pub/sub notification channel in useAuthorProfile.ts
 * and the getAllAuthorProfilesMap utility.
 */
import {
  profileListeners,
  notifyProfileChange,
  getAllAuthorProfilesMap,
} from '@/hooks/useAuthorProfile';
import { AuthorProfileRepository } from '@/repository/AuthorProfileRepository';
import { AuthorProfile } from '@/models/AuthorProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(author: string, overrides: Partial<AuthorProfile> = {}): AuthorProfile {
  return {
    author,
    isFavorite: false,
    rating: null,
    notes: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ─── profileListeners pub/sub ─────────────────────────────────────────────────

describe('profileListeners / notifyProfileChange', () => {
  afterEach(() => {
    profileListeners.clear();
  });

  it('calls all registered listeners with the changed author', () => {
    const callA = jest.fn();
    const callB = jest.fn();
    profileListeners.add(callA);
    profileListeners.add(callB);

    notifyProfileChange('alice');

    expect(callA).toHaveBeenCalledWith('alice');
    expect(callB).toHaveBeenCalledWith('alice');
  });

  it('does not call a listener after it is removed', () => {
    const fn = jest.fn();
    profileListeners.add(fn);
    profileListeners.delete(fn);

    notifyProfileChange('alice');

    expect(fn).not.toHaveBeenCalled();
  });

  it('does not throw when there are no listeners', () => {
    expect(() => notifyProfileChange('nobody')).not.toThrow();
  });

  it('passes the exact author string to each listener', () => {
    const received: string[] = [];
    const fn = (a: string) => received.push(a);
    profileListeners.add(fn);

    notifyProfileChange('ExactName_123');

    expect(received).toEqual(['ExactName_123']);
  });

  it('each listener is only called once per notification', () => {
    const fn = jest.fn();
    profileListeners.add(fn);

    notifyProfileChange('alice');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('multiple notifications call the listener each time', () => {
    const fn = jest.fn();
    profileListeners.add(fn);

    notifyProfileChange('alice');
    notifyProfileChange('bob');
    notifyProfileChange('carol');

    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(1, 'alice');
    expect(fn).toHaveBeenNthCalledWith(2, 'bob');
    expect(fn).toHaveBeenNthCalledWith(3, 'carol');
  });
});

// ─── getAllAuthorProfilesMap ───────────────────────────────────────────────────

jest.mock('@/repository/AuthorProfileRepository');

const mockCreate = AuthorProfileRepository.create as jest.MockedFunction<
  typeof AuthorProfileRepository.create
>;

function mockRepoWith(profiles: AuthorProfile[]) {
  mockCreate.mockResolvedValue({
    getAll: jest.fn().mockResolvedValue(profiles),
  } as any);
}

describe('getAllAuthorProfilesMap', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty map when there are no profiles', async () => {
    mockRepoWith([]);
    const map = await getAllAuthorProfilesMap();
    expect(map.size).toBe(0);
  });

  it('keys by lowercase author name', async () => {
    mockRepoWith([makeProfile('Alice'), makeProfile('BOB')]);
    const map = await getAllAuthorProfilesMap();
    expect(map.has('alice')).toBe(true);
    expect(map.has('bob')).toBe(true);
    expect(map.has('Alice')).toBe(false);
  });

  it('preserves the full profile object for each author', async () => {
    const profile = makeProfile('alice', { isFavorite: true, rating: 4.5, notes: 'great' });
    mockRepoWith([profile]);
    const map = await getAllAuthorProfilesMap();
    const result = map.get('alice');
    expect(result).toMatchObject({
      author: 'alice',
      isFavorite: true,
      rating: 4.5,
      notes: 'great',
    });
  });

  it('handles multiple profiles and stores each under the correct key', async () => {
    const profiles = [
      makeProfile('alice', { isFavorite: true }),
      makeProfile('bob', { rating: 3.0 }),
      makeProfile('carol', { notes: 'interesting' }),
    ];
    mockRepoWith(profiles);
    const map = await getAllAuthorProfilesMap();
    expect(map.size).toBe(3);
    expect(map.get('alice')!.isFavorite).toBe(true);
    expect(map.get('bob')!.rating).toBe(3.0);
    expect(map.get('carol')!.notes).toBe('interesting');
  });

  it('last entry wins for case-insensitive duplicate authors', async () => {
    // getAll shouldn't return dupes, but handle it gracefully
    const profiles = [
      makeProfile('Alice', { rating: 1.0 }),
      makeProfile('alice', { rating: 5.0 }),
    ];
    mockRepoWith(profiles);
    const map = await getAllAuthorProfilesMap();
    expect(map.size).toBe(1);
    expect(map.get('alice')!.rating).toBe(5.0);
  });
});
