import styles from "./command-palette.module.css";
import Dialog from "@corvu/dialog";
import { Search } from "@kobalte/core/search";
import { Show } from "solid-js";
import type { Command, CommandGroup } from "./commands";

type CommandPaletteDialogProps = {
  open: boolean;
  groups: CommandGroup[];
  visibleCommands: Command[];
  altPressed: boolean;
  shortcutLabel: string;
  acceleratorLabel: string;
  onOpenChange: (open: boolean) => void;
  onInputChange: (query: string) => void;
  onSelect: (command: Command | null) => void;
};

export default function CommandPaletteDialog(props: CommandPaletteDialogProps) {
  let input: HTMLInputElement | undefined;

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      onContentPresentChange={(present) => {
        if (present) queueMicrotask(() => input?.focus());
      }}
    >
      <Dialog.Trigger class={styles.trigger} aria-label="Open command palette">
        <span aria-hidden="true">⌕</span>
        <span>Search</span>
        <kbd>{props.shortcutLabel}</kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class={styles.overlay} />
        <Dialog.Content class={styles.content}>
          <Dialog.Label class={styles.label}>Command palette</Dialog.Label>
          <Search<Command, CommandGroup>
            class={styles.searchRoot}
            open
            options={props.groups}
            optionGroupChildren="items"
            optionValue="id"
            optionLabel="label"
            optionTextValue="label"
            placeholder="Search events, teams, pages, and actions…"
            onInputChange={props.onInputChange}
            onChange={props.onSelect}
            closeOnSelection={false}
            allowsEmptyCollection
            itemComponent={(itemProps) => {
              const accelerator = () =>
                props.visibleCommands.findIndex(
                  (command) => command.id === itemProps.item.rawValue.id,
                ) + 1;
              return (
                <Search.Item item={itemProps.item} class={styles.result}>
                  <span class={styles.resultIcon} aria-hidden="true">
                    {itemProps.item.rawValue.icon}
                  </span>
                  <span class={styles.resultCopy}>
                    <Search.ItemLabel as="strong">{itemProps.item.rawValue.label}</Search.ItemLabel>
                    <Search.ItemDescription as="small">
                      {itemProps.item.rawValue.description}
                    </Search.ItemDescription>
                  </span>
                  <Show
                    when={props.altPressed && accelerator() > 0 && accelerator() <= 9}
                    fallback={
                      <span class={styles.arrow} aria-hidden="true">
                        ↵
                      </span>
                    }
                  >
                    <kbd class={styles.accelerator}>
                      {props.acceleratorLabel}
                      {accelerator()}
                    </kbd>
                  </Show>
                </Search.Item>
              );
            }}
            sectionComponent={(sectionProps) => (
              <Search.Section class={styles.section}>
                {sectionProps.section.rawValue.label}
              </Search.Section>
            )}
          >
            <Search.Control class={styles.control} aria-label="Search Serenity">
              <span class={styles.searchIcon} aria-hidden="true">
                ⌕
              </span>
              <Search.Input
                ref={(element) => (input = element)}
                class={styles.input}
                autocomplete="off"
              />
              <kbd class={styles.escape}>Esc</kbd>
            </Search.Control>
            <div class={styles.results}>
              <Search.Listbox class={styles.listbox} />
              <Search.NoResult class={styles.noResult}>No matching commands.</Search.NoResult>
            </div>
          </Search>
          <div class={styles.footer} aria-hidden="true">
            <Show
              when={props.altPressed}
              fallback={
                <>
                  <span>↑↓ Navigate</span>
                  <span>↵ Open</span>
                </>
              }
            >
              <span>{props.acceleratorLabel}1–9 Open result</span>
            </Show>
            <span>Serenity search</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
