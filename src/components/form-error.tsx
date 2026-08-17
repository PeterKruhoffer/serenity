import type { ParentProps } from "solid-js";

export const FormError = (props: ParentProps) => (
  <p class="auth-error" role="alert">
    {props.children}
  </p>
);
