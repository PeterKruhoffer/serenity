import type { ParentProps } from "solid-js";
import { Dynamic } from "solid-js/web";

const Root = (props: ParentProps<{ class: string }>) => (
  <div class={props.class}>{props.children}</div>
);
const Icon = (props: ParentProps) => <span aria-hidden="true">{props.children}</span>;
const Content = (props: ParentProps) => <div>{props.children}</div>;
const Title = (props: ParentProps<{ as: "h2" | "h3" | "strong" }>) => (
  <Dynamic component={props.as}>{props.children}</Dynamic>
);
const Description = (props: ParentProps) => <p>{props.children}</p>;

export const EmptyState = { Root, Icon, Content, Title, Description };
