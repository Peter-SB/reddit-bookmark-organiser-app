export function parseDbDate(value: string | number | Date | null | undefined): Date {
  // Catch possible input types
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value !== "string") return new Date(NaN);

  const trimmed = value.trim();
  if (!trimmed) return new Date(NaN);
  
  const hasTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed);
  const isoLike = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return new Date(hasTimezone ? isoLike : `${isoLike}Z`);
}
