import { DateTime, IANAZone } from "luxon";

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const timezoneOptions = () => {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
};

export type TimezoneOption = {
  timezone: string;
  abbreviations: string[];
};

const abbreviationDates = [new Date("2026-01-15T12:00:00Z"), new Date("2026-07-15T12:00:00Z")];

const commonTimezoneAliases: Record<string, string[]> = {
  "America/Chicago": ["CST", "CDT", "CT"],
  "America/Denver": ["MST", "MDT", "MT"],
  "America/Los_Angeles": ["PST", "PDT", "PT"],
  "America/New_York": ["EST", "EDT", "ET"],
  "America/Vancouver": ["PST", "PDT", "PT"],
  "Asia/Kolkata": ["IST"],
  "Asia/Tokyo": ["JST"],
  "Australia/Sydney": ["AEST", "AEDT"],
  "Europe/Amsterdam": ["CET", "CEST"],
  "Europe/Berlin": ["CET", "CEST"],
  "Europe/Copenhagen": ["CET", "CEST"],
  "Europe/London": ["GMT", "BST"],
  "Europe/Madrid": ["CET", "CEST"],
  "Europe/Paris": ["CET", "CEST"],
  "Europe/Prague": ["CET", "CEST"],
  "Europe/Rome": ["CET", "CEST"],
  "Europe/Warsaw": ["CET", "CEST"],
};

const timezoneName = (timezone: string, date: Date, format: "short" | "long") =>
  new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: format })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

export const timezoneTypeaheadOptions = (): TimezoneOption[] =>
  timezoneOptions().map((timezone) => ({
    timezone,
    abbreviations: [
      ...new Set([
        ...abbreviationDates.flatMap((date) => {
          const longName = timezoneName(timezone, date, "long");
          const initials = longName
            ?.split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase();
          return [timezoneName(timezone, date, "short"), initials];
        }),
        ...(commonTimezoneAliases[timezone] ?? []),
      ]),
    ].filter(
      (abbreviation): abbreviation is string =>
        typeof abbreviation === "string" && abbreviation.length <= 6,
    ),
  }));

const normalizedTimezoneSearch = (value: string) =>
  value.toLocaleLowerCase().replaceAll("_", " ").trim();

export const searchTimezones = (
  options: TimezoneOption[],
  query: string,
  limit = 12,
): TimezoneOption[] => {
  const search = normalizedTimezoneSearch(query);
  if (!search) return options.slice(0, limit);

  return options
    .map((option) => {
      const terms = [
        option.timezone,
        option.timezone.replaceAll("/", " "),
        ...option.abbreviations,
      ].map(normalizedTimezoneSearch);
      const rank = terms.some((term) => term === search)
        ? 0
        : terms.some((term) => term.startsWith(search))
          ? 1
          : terms.some((term) => term.includes(search))
            ? 2
            : -1;
      return { option, rank };
    })
    .filter(({ rank }) => rank >= 0)
    .sort((left, right) => left.rank - right.rank)
    .slice(0, limit)
    .map(({ option }) => option);
};

export const localDateTimeToMillis = (value: string, timezone: string) => {
  if (!IANAZone.isValidZone(timezone)) return Number.NaN;
  const dateTime = DateTime.fromISO(value, { zone: timezone, setZone: true });
  return dateTime.isValid ? dateTime.toMillis() : Number.NaN;
};

export const millisToLocalDateTime = (value: number, timezone: string) =>
  DateTime.fromMillis(value, { zone: timezone }).toFormat("yyyy-LL-dd'T'HH:mm");
