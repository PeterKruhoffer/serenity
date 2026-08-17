import { componentsGeneric } from "convex/server";

export type Components = {
  "rateLimiter": import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  "workOSAuthKit": import("@convex-dev/workos-authkit/_generated/component.js").ComponentApi<"workOSAuthKit">;
};

export const components: Components = componentsGeneric() as any;
