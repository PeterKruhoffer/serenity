import { DateTime } from "luxon";

export type CalendarView = "week" | "month";

export const calendarDate = (
  value: string | undefined,
  timezone: string,
  now: DateTime<boolean> = DateTime.now(),
) => {
  if (value) {
    const parsed = DateTime.fromISO(value, { zone: timezone });
    if (parsed.isValid && parsed.toISODate() === value) return value;
  }
  return now.setZone(timezone).toISODate()!;
};

export const calendarRange = (date: string, view: CalendarView, timezone: string) => {
  const anchor = DateTime.fromISO(date, { zone: timezone }).startOf("day");
  const start = view === "week" ? anchor.startOf("week") : anchor.startOf("month").startOf("week");
  const end =
    view === "week"
      ? start.plus({ weeks: 1 })
      : anchor.endOf("month").endOf("week").plus({ milliseconds: 1 }).startOf("day");
  const days: DateTime[] = [];
  for (let day = start; day < end; day = day.plus({ days: 1 })) days.push(day);

  return {
    start,
    end,
    days,
    label:
      view === "month"
        ? anchor.toFormat("LLLL yyyy")
        : `${start.toFormat("d LLL")} – ${end.minus({ days: 1 }).toFormat("d LLL yyyy")}`,
  };
};

export const shiftCalendarDate = (
  date: string,
  view: CalendarView,
  direction: -1 | 1,
  timezone: string,
) => {
  const anchor = DateTime.fromISO(date, { zone: timezone });
  return (
    view === "week"
      ? anchor.plus({ weeks: direction })
      : anchor.startOf("month").plus({ months: direction })
  ).toISODate()!;
};

export const occurrenceOverlapsDay = (startsAt: number, endsAt: number, day: DateTime) =>
  startsAt < day.plus({ days: 1 }).toMillis() && endsAt > day.toMillis();

export const plainDateToNative = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12);
};

export const nativeToPlainDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
