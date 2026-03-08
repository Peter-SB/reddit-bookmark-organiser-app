export enum OrderByOption {
  AddedAt = "addedAt",
  UpdatedAt = "updatedAt",
  ReadAt = "readAt",
  Rating = "rating",
  Title = "title",
  Length = "length",
  Random = "random",
}

export const ORDER_BY_LABELS: Record<OrderByOption, string> = {
  [OrderByOption.AddedAt]: "Added At",
  [OrderByOption.UpdatedAt]: "Updated At",
  [OrderByOption.ReadAt]: "Read At",
  [OrderByOption.Rating]: "Rating",
  [OrderByOption.Title]: "Title",
  [OrderByOption.Length]: "Length",
  [OrderByOption.Random]: "Random",
};