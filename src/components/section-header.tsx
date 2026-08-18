import styles from "./components.module.css";
import type { ParentProps } from "solid-js";

const Root = (props: ParentProps) => <div class={styles.sectionTitleRow}>{props.children}</div>;
const Heading = (props: ParentProps) => <div>{props.children}</div>;
const Eyebrow = (props: ParentProps) => <p class="eyebrow">{props.children}</p>;
const Title = (props: ParentProps<{ id: string }>) => <h2 id={props.id}>{props.children}</h2>;
const Count = (props: ParentProps) => <span class={styles.sectionCount}>{props.children}</span>;

export const SectionHeader = { Root, Heading, Eyebrow, Title, Count };
