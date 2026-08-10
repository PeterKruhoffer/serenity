import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import events from "../../events.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../events.spec")["default"]>(databaseSchema, events, RegisteredConvexFunction.make);
