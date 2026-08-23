import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

type SeedDate = {
  startsAt: number;
  endsAt: number;
  venueName: string;
  status?: "scheduled" | "cancelled";
  sessions?: {
    title: string;
    startsAt: number;
    endsAt: number;
    roomName: string;
  }[];
};

type SignupField = {
  type: "text" | "textarea" | "yes_no" | "checkboxes";
  label: string;
  required: boolean;
  options: string[];
  section?: string;
};

type SeedEvent = {
  title: string;
  slug: string;
  description: string;
  team: string;
  type: "network" | "course" | "free-meetup" | "conference";
  timezone?: string;
  status: "draft" | "submitted" | "published" | "archived";
  rejected?: boolean;
  capacity: number;
  autoAccept: boolean;
  waitingListEnabled: boolean;
  dates: SeedDate[];
  signupFields?: SignupField[];
};

const DAY = 86_400_000;
const SEED_MARKER_SLUG = "serenity-demo-leadership-intensive";
const SEED_EVENT_SLUGS = [
  SEED_MARKER_SLUG,
  "serenity-demo-network-breakfast",
  "serenity-demo-community-meetup",
  "serenity-demo-product-conference",
  "serenity-demo-remote-lab",
  "serenity-demo-facilitator-workshop",
  "serenity-demo-peer-circle",
  "serenity-demo-inclusive-clinic",
  "serenity-demo-alumni-gathering",
] as const;

const signupFields: SignupField[] = [
  {
    type: "text",
    label: "Job title",
    required: true,
    options: [],
    section: "About you",
  },
  {
    type: "textarea",
    label: "What would make this event useful for you?",
    required: false,
    options: [],
    section: "Goals",
  },
  {
    type: "yes_no",
    label: "May we include you in the participant list?",
    required: true,
    options: [],
    section: "Permissions",
  },
  {
    type: "checkboxes",
    label: "Dietary requirements",
    required: false,
    options: ["Vegetarian", "Vegan", "Gluten-free", "Nut allergy"],
    section: "Practical details",
  },
];

const ensureTeam = async (
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  name: string,
  slug: string,
  now: number,
) => {
  const existing = await ctx.db
    .query("teams")
    .withIndex("by_organizationId_and_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", slug),
    )
    .unique();
  if (existing) return existing._id;
  return await ctx.db.insert("teams", {
    organizationId,
    name,
    slug,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
};

const ensureEventType = async (
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  name: string,
  slug: string,
  capabilities: { hasOccurrences: boolean; hasSessions: boolean; hasRegistration: boolean },
  now: number,
) => {
  const existing = await ctx.db
    .query("event_types")
    .withIndex("by_organizationId_and_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", slug),
    )
    .unique();
  if (existing) {
    const version = await ctx.db
      .query("event_type_versions")
      .withIndex("by_eventTypeId_and_version", (q) =>
        q.eq("eventTypeId", existing._id).eq("version", existing.latestVersion),
      )
      .unique();
    if (!version) throw new Error(`Event type ${slug} has no current version.`);
    return version._id;
  }
  const eventTypeId = await ctx.db.insert("event_types", {
    organizationId,
    name,
    slug,
    status: "active",
    latestVersion: 1,
    createdAt: now,
    updatedAt: now,
  });
  return await ctx.db.insert("event_type_versions", {
    organizationId,
    eventTypeId,
    version: 1,
    ...capabilities,
    createdAt: now,
  });
};

const requireSeedActor = async (
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  actorIdentity: string,
) => {
  const organization = await ctx.db.get("organizations", organizationId);
  if (!organization || organization.status !== "active") {
    throw new Error("Choose an active organization.");
  }
  const membership = await ctx.db
    .query("organization_memberships")
    .withIndex("by_organizationId_and_identityToken", (q) =>
      q.eq("organizationId", organizationId).eq("identityToken", actorIdentity),
    )
    .unique();
  if (!membership || membership.status !== "active") {
    throw new Error("The seed actor must be an active organization member.");
  }
  return organization;
};

const seedDemoData = async (
  ctx: MutationCtx,
  { organizationId, actorIdentity }: { organizationId: Id<"organizations">; actorIdentity: string },
) => {
  const organization = await requireSeedActor(ctx, organizationId, actorIdentity);

  const existingMarker = await ctx.db
    .query("events")
    .withIndex("by_organizationId_and_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", SEED_MARKER_SLUG),
    )
    .unique();
  if (existingMarker) {
    return { created: false, eventCount: 0, teamCount: 0, participantCount: 0 };
  }

  const now = Date.now();
  const today = Math.floor(now / DAY) * DAY;
  const at = (dayOffset: number, hour: number, minute = 0) =>
    today + dayOffset * DAY + hour * 3_600_000 + minute * 60_000;
  const date = (
    dayOffset: number,
    startHour: number,
    endHour: number,
    venueName: string,
    sessions: SeedDate["sessions"] = [],
    status: SeedDate["status"] = "scheduled",
  ): SeedDate => ({
    startsAt: at(dayOffset, startHour),
    endsAt: at(dayOffset, endHour),
    venueName,
    status,
    sessions,
  });
  const session = (
    dayOffset: number,
    title: string,
    startHour: number,
    endHour: number,
    roomName: string,
  ) => ({
    title,
    startsAt: at(dayOffset, startHour),
    endsAt: at(dayOffset, endHour),
    roomName,
  });

  const teamIds = {
    network: await ensureTeam(ctx, organizationId, "Network", "network", now),
    course: await ensureTeam(ctx, organizationId, "Course", "course", now),
    community: await ensureTeam(ctx, organizationId, "Community", "community", now),
    conference: await ensureTeam(ctx, organizationId, "Conferences", "conferences", now),
  };
  const eventTypeVersionIds = {
    network: await ensureEventType(
      ctx,
      organizationId,
      "Recurring network meeting",
      "network",
      { hasOccurrences: true, hasSessions: false, hasRegistration: true },
      now,
    ),
    course: await ensureEventType(
      ctx,
      organizationId,
      "Course",
      "course",
      { hasOccurrences: true, hasSessions: true, hasRegistration: true },
      now,
    ),
    "free-meetup": await ensureEventType(
      ctx,
      organizationId,
      "Free meetup",
      "free-meetup",
      { hasOccurrences: true, hasSessions: false, hasRegistration: true },
      now,
    ),
    conference: await ensureEventType(
      ctx,
      organizationId,
      "Full-day conference",
      "conference",
      { hasOccurrences: true, hasSessions: true, hasRegistration: true },
      now,
    ),
  };

  const events: SeedEvent[] = [
    {
      title: "Leadership Intensive",
      slug: SEED_MARKER_SLUG,
      description: "A paid three-day course with a full session plan and participant intake form.",
      team: "course",
      type: "course",
      status: "published",
      capacity: 12,
      autoAccept: false,
      waitingListEnabled: true,
      signupFields,
      dates: [
        date(4, 8, 16, "Harbor House", [
          session(4, "Leadership foundations", 9, 11, "Studio 1"),
          session(4, "Feedback in practice", 12, 15, "Studio 2"),
        ]),
        date(5, 8, 16, "Harbor House", [
          session(5, "Leading through change", 9, 11, "Studio 1"),
          session(5, "Case clinic", 12, 15, "Studio 2"),
        ]),
        date(6, 8, 15, "Harbor House", [
          session(6, "Difficult conversations", 9, 11, "Studio 1"),
          session(6, "Personal action plan", 12, 14, "Studio 1"),
        ]),
      ],
    },
    {
      title: "Copenhagen Network Breakfast",
      slug: "serenity-demo-network-breakfast",
      description: "A recurring network series. Registration covers every breakfast.",
      team: "network",
      type: "network",
      status: "published",
      capacity: 30,
      autoAccept: true,
      waitingListEnabled: true,
      dates: [
        date(-16, 8, 10, "The Glasshouse"),
        date(2, 8, 10, "The Glasshouse"),
        date(20, 8, 10, "The Glasshouse"),
        date(38, 8, 10, "The Glasshouse", [], "cancelled"),
        date(56, 8, 10, "The Glasshouse"),
      ],
    },
    {
      title: "Open Community Meetup",
      slug: "serenity-demo-community-meetup",
      description: "A free evening meetup with automatic acceptance and a short waiting list.",
      team: "community",
      type: "free-meetup",
      status: "published",
      capacity: 3,
      autoAccept: true,
      waitingListEnabled: true,
      signupFields: [signupFields[0]!, signupFields[2]!],
      dates: [date(10, 17, 20, "The Foundry")],
    },
    {
      title: "Nordic Product Conference",
      slug: "serenity-demo-product-conference",
      description: "A full-day conference with parallel sessions in several rooms.",
      team: "conference",
      type: "conference",
      status: "published",
      capacity: 180,
      autoAccept: true,
      waitingListEnabled: false,
      signupFields,
      dates: [
        date(28, 8, 18, "Dockside Convention Hall", [
          session(28, "Opening keynote", 9, 10, "Main stage"),
          session(28, "Product operations", 10, 12, "Harbor room"),
          session(28, "Research systems", 10, 12, "Canal room"),
          session(28, "Closing panel", 16, 17, "Main stage"),
        ]),
      ],
    },
    {
      title: "Remote Leadership Lab",
      slug: "serenity-demo-remote-lab",
      description: "A published online course split across three weekly dates.",
      team: "course",
      type: "course",
      timezone: "America/New_York",
      status: "published",
      capacity: 20,
      autoAccept: false,
      waitingListEnabled: false,
      dates: [
        date(-12, 14, 17, "Online", [session(-12, "Kickoff", 14, 16, "Zoom A")]),
        date(-5, 14, 17, "Online", [session(-5, "Practice lab", 14, 16, "Zoom A")]),
        date(2, 14, 17, "Online", [session(2, "Retrospective", 14, 16, "Zoom A")]),
      ],
    },
    {
      title: "Facilitator Workshop",
      slug: "serenity-demo-facilitator-workshop",
      description: "A two-day course currently waiting for publication approval.",
      team: "course",
      type: "course",
      status: "submitted",
      capacity: 16,
      autoAccept: false,
      waitingListEnabled: true,
      dates: [
        date(14, 9, 16, "Learning Center", [
          session(14, "Designing exercises", 10, 12, "Workshop room"),
        ]),
        date(15, 9, 16, "Learning Center", [
          session(15, "Practice facilitation", 10, 14, "Workshop room"),
        ]),
      ],
    },
    {
      title: "Autumn Peer Circle",
      slug: "serenity-demo-peer-circle",
      description: "An early draft for a recurring peer network.",
      team: "network",
      type: "network",
      status: "draft",
      capacity: 24,
      autoAccept: false,
      waitingListEnabled: true,
      dates: [date(19, 15, 17, "Library meeting room"), date(33, 15, 17, "To be confirmed")],
    },
    {
      title: "Inclusive Events Clinic",
      slug: "serenity-demo-inclusive-clinic",
      description: "A rejected free-event draft with review history to revise.",
      team: "community",
      type: "free-meetup",
      status: "draft",
      rejected: true,
      capacity: 25,
      autoAccept: true,
      waitingListEnabled: true,
      dates: [date(24, 16, 19, "Community Hub")],
    },
    {
      title: "Summer Alumni Gathering",
      slug: "serenity-demo-alumni-gathering",
      description: "A completed and archived free event from earlier this season.",
      team: "community",
      type: "free-meetup",
      status: "archived",
      capacity: 50,
      autoAccept: true,
      waitingListEnabled: false,
      dates: [date(-35, 17, 21, "Riverside Garden")],
    },
  ];

  const eventIds = new Map<string, Id<"events">>();
  const eventDateIds = new Map<string, Id<"event_dates">[]>();
  const revisionFieldIds = new Map<string, Id<"revision_signup_fields">[]>();

  for (const [eventIndex, event] of events.entries()) {
    const teamId = teamIds[event.team as keyof typeof teamIds];
    const eventTypeVersionId = eventTypeVersionIds[event.type];
    const sessionCount = event.dates.reduce((sum, item) => sum + (item.sessions?.length ?? 0), 0);
    const eventId = await ctx.db.insert("events", {
      organizationId,
      teamId,
      eventTypeVersionId,
      title: event.title,
      slug: event.slug,
      description: event.description,
      timezone: event.timezone ?? organization.defaultTimezone,
      status: event.status === "archived" ? "archived" : event.status,
      capacity: event.capacity,
      autoAccept: event.autoAccept,
      waitingListEnabled: event.waitingListEnabled,
      acceptedCount: 0,
      occurrenceCount: event.dates.length,
      sessionCount,
      createdByIdentity: actorIdentity,
      createdAt: now - (events.length - eventIndex) * DAY,
      updatedAt: now - eventIndex * 60_000,
    });
    eventIds.set(event.slug, eventId);

    const dateIds: Id<"event_dates">[] = [];
    const sourceFieldIds: {
      id: Id<"signup_form_fields">;
      field: SignupField;
      sortOrder: number;
    }[] = [];
    for (const [sortOrder, item] of event.dates.entries()) {
      const eventDateId = await ctx.db.insert("event_dates", {
        organizationId,
        eventId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        venueName: item.venueName,
        status: item.status ?? "scheduled",
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      dateIds.push(eventDateId);
      for (const [sessionSortOrder, itemSession] of (item.sessions ?? []).entries()) {
        await ctx.db.insert("sessions", {
          organizationId,
          eventId,
          eventDateId,
          ...itemSession,
          sortOrder: sessionSortOrder,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    eventDateIds.set(event.slug, dateIds);
    for (const [sortOrder, field] of (event.signupFields ?? []).entries()) {
      const id = await ctx.db.insert("signup_form_fields", {
        organizationId,
        eventId,
        ...field,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      sourceFieldIds.push({ id, field, sortOrder });
    }

    if (event.status === "draft" && !event.rejected) continue;

    const revisionStatus = event.rejected
      ? "rejected"
      : event.status === "submitted"
        ? "submitted"
        : "approved";
    const revisionId = await ctx.db.insert("event_revisions", {
      organizationId,
      eventId,
      teamId,
      eventTypeVersionId,
      revisionNumber: 1,
      status: revisionStatus,
      title: event.title,
      slug: event.slug,
      description: event.description,
      timezone: event.timezone ?? organization.defaultTimezone,
      occurrenceCount: event.dates.length,
      sessionCount,
      capacity: event.capacity,
      autoAccept: event.autoAccept,
      waitingListEnabled: event.waitingListEnabled,
      submittedByIdentity: actorIdentity,
      submittedAt: now - DAY,
      ...(revisionStatus === "submitted"
        ? {}
        : {
            reviewedByIdentity: actorIdentity,
            reviewedAt: now - DAY / 2,
            reviewNote: event.rejected
              ? "Please add accessibility details before resubmitting."
              : "Demo event approved.",
          }),
      ...(revisionStatus === "approved" ? { publishedVersion: 1 } : {}),
    });
    if (revisionStatus === "approved") {
      await ctx.db.patch("events", eventId, {
        publishedRevisionId: revisionId,
        publishedVersion: 1,
      });
    }

    const publishedFieldIds: Id<"revision_signup_fields">[] = [];
    for (const { id, field, sortOrder } of sourceFieldIds) {
      publishedFieldIds.push(
        await ctx.db.insert("revision_signup_fields", {
          organizationId,
          revisionId,
          sourceSignupFieldId: id,
          ...field,
          sortOrder,
        }),
      );
    }
    revisionFieldIds.set(event.slug, publishedFieldIds);
    for (const [sortOrder, item] of event.dates.entries()) {
      const sourceEventDateId = dateIds[sortOrder]!;
      const revisionDateId = await ctx.db.insert("revision_dates", {
        organizationId,
        revisionId,
        sourceEventDateId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        venueName: item.venueName,
        status: item.status ?? "scheduled",
        sortOrder,
      });
      const sourceSessions = await ctx.db
        .query("sessions")
        .withIndex("by_eventDateId_and_sortOrder", (q) => q.eq("eventDateId", sourceEventDateId))
        .collect();
      for (const sourceSession of sourceSessions) {
        await ctx.db.insert("revision_sessions", {
          organizationId,
          revisionId,
          revisionDateId,
          sourceSessionId: sourceSession._id,
          title: sourceSession.title,
          startsAt: sourceSession.startsAt,
          endsAt: sourceSession.endsAt,
          roomName: sourceSession.roomName,
          sortOrder: sourceSession.sortOrder,
        });
      }
    }
  }

  const insertTemplate = async (
    name: string,
    scope: "organization" | "team",
    fields: SignupField[],
    teamId?: Id<"teams">,
  ) => {
    const templateId = await ctx.db.insert("signup_form_templates", {
      organizationId,
      ...(teamId ? { teamId } : {}),
      name,
      scope,
      fieldCount: fields.length,
      createdByIdentity: actorIdentity,
      createdAt: now,
      updatedAt: now,
    });
    for (const [sortOrder, field] of fields.entries()) {
      await ctx.db.insert("signup_form_fields", {
        organizationId,
        templateId,
        ...field,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }
  };
  await insertTemplate("Standard participant details", "organization", signupFields);
  await insertTemplate("Network member profile", "team", signupFields.slice(0, 2), teamIds.network);

  const people = [
    ["alex", "Alex Jensen"],
    ["bea", "Bea Larsen"],
    ["chen", "Chen Wei"],
    ["daria", "Daria Novak"],
    ["eli", "Eli Thompson"],
    ["fatima", "Fatima Noor"],
    ["gabriel", "Gabriel Costa"],
    ["hana", "Hana Kim"],
    ["ines", "Ines Silva"],
    ["jonas", "Jonas Berg"],
    ["kira", "Kira Olsen"],
    ["lucas", "Lucas Martin"],
  ] as const;
  const participantIds = new Map<string, Id<"participants">>();
  for (const [externalId, displayName] of people) {
    participantIds.set(
      externalId,
      await ctx.db.insert("participants", {
        organizationId,
        externalId: `demo-${externalId}`,
        displayName,
        email: `${externalId}@example.test`,
        locale: externalId === "chen" ? "zh" : "en",
        synchronizedAt: now,
      }),
    );
  }

  const addRegistration = async (
    eventSlug: string,
    person: string,
    status: "pending" | "accepted" | "waitlisted" | "rejected" | "withdrawn",
    ticketName: string,
    priceMinor: number,
    paymentStatus: "not_required" | "unpaid" | "pending" | "paid" | "refunded",
  ) => {
    const eventId = eventIds.get(eventSlug)!;
    const participantId = participantIds.get(person)!;
    return await ctx.db.insert("registrations", {
      organizationId,
      eventId,
      participantId,
      status,
      ticketName,
      priceMinor,
      paymentStatus,
      ...(paymentStatus === "paid" ? { externalPaymentReference: `demo-payment-${person}` } : {}),
      registeredAt: now - 2 * DAY,
      updatedAt: now,
      ...(status === "accepted" ? { acceptedAt: now - DAY } : {}),
      ...(status === "withdrawn" ? { withdrawnAt: now - DAY / 2 } : {}),
    });
  };

  const leadershipSlug = SEED_MARKER_SLUG;
  const leadershipRegistrations = [
    await addRegistration(leadershipSlug, "alex", "accepted", "Professional", 85_000, "paid"),
    await addRegistration(leadershipSlug, "bea", "accepted", "Professional", 85_000, "pending"),
    await addRegistration(leadershipSlug, "chen", "pending", "Professional", 85_000, "unpaid"),
    await addRegistration(leadershipSlug, "daria", "waitlisted", "Professional", 85_000, "unpaid"),
    await addRegistration(leadershipSlug, "eli", "withdrawn", "Professional", 85_000, "refunded"),
    await addRegistration(leadershipSlug, "fatima", "rejected", "Professional", 85_000, "unpaid"),
  ];
  await ctx.db.patch("events", eventIds.get(leadershipSlug)!, { acceptedCount: 2 });

  const leadershipFields = revisionFieldIds.get(leadershipSlug)!;
  await ctx.db.insert("registration_answers", {
    organizationId,
    registrationId: leadershipRegistrations[0]!,
    revisionSignupFieldId: leadershipFields[0]!,
    valueType: "text",
    textValue: "Head of Product",
    createdAt: now,
  });
  await ctx.db.insert("registration_answers", {
    organizationId,
    registrationId: leadershipRegistrations[0]!,
    revisionSignupFieldId: leadershipFields[2]!,
    valueType: "boolean",
    booleanValue: true,
    createdAt: now,
  });
  await ctx.db.insert("registration_answers", {
    organizationId,
    registrationId: leadershipRegistrations[0]!,
    revisionSignupFieldId: leadershipFields[3]!,
    valueType: "selections",
    selectionValues: ["Vegetarian"],
    createdAt: now,
  });
  await ctx.db.insert("date_declines", {
    organizationId,
    eventId: eventIds.get(leadershipSlug)!,
    eventDateId: eventDateIds.get(leadershipSlug)![1]!,
    registrationId: leadershipRegistrations[1]!,
    participantId: participantIds.get("bea")!,
    status: "declined",
    declinedAt: now,
  });

  const meetupSlug = "serenity-demo-community-meetup";
  await addRegistration(meetupSlug, "gabriel", "accepted", "Free", 0, "not_required");
  await addRegistration(meetupSlug, "hana", "accepted", "Free", 0, "not_required");
  await addRegistration(meetupSlug, "ines", "accepted", "Free", 0, "not_required");
  await addRegistration(meetupSlug, "jonas", "waitlisted", "Free", 0, "not_required");
  await addRegistration(meetupSlug, "kira", "waitlisted", "Free", 0, "not_required");
  await ctx.db.patch("events", eventIds.get(meetupSlug)!, { acceptedCount: 3 });

  const networkSlug = "serenity-demo-network-breakfast";
  await addRegistration(networkSlug, "alex", "accepted", "Series pass", 0, "not_required");
  await addRegistration(networkSlug, "lucas", "accepted", "Series pass", 0, "not_required");
  await ctx.db.patch("events", eventIds.get(networkSlug)!, { acceptedCount: 2 });

  await ctx.db.insert("audit_entries", {
    organizationId,
    actorIdentity,
    action: "demo.seeded",
    entityType: "organization",
    entityId: organizationId,
    summary: `Seeded ${events.length} demo events across ${Object.keys(teamIds).length} teams`,
    occurredAt: now,
  });

  return {
    created: true,
    eventCount: events.length,
    teamCount: Object.keys(teamIds).length,
    participantCount: people.length,
  };
};

const resetDemoData = async (
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  actorIdentity: string,
) => {
  await requireSeedActor(ctx, organizationId, actorIdentity);
  const seedAudits = await ctx.db
    .query("audit_entries")
    .withIndex("by_organizationId_and_occurredAt", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .take(100);
  const seedAudit = seedAudits.find(({ action }) => action === "demo.seeded");

  const events = [];
  for (const slug of SEED_EVENT_SLUGS) {
    const event = await ctx.db
      .query("events")
      .withIndex("by_organizationId_and_slug", (q) =>
        q.eq("organizationId", organizationId).eq("slug", slug),
      )
      .unique();
    if (event) events.push(event);
  }

  for (const event of events) {
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_eventId_and_status", (q) => q.eq("eventId", event._id))
      .take(100);
    for (const registration of registrations) {
      const answers = await ctx.db
        .query("registration_answers")
        .withIndex("by_registrationId", (q) => q.eq("registrationId", registration._id))
        .take(50);
      for (const answer of answers) await ctx.db.delete("registration_answers", answer._id);

      const declines = await ctx.db
        .query("date_declines")
        .withIndex("by_registrationId_and_eventDateId", (q) =>
          q.eq("registrationId", registration._id),
        )
        .take(100);
      for (const decline of declines) await ctx.db.delete("date_declines", decline._id);
      await ctx.db.delete("registrations", registration._id);
    }

    const revisions = await ctx.db
      .query("event_revisions")
      .withIndex("by_eventId_and_revisionNumber", (q) => q.eq("eventId", event._id))
      .take(100);
    for (const revision of revisions) {
      const revisionDates = await ctx.db
        .query("revision_dates")
        .withIndex("by_revisionId_and_sortOrder", (q) => q.eq("revisionId", revision._id))
        .take(100);
      for (const revisionDate of revisionDates) {
        const revisionSessions = await ctx.db
          .query("revision_sessions")
          .withIndex("by_revisionDateId_and_sortOrder", (q) =>
            q.eq("revisionDateId", revisionDate._id),
          )
          .take(100);
        for (const revisionSession of revisionSessions) {
          await ctx.db.delete("revision_sessions", revisionSession._id);
        }
        await ctx.db.delete("revision_dates", revisionDate._id);
      }
      const revisionFields = await ctx.db
        .query("revision_signup_fields")
        .withIndex("by_revisionId_and_sortOrder", (q) => q.eq("revisionId", revision._id))
        .take(50);
      for (const field of revisionFields) await ctx.db.delete("revision_signup_fields", field._id);
      await ctx.db.delete("event_revisions", revision._id);
    }

    const dates = await ctx.db
      .query("event_dates")
      .withIndex("by_eventId_and_sortOrder", (q) => q.eq("eventId", event._id))
      .take(100);
    for (const date of dates) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_eventDateId_and_sortOrder", (q) => q.eq("eventDateId", date._id))
        .take(100);
      for (const session of sessions) await ctx.db.delete("sessions", session._id);
      await ctx.db.delete("event_dates", date._id);
    }
    const fields = await ctx.db
      .query("signup_form_fields")
      .withIndex("by_eventId_and_sortOrder", (q) => q.eq("eventId", event._id))
      .take(50);
    for (const field of fields) await ctx.db.delete("signup_form_fields", field._id);
    await ctx.db.delete("events", event._id);
  }

  let participantCount = 0;
  let templateCount = 0;
  if (seedAudit) {
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_organizationId_and_externalId", (q) => q.eq("organizationId", organizationId))
      .take(100);
    for (const participant of participants) {
      if (
        participant.externalId.startsWith("demo-") &&
        participant.synchronizedAt === seedAudit.occurredAt
      ) {
        await ctx.db.delete("participants", participant._id);
        participantCount += 1;
      }
    }

    const templates = await ctx.db
      .query("signup_form_templates")
      .withIndex("by_organizationId_and_updatedAt", (q) => q.eq("organizationId", organizationId))
      .take(100);
    for (const template of templates) {
      if (template.createdAt !== seedAudit.occurredAt) continue;
      const fields = await ctx.db
        .query("signup_form_fields")
        .withIndex("by_templateId_and_sortOrder", (q) => q.eq("templateId", template._id))
        .take(50);
      for (const field of fields) await ctx.db.delete("signup_form_fields", field._id);
      await ctx.db.delete("signup_form_templates", template._id);
      templateCount += 1;
    }
    await ctx.db.delete("audit_entries", seedAudit._id);
  }

  return { eventCount: events.length, participantCount, templateCount };
};

const seedArgs = {
  organizationId: v.id("organizations"),
  actorIdentity: v.string(),
};

export const demo = internalMutation({
  args: seedArgs,
  handler: seedDemoData,
});

export const resetAndReseed = internalMutation({
  args: seedArgs,
  handler: async (ctx, args) => {
    const deleted = await resetDemoData(ctx, args.organizationId, args.actorIdentity);
    const seeded = await seedDemoData(ctx, args);
    return { deleted, seeded };
  },
});
