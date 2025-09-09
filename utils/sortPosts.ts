import { Post } from "@/models/models";

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
