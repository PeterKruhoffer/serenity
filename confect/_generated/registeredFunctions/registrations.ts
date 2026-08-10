import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import registrations from "../../registrations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../registrations.spec")["default"]>(databaseSchema, registrations, RegisteredConvexFunction.make);
