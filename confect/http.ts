import { AuthKit } from "@convex-dev/workos-authkit";
import { httpRouter } from "convex/server";
import { components } from "./_generated/components";

const authKit = new AuthKit(components.workOSAuthKit);
const http = httpRouter();

authKit.registerRoutes(http);

export default http;
