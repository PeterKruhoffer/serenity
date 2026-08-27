import { useNavigate } from "@solidjs/router";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex-solidjs";
import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useWorkspace } from "../workspace/WorkspaceContext";
import CommandPaletteDialog from "./CommandPaletteDialog";
import ShortcutHelp from "./ShortcutHelp";
import { buildCommandCatalog } from "./commandCatalog";
import { rankCommands, type Command, type CommandGroup, type CommandKind } from "./commands";

const groupOrder: readonly { kind: CommandKind; label: string; limit: number }[] = [
  { kind: "action", label: "Actions", limit: 4 },
  { kind: "product", label: "Product", limit: 6 },
  { kind: "event", label: "Events", limit: 6 },
  { kind: "team", label: "Teams", limit: 5 },
  { kind: "template", label: "Templates", limit: 5 },
  { kind: "approval", label: "Approvals", limit: 5 },
];

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export default function CommandPalette() {
  const navigate = useNavigate();
  const { activeOrganization } = useWorkspace();
  const [open, setOpen] = createSignal(false);
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [altPressed, setAltPressed] = createSignal(false);
  const [pendingKey, setPendingKey] = createSignal<string | null>(null);
  const applePlatform = /mac|iphone|ipad|ipod/i.test(navigator.platform);
  const shortcutLabel = applePlatform ? "⌘ K" : "Ctrl K";
  const acceleratorLabel = applePlatform ? "⌥" : "Alt+";

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
    () => ({ enabled: open() && activeOrganization().role !== "event_manager" }),
  );
  const commands = createMemo(() =>
    buildCommandCatalog(
      activeOrganization(),
      events.data() ?? [],
      templates.data() ?? [],
      approvals.data() ?? [],
    ),
  );

  const groups = createMemo<CommandGroup[]>(() => {
    const ranked = rankCommands(commands(), query());
    return groupOrder.flatMap(({ kind, label, limit }) => {
      const items = ranked.filter((command) => command.kind === kind).slice(0, limit);
      return items.length > 0 ? [{ label, items }] : [];
    });
  });
  const visibleCommands = createMemo(() => groups().flatMap((group) => group.items));
  const boundCommands = createMemo(() => commands().filter((command) => command.shortcut));
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;

  const clearPendingKey = () => {
    clearTimeout(pendingTimer);
    pendingTimer = undefined;
    setPendingKey(null);
  };

  const startSequence = (key: string) => {
    clearPendingKey();
    setPendingKey(key);
    pendingTimer = setTimeout(clearPendingKey, 1500);
  };

  const choose = (command: Command | null) => {
    if (!command) return;
    setOpen(false);
    setAltPressed(false);
    clearPendingKey();
    setQuery("");
    navigate(command.href);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setAltPressed(false);
    clearPendingKey();
    if (!nextOpen) setQuery("");
  };

  onMount(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (open() && event.key === "Alt") {
        event.preventDefault();
        setAltPressed(true);
        return;
      }

      if (open() && event.altKey) {
        const match = event.code.match(/^Digit([1-9])$/);
        if (match) {
          const command = visibleCommands()[Number(match[1]) - 1];
          if (command) {
            event.preventDefault();
            choose(command);
          }
          return;
        }
      }

      if (
        !event.repeat &&
        event.key.toLocaleLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setHelpOpen(false);
        handleOpenChange(!open());
        return;
      }

      if (open() || helpOpen() || event.repeat || event.metaKey || event.ctrlKey || event.altKey)
        return;

      if (event.key === "Escape" && pendingKey()) {
        event.preventDefault();
        clearPendingKey();
        return;
      }

      if (isEditable(event.target)) {
        clearPendingKey();
        return;
      }

      const key = event.key.toLocaleLowerCase();
      if (key === "?" && !pendingKey()) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      const prefix = pendingKey();
      if (!prefix) {
        if (boundCommands().some((command) => command.shortcut?.startsWith(`${key} `))) {
          event.preventDefault();
          startSequence(key);
        }
        return;
      }

      event.preventDefault();
      const command = boundCommands().find(
        (candidate) => candidate.shortcut === `${prefix} ${key}`,
      );
      clearPendingKey();
      if (command) choose(command);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") setAltPressed(false);
    };
    const handleBlur = () => setAltPressed(false);
    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    onCleanup(() => {
      clearPendingKey();
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    });
  });

  return (
    <>
      <CommandPaletteDialog
        open={open()}
        groups={groups()}
        visibleCommands={visibleCommands()}
        altPressed={altPressed()}
        shortcutLabel={shortcutLabel}
        acceleratorLabel={acceleratorLabel}
        onOpenChange={handleOpenChange}
        onInputChange={setQuery}
        onSelect={choose}
      />
      <ShortcutHelp
        open={helpOpen()}
        commands={boundCommands()}
        pendingKey={pendingKey()}
        onOpenChange={setHelpOpen}
      />
    </>
  );
}
