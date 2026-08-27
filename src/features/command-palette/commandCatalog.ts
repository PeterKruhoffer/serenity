import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Organization } from "../workspace/WorkspaceContext";
import type { Command } from "./commands";

const canReview = (role: string) => role === "administrator" || role === "super_user";

export const buildCommandCatalog = (
  organization: Organization,
  events: FunctionReturnType<typeof api.events.list>,
  templates: FunctionReturnType<typeof api.events.listSignupTemplates>,
  approvals: FunctionReturnType<typeof api.publication.listPending>,
): Command[] => {
  const product: Command[] = [
    {
      id: "product-events",
      kind: "product",
      label: "Events",
      description: "Event operations and publishing",
      keywords: ["home", "program"],
      href: "/events",
      icon: "◫",
      shortcut: "g e",
    },
    {
      id: "product-calendar",
      kind: "product",
      label: "Calendar",
      description: "Organization schedule",
      keywords: ["dates", "schedule"],
      href: "/calendar",
      icon: "□",
      shortcut: "g c",
    },
    {
      id: "product-templates",
      kind: "product",
      label: "Templates",
      description: "Reusable sign-up forms",
      keywords: ["forms"],
      href: "/templates",
      icon: "▤",
      shortcut: "g t",
    },
    ...(canReview(organization.role)
      ? [
          {
            id: "product-approvals",
            kind: "product" as const,
            label: "Approvals",
            description: "Review submitted revisions",
            keywords: ["review", "publication"],
            href: "/approvals",
            icon: "✓",
            shortcut: "g a",
          },
        ]
      : []),
    {
      id: "product-participants",
      kind: "product",
      label: "Participants",
      description: "Registration and attendance operations",
      keywords: ["registrations", "attendance"],
      href: "/participants",
      icon: "○",
      shortcut: "g p",
    },
    {
      id: "product-settings",
      kind: "product",
      label: "Settings",
      description: "Workspace teams and defaults",
      keywords: ["organization", "timezone"],
      href: "/settings",
      icon: "⌘",
      shortcut: "g s",
    },
  ];

  const actions: Command[] = [
    {
      id: "action-new-event",
      kind: "action",
      label: "Create event",
      description: "Open the full event builder",
      keywords: ["new", "add"],
      href: "/events/new",
      icon: "＋",
      shortcut: "c e",
    },
    {
      id: "action-new-template",
      kind: "action",
      label: "Create template",
      description: "Build a reusable sign-up form",
      keywords: ["new", "add", "form"],
      href: "/templates/new",
      icon: "＋",
      shortcut: "c t",
    },
    ...(organization.role === "administrator"
      ? [
          {
            id: "action-new-team",
            kind: "action" as const,
            label: "Add team",
            description: "Open the team form in settings",
            keywords: ["new", "create"],
            href: "/settings?action=new-team",
            icon: "＋",
            shortcut: "c m",
          },
        ]
      : []),
  ];

  const eventCommands: Command[] = events.map((event) => ({
    id: `event-${event.id}`,
    kind: "event",
    label: event.title,
    description: `${event.teamName} · ${event.status}`,
    keywords: [event.description, event.teamName, event.status],
    href: `/events/${event.id}`,
    icon: "◇",
  }));
  const teamCommands: Command[] = organization.teams.map((team) => ({
    id: `team-${team.id}`,
    kind: "team",
    label: team.name,
    description: "Open this team's calendar",
    keywords: ["schedule", "calendar"],
    href: `/calendar?team=${team.id}`,
    icon: "○",
  }));
  const templateCommands: Command[] = templates.map((template) => ({
    id: `template-${template.id}`,
    kind: "template",
    label: template.name,
    description: template.scope === "organization" ? "Organization template" : "Team template",
    keywords: [template.scope, "form"],
    href:
      organization.role !== "event_manager" || template.scope === "team"
        ? `/templates/${template.id}/edit`
        : "/templates",
    icon: "▤",
  }));
  const approvalCommands: Command[] = approvals.map((revision) => ({
    id: `approval-${revision.id}`,
    kind: "approval",
    label: revision.title,
    description: `${revision.teamName} · Revision ${revision.revisionNumber}`,
    keywords: [revision.teamName, "review", "submitted"],
    href: "/approvals",
    icon: "✓",
  }));

  return [
    ...actions,
    ...product,
    ...eventCommands,
    ...teamCommands,
    ...templateCommands,
    ...approvalCommands,
  ];
};
