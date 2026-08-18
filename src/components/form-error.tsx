import styles from "./components.module.css";
import type { ParentProps } from "solid-js";

export const FormError = (props: ParentProps) => (
  <p class={styles.authError} role="alert">
    {props.children}
  </p>
);
