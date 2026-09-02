import styles from "./calendar.module.css";
import Calendar from "@corvu/calendar";
import Popover from "@corvu/popover";
import { useSearchParams } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex-solidjs";
import { DateTime } from "luxon";
import { For, Show, createMemo, createSignal } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { convexErrorMessage } from "../../lib/convex-error-message";
import { useWorkspace } from "../workspace/WorkspaceContext";
import {
  calendarDate,
  calendarRange,
  nativeToPlainDate,
  occurrenceOverlapsDay,
  plainDateToNative,
  shiftCalendarDate,
  type CalendarView,
} from "./calendar-date";

type Occurrence = FunctionReturnType<typeof api.events.listCalendarOccurrences>[number];

const statusLabel = (status: Occurrence["eventStatus"]) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const formatOccurrenceTime = (occurrence: Occurrence) => {
  const start = DateTime.fromMillis(occurrence.startsAt, { zone: occurrence.eventTimezone });
  const end = DateTime.fromMillis(occurrence.endsAt, { zone: occurrence.eventTimezone });
  return start.hasSame(end, "day")
    ? `${start.toFormat("ccc d LLL · HH:mm")}–${end.toFormat("HH:mm")}`
    : `${start.toFormat("ccc d LLL · HH:mm")} – ${end.toFormat("ccc d LLL · HH:mm")}`;
};

function EventChip(props: { occurrence: Occurrence }) {
  return (
    <Popover placement="bottom-start">
      <Popover.Trigger
        class={`${styles.eventChip} ${styles[`status${statusLabel(props.occurrence.eventStatus)}`]}`}
        classList={{ [styles.isCancelled]: props.occurrence.occurrenceStatus === "cancelled" }}
      >
        <strong>{props.occurrence.eventTitle}</strong>
        <span>
          {props.occurrence.teamName} · {statusLabel(props.occurrence.eventStatus)}
          <Show when={props.occurrence.occurrenceStatus === "cancelled"}> · Cancelled</Show>
        </span>
      </Popover.Trigger>
      <Popover.Content class={styles.eventPopover}>
        <Popover.Label>{props.occurrence.eventTitle}</Popover.Label>
        <Popover.Description>{formatOccurrenceTime(props.occurrence)}</Popover.Description>
        <dl>
          <div>
            <dt>Team</dt>
            <dd>{props.occurrence.teamName}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {statusLabel(props.occurrence.eventStatus)}
              <Show when={props.occurrence.occurrenceStatus === "cancelled"}> · Cancelled</Show>
            </dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>{props.occurrence.venueName}</dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>{props.occurrence.eventTimezone}</dd>
          </div>
        </dl>
        <Popover.Close class={styles.popoverClose}>Close</Popover.Close>
      </Popover.Content>
    </Popover>
  );
}

function WeekDay(props: {
  day: DateTime;
  occurrences: readonly Occurrence[];
  isLoading: boolean;
  isToday: boolean;
}) {
  const occurrences = createMemo(() => props.occurrences);

  return (
    <section class={styles.weekDay} aria-label={props.day.toFormat("cccc, d LLLL")}>
      <header classList={{ [styles.isToday]: props.isToday }}>
        <span>{props.day.toFormat("ccc")}</span>
        <strong>{props.day.day}</strong>
      </header>
      <div class={styles.dayEvents}>
        <For each={occurrences()}>{(occurrence) => <EventChip occurrence={occurrence} />}</For>
        <Show when={!props.isLoading && occurrences().length === 0}>
          <span class={styles.noEvents}>No events</span>
        </Show>
      </div>
    </section>
  );
}

function MonthDay(props: {
  day: DateTime;
  occurrences: readonly Occurrence[];
  isCurrentMonth: boolean;
  isExpanded: boolean;
  isToday: boolean;
  onToggleExpanded: () => void;
}) {
  const occurrences = createMemo(() => props.occurrences);
  const visibleOccurrences = createMemo(() =>
    props.isExpanded ? occurrences() : occurrences().slice(0, 3),
  );

  return (
    <section
      class={styles.monthDay}
      classList={{
        [styles.isOutsideMonth]: !props.isCurrentMonth,
        [styles.isToday]: props.isToday,
      }}
      aria-label={props.day.toFormat("cccc, d LLLL")}
    >
      <span class={styles.monthDayNumber}>{props.day.day}</span>
      <div class={styles.dayEvents}>
        <For each={visibleOccurrences()}>
          {(occurrence) => <EventChip occurrence={occurrence} />}
        </For>
        <Show when={occurrences().length > 3}>
          <button class={styles.moreButton} type="button" onClick={props.onToggleExpanded}>
            {props.isExpanded ? "Show less" : `+${occurrences().length - 3} more`}
          </button>
        </Show>
      </div>
    </section>
  );
}

export default function CalendarPage() {
  const { activeOrganization } = useWorkspace();
  const organization = activeOrganization;
  const [searchParams, setSearchParams] = useSearchParams();
  const [datePickerOpen, setDatePickerOpen] = createSignal(false);
  const [expandedDays, setExpandedDays] = createSignal<string[]>([]);
  const view = (): CalendarView => (searchParams.view === "week" ? "week" : "month");
  const anchorDate = () =>
    calendarDate(
      typeof searchParams.date === "string" ? searchParams.date : undefined,
      organization().defaultTimezone,
    );
  const selectedTeamId = () =>
    organization().teams.find((team) => team.id === searchParams.team)?.id;
  const range = createMemo(() =>
    calendarRange(anchorDate(), view(), organization().defaultTimezone),
  );
  const today = () => DateTime.now().setZone(organization().defaultTimezone);
  const occurrences = useQuery(api.events.listCalendarOccurrences, () => ({
    organizationId: organization().id,
    rangeStart: range().start.toMillis(),
    rangeEnd: range().end.toMillis(),
    ...(selectedTeamId() ? { teamId: selectedTeamId() } : {}),
  }));
  const occurrencesForDay = (day: DateTime) =>
    occurrences
      .data()
      ?.filter((occurrence) =>
        occurrenceOverlapsDay(occurrence.startsAt, occurrence.endsAt, day),
      ) ?? [];
  const isCurrentMonth = (day: DateTime) =>
    day.hasSame(DateTime.fromISO(anchorDate(), { zone: organization().defaultTimezone }), "month");
  const setDate = (date: string) => setSearchParams({ date });
  const move = (direction: -1 | 1) =>
    setDate(shiftCalendarDate(anchorDate(), view(), direction, organization().defaultTimezone));
  const chooseDate = (date: Date | null) => {
    if (!date) return;
    setDate(nativeToPlainDate(date));
    setDatePickerOpen(false);
  };
  const toggleExpandedDay = (date: string) =>
    setExpandedDays((days) =>
      days.includes(date) ? days.filter((day) => day !== date) : [...days, date],
    );

  return (
    <Page.Root labelledBy="calendar-page-title">
      <Page.Header variant="page">
        <Page.Heading>
          <Page.Eyebrow>Organization schedule</Page.Eyebrow>
          <Page.Title id="calendar-page-title">Calendar</Page.Title>
          <Page.Description>
            Draft, submitted, and published events across the teams you can access.
          </Page.Description>
        </Page.Heading>
        <Page.Meta>{organization().defaultTimezone}</Page.Meta>
      </Page.Header>

      <div class={styles.toolbar}>
        <div class={styles.periodControls}>
          <button type="button" onClick={() => move(-1)} aria-label={`Previous ${view()}`}>
            ←
          </button>
          <button type="button" onClick={() => move(1)} aria-label={`Next ${view()}`}>
            →
          </button>
          <button
            type="button"
            class={styles.todayButton}
            onClick={() => setDate(today().toISODate()!)}
          >
            Today
          </button>
          <h2>{range().label}</h2>
        </div>
        <div class={styles.filterControls}>
          <label>
            <span class={styles.srOnly}>Filter by team</span>
            <select
              aria-label="Filter by team"
              value={selectedTeamId() ?? ""}
              onChange={(event) =>
                setSearchParams({ team: event.currentTarget.value || undefined })
              }
            >
              <option value="">All teams</option>
              <For each={organization().teams}>
                {(team) => <option value={team.id}>{team.name}</option>}
              </For>
            </select>
          </label>
          <div class={styles.viewSwitch} aria-label="Calendar view">
            <button
              type="button"
              classList={{ [styles.isActive]: view() === "week" }}
              aria-pressed={view() === "week"}
              onClick={() => setSearchParams({ view: "week" })}
            >
              Week
            </button>
            <button
              type="button"
              classList={{ [styles.isActive]: view() === "month" }}
              aria-pressed={view() === "month"}
              onClick={() => setSearchParams({ view: "month" })}
            >
              Month
            </button>
          </div>
          <Popover open={datePickerOpen()} onOpenChange={setDatePickerOpen} placement="bottom-end">
            <Popover.Trigger class={styles.jumpButton}>Jump to date</Popover.Trigger>
            <Popover.Content class={styles.datePickerPopover}>
              <Calendar
                mode="single"
                value={plainDateToNative(anchorDate())}
                onValueChange={chooseDate}
                fixedWeeks
              >
                {(calendar) => (
                  <>
                    <div class={styles.datePickerHeading}>
                      <Calendar.Nav action="prev-month" aria-label="Previous month">
                        ←
                      </Calendar.Nav>
                      <Calendar.Label>
                        {DateTime.fromJSDate(calendar.month).toFormat("LLLL yyyy")}
                      </Calendar.Label>
                      <Calendar.Nav action="next-month" aria-label="Next month">
                        →
                      </Calendar.Nav>
                    </div>
                    <Calendar.Table class={styles.datePickerTable}>
                      <thead>
                        <tr>
                          <For each={calendar.weekdays}>
                            {(weekday) => (
                              <Calendar.HeadCell
                                abbr={DateTime.fromJSDate(weekday).toFormat("cccc")}
                              >
                                {DateTime.fromJSDate(weekday).toFormat("ccccc")}
                              </Calendar.HeadCell>
                            )}
                          </For>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={calendar.weeks}>
                          {(week) => (
                            <tr>
                              <For each={week}>
                                {(day) => (
                                  <Calendar.Cell>
                                    <Calendar.CellTrigger day={day}>
                                      {day.getDate()}
                                    </Calendar.CellTrigger>
                                  </Calendar.Cell>
                                )}
                              </For>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </Calendar.Table>
                  </>
                )}
              </Calendar>
            </Popover.Content>
          </Popover>
        </div>
      </div>

      <Show when={occurrences.error()}>
        <FormError>{convexErrorMessage(occurrences.error())}</FormError>
      </Show>

      <div class={styles.calendarFrame} aria-busy={occurrences.isLoading()}>
        <Show when={view() === "week"}>
          <div class={styles.weekGrid}>
            <For each={range().days}>
              {(day) => (
                <WeekDay
                  day={day}
                  occurrences={occurrencesForDay(day)}
                  isLoading={occurrences.isLoading()}
                  isToday={day.hasSame(today(), "day")}
                />
              )}
            </For>
          </div>
        </Show>

        <Show when={view() === "month"}>
          <div class={styles.monthScroller}>
            <div class={styles.monthGrid}>
              <For each={range().days.slice(0, 7)}>
                {(day) => <div class={styles.monthWeekday}>{day.toFormat("ccc")}</div>}
              </For>
              <For each={range().days}>
                {(day) => (
                  <MonthDay
                    day={day}
                    occurrences={occurrencesForDay(day)}
                    isCurrentMonth={isCurrentMonth(day)}
                    isExpanded={expandedDays().includes(day.toISODate()!)}
                    isToday={day.hasSame(today(), "day")}
                    onToggleExpanded={() => toggleExpandedDay(day.toISODate()!)}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Page.Root>
  );
}
