import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import attendee from "../../attendee.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../attendee.spec")["default"]>(databaseSchema, attendee, RegisteredConvexFunction.make);
