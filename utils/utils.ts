export function rowsToArray<T>(result: SQLite.SQLResultSet): T[] {
  const items: T[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    items.push(result.rows.item(i));
  }
  return items;
}