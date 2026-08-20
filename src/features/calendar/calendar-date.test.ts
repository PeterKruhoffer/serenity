import { DateTime } from "luxon";
import { describe, expect, it } from "vite-plus/test";
import {
  calendarDate,
  calendarRange,
  occurrenceOverlapsDay,
  shiftCalendarDate,
} from "./calendar-date";

describe("calendar ranges", () => {
  it("builds a Monday-to-Sunday week in the organization timezone", () => {
    const range = calendarRange("2026-08-19", "week", "Europe/Copenhagen");
    expect(range.days.map((day) => day.toISODate())).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
    expect(range.end.toMillis() - range.start.toMillis()).toBe(7 * 86_400_000);
  });

  it("includes adjacent days needed to complete a month grid", () => {
    const range = calendarRange("2026-08-19", "month", "Europe/Copenhagen");
    expect(range.days[0]?.toISODate()).toBe("2026-07-27");
    expect(range.days.at(-1)?.toISODate()).toBe("2026-09-06");
    expect(range.days).toHaveLength(42);
  });

  it("uses stable month paging and rejects invalid URL dates", () => {
    expect(shiftCalendarDate("2026-01-31", "month", 1, "UTC")).toBe("2026-02-01");
    expect(calendarDate("2026-02-30", "UTC", DateTime.fromISO("2026-08-19T12:00:00Z"))).toBe(
      "2026-08-19",
    );
  });

  it("uses half-open boundaries when placing occurrences on days", () => {
    const day = DateTime.fromISO("2026-08-19", { zone: "UTC" });
    expect(occurrenceOverlapsDay(day.minus({ hours: 1 }).toMillis(), day.toMillis(), day)).toBe(
      false,
    );
    expect(occurrenceOverlapsDay(day.toMillis(), day.plus({ hours: 1 }).toMillis(), day)).toBe(
      true,
    );
  });
});
