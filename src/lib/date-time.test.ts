import { describe, expect, it } from "vite-plus/test";
import { localDateTimeToMillis, millisToLocalDateTime } from "./date-time";

describe("event timezone conversion", () => {
  it("interprets a wall-clock value in the event timezone, not the browser timezone", () => {
    expect(localDateTimeToMillis("2026-01-15T09:00", "America/New_York")).toBe(
      Date.UTC(2026, 0, 15, 14),
    );
    expect(localDateTimeToMillis("2026-01-15T09:00", "Europe/Copenhagen")).toBe(
      Date.UTC(2026, 0, 15, 8),
    );
  });

  it("round-trips valid wall-clock times across daylight-saving changes", () => {
    const beforeChange = localDateTimeToMillis("2026-03-28T09:00", "Europe/Copenhagen");
    const afterChange = localDateTimeToMillis("2026-03-30T09:00", "Europe/Copenhagen");

    expect(millisToLocalDateTime(beforeChange, "Europe/Copenhagen")).toBe("2026-03-28T09:00");
    expect(millisToLocalDateTime(afterChange, "Europe/Copenhagen")).toBe("2026-03-30T09:00");
    expect(afterChange - beforeChange).toBe(47 * 3_600_000);
  });

  it("rejects an invalid IANA timezone", () => {
    expect(localDateTimeToMillis("2026-01-15T09:00", "Not/A_Zone")).toBeNaN();
  });
});
