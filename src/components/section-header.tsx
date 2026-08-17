import type { ParentProps } from "solid-js";

const Root = (props: ParentProps) => <div class="section-title-row">{props.children}</div>;
const Heading = (props: ParentProps) => <div>{props.children}</div>;
const Eyebrow = (props: ParentProps) => <p class="eyebrow">{props.children}</p>;
const Title = (props: ParentProps<{ id: string }>) => <h2 id={props.id}>{props.children}</h2>;
const Count = (props: ParentProps) => <span class="section-count">{props.children}</span>;

export const SectionHeader = { Root, Heading, Eyebrow, Title, Count };
