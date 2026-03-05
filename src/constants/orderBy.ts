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
  [OrderByOption.AddedAt]: "Date Added",
  [OrderByOption.UpdatedAt]: "Last Updated",
  [OrderByOption.ReadAt]: "Last Read",
  [OrderByOption.Rating]: "Rating",
  [OrderByOption.Title]: "Title",
  [OrderByOption.Length]: "Length",
  [OrderByOption.Random]: "Random",
};
