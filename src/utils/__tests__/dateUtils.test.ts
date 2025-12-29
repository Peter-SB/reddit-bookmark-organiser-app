import { parseDbDate } from "@/utils/datetimeUtils";

describe("parseDbDate", () => {
  it("treats timestamps without timezone as UTC", () => {
    const date = parseDbDate("2025-07-21 19:14:17");
    expect(date.toISOString()).toBe("2025-07-21T19:14:17.000Z");
  });

  it("keeps timestamps with Z as UTC", () => {
    const date = parseDbDate("2025-07-21T19:14:17Z");
    expect(date.toISOString()).toBe("2025-07-21T19:14:17.000Z");
  });
});
