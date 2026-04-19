import { filterAndSortAuthors } from '@/hooks/useAuthors';
import { OrderByOption } from '@/constants/orderBy';
import { AuthorSummary } from '@/models/AuthorSummary';
import { AuthorProfile } from '@/models/AuthorProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuthor(author: string, overrides: Partial<AuthorSummary> = {}): AuthorSummary {
  return {
    author,
    postCount: 1,
    readCount: 0,
    favouriteCount: 0,
    archivedCount: 0,
    avgRating: null,
    totalRating: 0,
    lastAddedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

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

function makeProfilesMap(profiles: AuthorProfile[]): Map<string, AuthorProfile> {
  const map = new Map<string, AuthorProfile>();
  for (const p of profiles) map.set(p.author.toLowerCase(), p);
  return map;
}

const emptyProfiles = new Map<string, AuthorProfile>();

// ─── Profile filter: AuthorIsFavorite ─────────────────────────────────────────

describe('filterAndSortAuthors — AuthorIsFavorite filter', () => {
  it('only returns authors whose profile has isFavorite === true', () => {
    const authors = [makeAuthor('alice'), makeAuthor('bob'), makeAuthor('carol')];
    const profiles = makeProfilesMap([
      makeProfile('alice', { isFavorite: true }),
      makeProfile('bob', { isFavorite: false }),
    ]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorIsFavorite,
    });

    expect(result.map(a => a.author)).toEqual(['alice']);
  });

  it('excludes authors with no profile entry at all', () => {
    const authors = [makeAuthor('alice'), makeAuthor('noprofile')];
    const profiles = makeProfilesMap([makeProfile('alice', { isFavorite: true })]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorIsFavorite,
    });

    expect(result.map(a => a.author)).toEqual(['alice']);
  });

  it('returns empty list when no authors are favourited', () => {
    const authors = [makeAuthor('alice'), makeAuthor('bob')];
    const profiles = makeProfilesMap([makeProfile('alice'), makeProfile('bob')]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorIsFavorite,
    });

    expect(result).toHaveLength(0);
  });

  it('sorts multiple favourited authors alphabetically (desc)', () => {
    const authors = [makeAuthor('zara'), makeAuthor('alice'), makeAuthor('mike')];
    const profiles = makeProfilesMap([
      makeProfile('zara', { isFavorite: true }),
      makeProfile('alice', { isFavorite: true }),
      makeProfile('mike', { isFavorite: true }),
    ]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorIsFavorite,
      orderDirection: 'desc',
    });

    expect(result.map(a => a.author)).toEqual(['alice', 'mike', 'zara']);
  });
});

// ─── Profile filter: AuthorRating ─────────────────────────────────────────────

describe('filterAndSortAuthors — AuthorRating filter', () => {
  it('only returns authors with a non-null rating', () => {
    const authors = [makeAuthor('alice'), makeAuthor('bob'), makeAuthor('carol')];
    const profiles = makeProfilesMap([
      makeProfile('alice', { rating: 4.5 }),
      makeProfile('bob', { rating: null }),
    ]);
    // carol has no profile

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorRating,
    });

    expect(result.map(a => a.author)).toEqual(['alice']);
  });

  it('sorts by rating descending by default', () => {
    const authors = [makeAuthor('alice'), makeAuthor('bob'), makeAuthor('carol')];
    const profiles = makeProfilesMap([
      makeProfile('alice', { rating: 3.0 }),
      makeProfile('bob', { rating: 5.0 }),
      makeProfile('carol', { rating: 1.0 }),
    ]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorRating,
      orderDirection: 'desc',
    });

    expect(result.map(a => a.author)).toEqual(['bob', 'alice', 'carol']);
  });

  it('sorts by rating ascending when direction is asc', () => {
    const authors = [makeAuthor('alice'), makeAuthor('bob'), makeAuthor('carol')];
    const profiles = makeProfilesMap([
      makeProfile('alice', { rating: 3.0 }),
      makeProfile('bob', { rating: 5.0 }),
      makeProfile('carol', { rating: 1.0 }),
    ]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorRating,
      orderDirection: 'asc',
    });

    expect(result.map(a => a.author)).toEqual(['carol', 'alice', 'bob']);
  });

  it('breaks ties alphabetically', () => {
    const authors = [makeAuthor('zara'), makeAuthor('alice')];
    const profiles = makeProfilesMap([
      makeProfile('zara', { rating: 4.0 }),
      makeProfile('alice', { rating: 4.0 }),
    ]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorRating,
      orderDirection: 'desc',
    });

    expect(result.map(a => a.author)).toEqual(['alice', 'zara']);
  });
});

// ─── Profile filter: AuthorHasNotes ──────────────────────────────────────────

describe('filterAndSortAuthors — AuthorHasNotes filter', () => {
  it('only returns authors with non-empty notes', () => {
    const authors = [makeAuthor('alice'), makeAuthor('bob'), makeAuthor('carol')];
    const profiles = makeProfilesMap([
      makeProfile('alice', { notes: 'great content' }),
      makeProfile('bob', { notes: null }),
      makeProfile('carol', { notes: '' }),
    ]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorHasNotes,
    });

    expect(result.map(a => a.author)).toEqual(['alice']);
  });

  it('excludes authors with no profile entry', () => {
    const authors = [makeAuthor('alice'), makeAuthor('noprofile')];
    const profiles = makeProfilesMap([makeProfile('alice', { notes: 'has notes' })]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorHasNotes,
    });

    expect(result.map(a => a.author)).toEqual(['alice']);
  });
});

// ─── Search filter ────────────────────────────────────────────────────────────

describe('filterAndSortAuthors — search filter', () => {
  it('filters by matching author name substring (case-insensitive)', () => {
    const authors = [makeAuthor('JohnDoe'), makeAuthor('JaneSmith'), makeAuthor('BobJohnson')];

    const result = filterAndSortAuthors(authors, emptyProfiles, {
      orderBy: OrderByOption.Name,
      search: 'john',
    });

    expect(result.map(a => a.author)).toEqual(['JohnDoe', 'BobJohnson']);
  });

  it('returns all authors when search is empty', () => {
    const authors = [makeAuthor('alice'), makeAuthor('bob')];

    const result = filterAndSortAuthors(authors, emptyProfiles, {
      orderBy: OrderByOption.Name,
      search: '',
    });

    expect(result).toHaveLength(2);
  });

  it('returns empty when no authors match search', () => {
    const authors = [makeAuthor('alice'), makeAuthor('bob')];

    const result = filterAndSortAuthors(authors, emptyProfiles, {
      orderBy: OrderByOption.Name,
      search: 'xyz',
    });

    expect(result).toHaveLength(0);
  });
});

// ─── Standard sorts ───────────────────────────────────────────────────────────

describe('filterAndSortAuthors — standard sort options', () => {
  describe('PostCount', () => {
    it('sorts by postCount descending', () => {
      const authors = [
        makeAuthor('alice', { postCount: 5 }),
        makeAuthor('bob', { postCount: 10 }),
        makeAuthor('carol', { postCount: 2 }),
      ];

      const result = filterAndSortAuthors(authors, emptyProfiles, {
        orderBy: OrderByOption.PostCount,
        orderDirection: 'desc',
      });

      expect(result.map(a => a.author)).toEqual(['bob', 'alice', 'carol']);
    });

    it('sorts by postCount ascending', () => {
      const authors = [
        makeAuthor('alice', { postCount: 5 }),
        makeAuthor('bob', { postCount: 10 }),
      ];

      const result = filterAndSortAuthors(authors, emptyProfiles, {
        orderBy: OrderByOption.PostCount,
        orderDirection: 'asc',
      });

      expect(result.map(a => a.author)).toEqual(['alice', 'bob']);
    });
  });

  describe('Name', () => {
    it('sorts alphabetically ascending', () => {
      const authors = [makeAuthor('Zara'), makeAuthor('Alice'), makeAuthor('Mike')];

      const result = filterAndSortAuthors(authors, emptyProfiles, {
        orderBy: OrderByOption.Name,
        orderDirection: 'asc',
      });

      expect(result.map(a => a.author)).toEqual(['Alice', 'Mike', 'Zara']);
    });

    it('sorts alphabetically descending', () => {
      const authors = [makeAuthor('Zara'), makeAuthor('Alice'), makeAuthor('Mike')];

      const result = filterAndSortAuthors(authors, emptyProfiles, {
        orderBy: OrderByOption.Name,
        orderDirection: 'desc',
      });

      expect(result.map(a => a.author)).toEqual(['Zara', 'Mike', 'Alice']);
    });
  });

  describe('AddedAt', () => {
    it('sorts by lastAddedAt descending (most recent first)', () => {
      const authors = [
        makeAuthor('alice', { lastAddedAt: new Date('2025-01-01') }),
        makeAuthor('bob', { lastAddedAt: new Date('2025-06-01') }),
        makeAuthor('carol', { lastAddedAt: new Date('2024-01-01') }),
      ];

      const result = filterAndSortAuthors(authors, emptyProfiles, {
        orderBy: OrderByOption.AddedAt,
        orderDirection: 'desc',
      });

      expect(result.map(a => a.author)).toEqual(['bob', 'alice', 'carol']);
    });
  });

  describe('FavouriteCount', () => {
    it('sorts by favouriteCount descending', () => {
      const authors = [
        makeAuthor('alice', { favouriteCount: 1 }),
        makeAuthor('bob', { favouriteCount: 5 }),
      ];

      const result = filterAndSortAuthors(authors, emptyProfiles, {
        orderBy: OrderByOption.FavouriteCount,
        orderDirection: 'desc',
      });

      expect(result.map(a => a.author)).toEqual(['bob', 'alice']);
    });
  });

  describe('AvgRating', () => {
    it('sorts by avgRating descending, treating null as 0', () => {
      const authors = [
        makeAuthor('alice', { avgRating: null }),
        makeAuthor('bob', { avgRating: 4.5 }),
        makeAuthor('carol', { avgRating: 2.0 }),
      ];

      const result = filterAndSortAuthors(authors, emptyProfiles, {
        orderBy: OrderByOption.AvgRating,
        orderDirection: 'desc',
      });

      expect(result.map(a => a.author)).toEqual(['bob', 'carol', 'alice']);
    });
  });
});

// ─── Combined: profile filter + search ───────────────────────────────────────

describe('filterAndSortAuthors — combined profile filter and search', () => {
  it('applies both favourite filter and search', () => {
    const authors = [
      makeAuthor('alice_dev'),
      makeAuthor('alice_art'),
      makeAuthor('bob_dev'),
    ];
    const profiles = makeProfilesMap([
      makeProfile('alice_dev', { isFavorite: true }),
      makeProfile('alice_art', { isFavorite: true }),
      makeProfile('bob_dev', { isFavorite: false }),
    ]);

    const result = filterAndSortAuthors(authors, profiles, {
      orderBy: OrderByOption.AuthorIsFavorite,
      search: 'alice',
    });

    expect(result.map(a => a.author)).toEqual(['alice_art', 'alice_dev']);
  });
});
