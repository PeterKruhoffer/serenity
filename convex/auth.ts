import { AuthKit } from "@convex-dev/workos-authkit";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit);

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => await authKit.getAuthUser(ctx),
});
