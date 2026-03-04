import { Post } from "@/models/models";

type TripleFilter = "all" | "yes" | "no";

export function filterPosts(
  posts: Post[],
  options: {
    search: string;
    selectedFolders: number[];
    favouritesFilter: TripleFilter;
    readFilter: TripleFilter;
  }
): Post[] {
  const { search, selectedFolders, favouritesFilter, readFilter } = options;
  return posts
    .filter((post) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (post.title ?? "").toLowerCase().includes(q) ||
        (post.customTitle ?? "").toLowerCase().includes(q) ||
        (post.bodyText ?? "").toLowerCase().includes(q) ||
        (post.customBody ?? "").toLowerCase().includes(q) ||
        (post.notes ?? "").toLowerCase().includes(q) ||
        (post.author ?? "").toLowerCase().includes(q) ||
        (post.subreddit ?? "").toLowerCase().includes(q)
      );
    })
    .filter((post) => {
      if (!selectedFolders || selectedFolders.length === 0) return true;
      if (!post.folderIds || post.folderIds.length === 0) return false;
      return post.folderIds.some((fid: number) =>
        selectedFolders.includes(fid)
      );
    })
    .filter((post) => {
      if (favouritesFilter === "all") return true;
      const isFav = Boolean(post.isFavorite);
      return favouritesFilter === "yes" ? isFav : !isFav;
    })
    .filter((post) => {
      if (readFilter === "all") return true;
      const isRead = Boolean(post.isRead);
      return readFilter === "yes" ? isRead : !isRead;
    });
}

function seededRandom(seed: number) {
  // Mulberry32 PRNG – deterministic, fast, good distribution
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sortPosts(
  posts: Post[],
  orderBy: string,
  orderDirection: "asc" | "desc",
  randomSeed?: number
) {
  if (orderBy === "random") {
    const rand = seededRandom(randomSeed ?? 0);
    const result = [...posts];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  const toTime = (value?: Date | string | number | null) => {
    if (!value) return null;
    const time = new Date(value as any).getTime();
    return Number.isNaN(time) ? null : time;
  };

  const compare = (left: any, right: any) => {
    if (left < right) return orderDirection === "asc" ? -1 : 1;
    if (left > right) return orderDirection === "asc" ? 1 : -1;
    return 0;
  };

  return [...posts].sort((a, b) => {
    if (orderBy === "updatedAt") {
      const aAdded = toTime(a.addedAt);
      const bAdded = toTime(b.addedAt);
      const aUpdated = toTime(a.updatedAt);
      const bUpdated = toTime(b.updatedAt);
      const aEffectiveUpdated =
        aUpdated !== null &&
        aAdded !== null &&
        Math.abs(aUpdated - aAdded) > 1000
          ? aUpdated
          : null;
      const bEffectiveUpdated =
        bUpdated !== null &&
        bAdded !== null &&
        Math.abs(bUpdated - bAdded) > 1000
          ? bUpdated
          : null;

      const aHasUpdated = aEffectiveUpdated !== null;
      const bHasUpdated = bEffectiveUpdated !== null;

      if (aHasUpdated && bHasUpdated)
        return compare(aEffectiveUpdated, bEffectiveUpdated);
      if (aHasUpdated !== bHasUpdated) return aHasUpdated ? -1 : 1;
      if (aAdded !== null && bAdded !== null) return compare(aAdded, bAdded);
      return 0;
    }

    let aValue: any;
    let bValue: any;
    switch (orderBy) {
      case "addedAt":
        aValue = new Date(a.addedAt).getTime();
        bValue = new Date(b.addedAt).getTime();
        break;
      case "readAt": {
        const aRead = toTime(a.readAt);
        const bRead = toTime(b.readAt);
        // Nulls sort last regardless of direction
        if (aRead === null && bRead === null) return 0;
        if (aRead === null) return 1;
        if (bRead === null) return -1;
        return compare(aRead, bRead);
      }
      case "rating":
        aValue = (a as any).rating ?? 0;
        bValue = (b as any).rating ?? 0;
        break;
      case "title":
        aValue = (a.title ?? "").toLowerCase();
        bValue = (b.title ?? "").toLowerCase();
        break;
      case "length":
        aValue = (a.customBody ?? a.bodyText ?? "").length;
        bValue = (b.customBody ?? b.bodyText ?? "").length;
        break;
      default:
        aValue = new Date(a.addedAt).getTime();
        bValue = new Date(b.addedAt).getTime();
    }
    return compare(aValue, bValue);
  });
}
