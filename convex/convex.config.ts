import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    WORKOS_CLIENT_ID: v.string(),
  },
});

app.use(workOSAuthKit);
app.use(rateLimiter);

export default app;
