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

export function sortPosts(
  posts: Post[],
  orderBy: string,
  orderDirection: "asc" | "desc"
) {
  return [...posts].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    switch (orderBy) {
      case "addedAt":
        aValue = new Date(a.addedAt).getTime();
        bValue = new Date(b.addedAt).getTime();
        break;
      case "updatedAt":
        aValue = a.updatedAt
          ? new Date(a.updatedAt as any).getTime()
          : new Date(a.addedAt).getTime();
        bValue = b.updatedAt
          ? new Date(b.updatedAt as any).getTime()
          : new Date(b.addedAt).getTime();
        break;
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
    if (aValue < bValue) return orderDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return orderDirection === "asc" ? 1 : -1;
    return 0;
  });
}
