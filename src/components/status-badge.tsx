import type { ParentProps } from "solid-js";

export const StatusBadge = (props: ParentProps<{ status: string }>) => (
  <span class={`event-status status-${props.status}`}>{props.children ?? props.status}</span>
);
