import styles from "./command-palette.module.css";
import Dialog from "@corvu/dialog";
import { Search } from "@kobalte/core/search";
import { useNavigate } from "@solidjs/router";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex-solidjs";
import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { rankCommands, type Command, type CommandKind } from "./commands";

type CommandGroup = {
  label: string;
  items: Command[];
};

const groupOrder: readonly { kind: CommandKind; label: string; limit: number }[] = [
  { kind: "action", label: "Actions", limit: 4 },
  { kind: "product", label: "Product", limit: 6 },
  { kind: "event", label: "Events", limit: 6 },
  { kind: "team", label: "Teams", limit: 5 },
  { kind: "template", label: "Templates", limit: 5 },
  { kind: "approval", label: "Approvals", limit: 5 },
];

const canReview = (role: string) => role === "administrator" || role === "super_user";

export default function CommandPalette() {
  const navigate = useNavigate();
  const { activeOrganization } = useWorkspace();
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [input, setInput] = createSignal<HTMLInputElement>();
  const shortcutLabel = /mac|iphone|ipad|ipod/i.test(navigator.platform) ? "⌘ K" : "Ctrl K";

  const events = useQuery(
    api.events.list,
    () => ({ organizationId: activeOrganization().id }),
    () => ({ enabled: open() }),
  );
  const templates = useQuery(
    api.events.listSignupTemplates,
    () => ({ organizationId: activeOrganization().id }),
    () => ({ enabled: open() }),
  );
  const approvals = useQuery(
    api.publication.listPending,
    () => ({ organizationId: activeOrganization().id }),
    () => ({ enabled: open() && canReview(activeOrganization().role) }),
  );

  const commands = createMemo<Command[]>(() => {
    const organization = activeOrganization();
    const product: Command[] = [
      {
        id: "product-events",
        kind: "product",
        label: "Events",
        description: "Event operations and publishing",
        keywords: ["home", "program"],
        href: "/events",
        icon: "◫",
      },
      {
        id: "product-calendar",
        kind: "product",
        label: "Calendar",
        description: "Organization schedule",
        keywords: ["dates", "schedule"],
        href: "/calendar",
        icon: "□",
      },
      {
        id: "product-templates",
        kind: "product",
        label: "Templates",
        description: "Reusable sign-up forms",
        keywords: ["forms"],
        href: "/templates",
        icon: "▤",
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
      },
      {
        id: "product-settings",
        kind: "product",
        label: "Settings",
        description: "Workspace teams and defaults",
        keywords: ["organization", "timezone"],
        href: "/settings",
        icon: "⌘",
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
      },
      {
        id: "action-new-template",
        kind: "action",
        label: "Create template",
        description: "Build a reusable sign-up form",
        keywords: ["new", "add", "form"],
        href: "/templates/new",
        icon: "＋",
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
            },
          ]
        : []),
    ];

    const eventCommands: Command[] =
      events.data()?.map((event) => ({
        id: `event-${event.id}`,
        kind: "event",
        label: event.title,
        description: `${event.teamName} · ${event.status}`,
        keywords: [event.description, event.teamName, event.status],
        href: `/events/${event.id}`,
        icon: "◇",
      })) ?? [];
    const teamCommands: Command[] = organization.teams.map((team) => ({
      id: `team-${team.id}`,
      kind: "team",
      label: team.name,
      description: "Open this team's calendar",
      keywords: ["schedule", "calendar"],
      href: `/calendar?team=${team.id}`,
      icon: "○",
    }));
    const templateCommands: Command[] =
      templates.data()?.map((template) => ({
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
      })) ?? [];
    const approvalCommands: Command[] =
      approvals.data()?.map((revision) => ({
        id: `approval-${revision.id}`,
        kind: "approval",
        label: revision.title,
        description: `${revision.teamName} · Revision ${revision.revisionNumber}`,
        keywords: [revision.teamName, "review", "submitted"],
        href: "/approvals",
        icon: "✓",
      })) ?? [];

    return [
      ...actions,
      ...product,
      ...eventCommands,
      ...teamCommands,
      ...templateCommands,
      ...approvalCommands,
    ];
  });

  const groups = createMemo<CommandGroup[]>(() => {
    const ranked = rankCommands(commands(), query());
    return groupOrder.flatMap(({ kind, label, limit }) => {
      const items = ranked.filter((command) => command.kind === kind).slice(0, limit);
      return items.length > 0 ? [{ label, items }] : [];
    });
  });

  const choose = (command: Command | null) => {
    if (!command) return;
    setOpen(false);
    setQuery("");
    navigate(command.href);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  };

  onMount(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.key.toLocaleLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey)
      )
        return;
      event.preventDefault();
      handleOpenChange(!open());
    };
    window.addEventListener("keydown", handleShortcut);
    onCleanup(() => window.removeEventListener("keydown", handleShortcut));
  });

  return (
    <Dialog
      open={open()}
      onOpenChange={handleOpenChange}
      onContentPresentChange={(present) => {
        if (present) queueMicrotask(() => input()?.focus());
      }}
    >
      <Dialog.Trigger class={styles.trigger} aria-label="Open command palette">
        <span aria-hidden="true">⌕</span>
        <span>Search</span>
        <kbd>{shortcutLabel}</kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class={styles.overlay} />
        <Dialog.Content class={styles.content}>
          <Dialog.Label class={styles.label}>Command palette</Dialog.Label>
          <Search<Command, CommandGroup>
            class={styles.searchRoot}
            open
            options={groups()}
            optionGroupChildren="items"
            optionValue="id"
            optionLabel="label"
            optionTextValue="label"
            placeholder="Search events, teams, pages, and actions…"
            onInputChange={setQuery}
            onChange={choose}
            closeOnSelection={false}
            allowsEmptyCollection
            itemComponent={(props) => (
              <Search.Item item={props.item} class={styles.result}>
                <span class={styles.resultIcon} aria-hidden="true">
                  {props.item.rawValue.icon}
                </span>
                <span class={styles.resultCopy}>
                  <Search.ItemLabel as="strong">{props.item.rawValue.label}</Search.ItemLabel>
                  <Search.ItemDescription as="small">
                    {props.item.rawValue.description}
                  </Search.ItemDescription>
                </span>
                <span class={styles.arrow} aria-hidden="true">
                  ↵
                </span>
              </Search.Item>
            )}
            sectionComponent={(props) => (
              <Search.Section class={styles.section}>{props.section.rawValue.label}</Search.Section>
            )}
          >
            <Search.Control class={styles.control} aria-label="Search Serenity">
              <span class={styles.searchIcon} aria-hidden="true">
                ⌕
              </span>
              <Search.Input ref={setInput} class={styles.input} autocomplete="off" />
              <kbd class={styles.escape}>Esc</kbd>
            </Search.Control>
            <div class={styles.results}>
              <Search.Listbox class={styles.listbox} />
              <Search.NoResult class={styles.noResult}>No matching commands.</Search.NoResult>
            </div>
          </Search>
          <div class={styles.footer} aria-hidden="true">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>Serenity search</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
