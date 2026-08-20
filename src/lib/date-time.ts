import { DateTime, IANAZone } from "luxon";

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const timezoneOptions = () => {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
};

export const localDateTimeToMillis = (value: string, timezone: string) => {
  if (!IANAZone.isValidZone(timezone)) return Number.NaN;
  const dateTime = DateTime.fromISO(value, { zone: timezone, setZone: true });
  return dateTime.isValid ? dateTime.toMillis() : Number.NaN;
};

export const millisToLocalDateTime = (value: number, timezone: string) =>
  DateTime.fromMillis(value, { zone: timezone }).toFormat("yyyy-LL-dd'T'HH:mm");
