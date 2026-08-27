import styles from "./command-palette.module.css";
import Dialog from "@corvu/dialog";
import { For, Show } from "solid-js";
import type { Command } from "./commands";

type ShortcutHelpProps = {
  open: boolean;
  commands: Command[];
  pendingKey: string | null;
  onOpenChange: (open: boolean) => void;
};

export default function ShortcutHelp(props: ShortcutHelpProps) {
  const commandsWithPrefix = (prefix: string) =>
    props.commands.filter((command) => command.shortcut?.startsWith(`${prefix} `));

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay class={styles.overlay} />
          <Dialog.Content class={`${styles.content} ${styles.helpContent}`}>
            <Dialog.Label class={styles.helpTitle}>Keyboard shortcuts</Dialog.Label>
            <Dialog.Description class={styles.helpDescription}>
              Navigate and create without leaving the keyboard.
            </Dialog.Description>
            <div class={styles.shortcutGroups}>
              <section>
                <h2>Go to</h2>
                <For each={commandsWithPrefix("g")}>
                  {(command) => (
                    <div class={styles.shortcutRow}>
                      <span>{command.label}</span>
                      <kbd>{command.shortcut}</kbd>
                    </div>
                  )}
                </For>
              </section>
              <section>
                <h2>Create</h2>
                <For each={commandsWithPrefix("c")}>
                  {(command) => (
                    <div class={styles.shortcutRow}>
                      <span>{command.label}</span>
                      <kbd>{command.shortcut}</kbd>
                    </div>
                  )}
                </For>
              </section>
            </div>
            <div class={styles.helpFooter}>
              <span>Press keys in sequence</span>
              <kbd>Esc</kbd>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Show when={props.pendingKey}>
        {(prefix) => (
          <div
            class={styles.sequenceHint}
            role="status"
            aria-label={`${prefix()} shortcut options`}
          >
            <kbd>{prefix()}</kbd>
            <For each={commandsWithPrefix(prefix())}>
              {(command) => (
                <span>
                  <kbd>{command.shortcut?.slice(2)}</kbd> {command.label}
                </span>
              )}
            </For>
          </div>
        )}
      </Show>
    </>
  );
}
