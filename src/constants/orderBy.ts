export enum OrderByOption {
  AddedAt = "addedAt",
  UpdatedAt = "updatedAt",
  QueuedAt = "queuedAt",
  ReadAt = "readAt",
  Rating = "rating",
  Length = "length",
  Random = "random",
  PostedAt = "postedAt",
  // Author-list sort options
  PostCount = "postCount",
  AvgRating = "avgRating",
  TotalRating = "totalRating",
  Name = "name",
  FavouriteCount = "favouriteCount",
  ReadCount = "readCount",
}

/** Labels for post-list sort options */
export const POST_ORDER_BY_LABELS: Partial<Record<OrderByOption, string>> = {
  [OrderByOption.AddedAt]: "Added At",
  [OrderByOption.UpdatedAt]: "Updated At",
  [OrderByOption.QueuedAt]: "Queued At",
  [OrderByOption.PostedAt]: "Posted At",
  [OrderByOption.ReadAt]: "Read At",
  [OrderByOption.Rating]: "Rating",
  [OrderByOption.Length]: "Length",
  [OrderByOption.Random]: "Random",
};

/** Labels for author-list sort options */
export const AUTHOR_ORDER_BY_LABELS: Partial<Record<OrderByOption, string>> = {
  [OrderByOption.PostCount]: "Post Count",
  [OrderByOption.AvgRating]: "Avg Rating",
  [OrderByOption.TotalRating]: "Total Rating",
  [OrderByOption.Name]: "Name",
  [OrderByOption.AddedAt]: "Added At",
  [OrderByOption.FavouriteCount]: "Favourites",
  [OrderByOption.ReadCount]: "Read Count",
};

/** Full label map covering all OrderByOption values */
export const ORDER_BY_LABELS: Record<OrderByOption, string> = {
  ...POST_ORDER_BY_LABELS,
  ...AUTHOR_ORDER_BY_LABELS,
} as Record<OrderByOption, string>;

/** Order-by options for the Author list screen */
export const AUTHOR_ORDER_OPTIONS: { key: OrderByOption; label: string }[] = [
  { key: OrderByOption.PostCount, label: AUTHOR_ORDER_BY_LABELS[OrderByOption.PostCount] ?? "Post Count" },
  { key: OrderByOption.AvgRating, label: AUTHOR_ORDER_BY_LABELS[OrderByOption.AvgRating] ?? "Avg Rating" },
  { key: OrderByOption.TotalRating, label: AUTHOR_ORDER_BY_LABELS[OrderByOption.TotalRating] ?? "Total Rating" },
  { key: OrderByOption.Name, label: AUTHOR_ORDER_BY_LABELS[OrderByOption.Name] ?? "Name" },
  { key: OrderByOption.AddedAt, label: AUTHOR_ORDER_BY_LABELS[OrderByOption.AddedAt] ?? "Added At" },
  { key: OrderByOption.FavouriteCount, label: AUTHOR_ORDER_BY_LABELS[OrderByOption.FavouriteCount] ?? "Favourites" },
  { key: OrderByOption.ReadCount, label: AUTHOR_ORDER_BY_LABELS[OrderByOption.ReadCount] ?? "Read Count" },
];

/** Order-by options for posts by a single author */
export const AUTHOR_POST_ORDER_OPTIONS: { key: OrderByOption; label: string }[] = [
  { key: OrderByOption.AddedAt, label: ORDER_BY_LABELS[OrderByOption.AddedAt] },
  { key: OrderByOption.PostedAt, label: ORDER_BY_LABELS[OrderByOption.PostedAt] },
  { key: OrderByOption.Rating, label: ORDER_BY_LABELS[OrderByOption.Rating] },
  { key: OrderByOption.Length, label: ORDER_BY_LABELS[OrderByOption.Length] },
  { key: OrderByOption.ReadAt, label: ORDER_BY_LABELS[OrderByOption.ReadAt] },
];
