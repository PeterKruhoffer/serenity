import { componentsGeneric } from "convex/server";

export type Components = {
  "workOSAuthKit": import("@convex-dev/workos-authkit/_generated/component.js").ComponentApi<"workOSAuthKit">;
};

export const components: Components = componentsGeneric() as any;
