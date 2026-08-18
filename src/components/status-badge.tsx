import styles from "./components.module.css";
import type { ParentProps } from "solid-js";

export const StatusBadge = (props: ParentProps<{ status: string }>) => (
  <span
    class={styles.eventStatus}
    classList={{
      [styles.statusSubmitted]: props.status === "submitted",
      [styles.statusPublished]: props.status === "published",
    }}
  >
    {props.children ?? props.status}
  </span>
);
