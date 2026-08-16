import { AuthKit } from "@convex-dev/workos-authkit";
import { httpRouter } from "convex/server";
import { components } from "./_generated/components";
import { createRegistration, getSignupForm, publicApiOptions } from "./publicApi";

const authKit = new AuthKit(components.workOSAuthKit);
const http = httpRouter();

authKit.registerRoutes(http);
http.route({ pathPrefix: "/api/v1/events/", method: "GET", handler: getSignupForm });
http.route({ pathPrefix: "/api/v1/events/", method: "POST", handler: createRegistration });
http.route({ pathPrefix: "/api/v1/events/", method: "OPTIONS", handler: publicApiOptions });

export default http;
