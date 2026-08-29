import styles from "./timezone-typeahead.module.css";
import { Combobox } from "@kobalte/core/combobox";
import { Show, createMemo, createSignal } from "solid-js";
import { searchTimezones, timezoneTypeaheadOptions, type TimezoneOption } from "../lib/date-time";

type TimezoneTypeaheadProps = {
  value: string;
  onChange: (timezone: string) => void;
  name?: string;
  required?: boolean;
};

const options = timezoneTypeaheadOptions();

export const TimezoneTypeahead = (props: TimezoneTypeaheadProps) => {
  const [query, setQuery] = createSignal("");
  const selectedOption = createMemo(() =>
    options.find((option) => option.timezone === props.value),
  );
  const results = createMemo(() => {
    if (query().trim()) return searchTimezones(options, query());
    const selected = selectedOption();
    return selected ? [selected] : [];
  });

  return (
    <Combobox<TimezoneOption>
      class={styles.root}
      options={results()}
      value={selectedOption() ?? null}
      onChange={(option) => option && props.onChange(option.timezone)}
      onInputChange={setQuery}
      optionValue="timezone"
      optionLabel="timezone"
      optionTextValue={(option) =>
        `${option.timezone} ${option.timezone.replaceAll("/", " ")} ${option.abbreviations.join(" ")}`
      }
      triggerMode="input"
      allowsEmptyCollection
      sameWidth
      name={props.name}
      placeholder="Search CET, PST, New York…"
      itemComponent={(itemProps) => (
        <Combobox.Item item={itemProps.item} class={styles.option}>
          <Combobox.ItemLabel class={styles.optionLabel}>
            <span>{itemProps.item.rawValue.timezone}</span>
            <Show when={itemProps.item.rawValue.abbreviations.length > 0}>
              <small>{itemProps.item.rawValue.abbreviations.join(" / ")}</small>
            </Show>
          </Combobox.ItemLabel>
        </Combobox.Item>
      )}
    >
      <Combobox.HiddenSelect />
      <Combobox.Control>
        <Combobox.Input
          class={styles.input}
          placeholder="Search CET, PST, New York…"
          required={props.required}
        />
      </Combobox.Control>
      <Combobox.Portal>
        <Combobox.Content class={styles.results}>
          <Combobox.Listbox class={styles.listbox} />
          <Show when={results().length === 0}>
            <div class={styles.empty}>No matching timezones</div>
          </Show>
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox>
  );
};
