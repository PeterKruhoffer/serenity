import styles from "./components.module.css";
import type { ParentProps } from "solid-js";

const Root = (props: ParentProps<{ labelledBy: string }>) => (
  <section class={styles.workspacePage} aria-labelledby={props.labelledBy}>
    {props.children}
  </section>
);

const Header = (props: ParentProps<{ variant: "page" | "feature" }>) => (
  <div class={styles.contentHeading} classList={{ [styles.pageHeading]: props.variant === "page" }}>
    {props.children}
  </div>
);

const Heading = (props: ParentProps) => <div>{props.children}</div>;
const Eyebrow = (props: ParentProps) => <p class="eyebrow">{props.children}</p>;
const Title = (props: ParentProps<{ id: string }>) => <h1 id={props.id}>{props.children}</h1>;
const Description = (props: ParentProps) => <p>{props.children}</p>;
const Meta = (props: ParentProps) => <span class={styles.pageTotal}>{props.children}</span>;

export const Page = { Root, Header, Heading, Eyebrow, Title, Description, Meta };
