import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import incidents from "../../incidents.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../incidents.spec")["default"]>(databaseSchema, incidents, RegisteredConvexFunction.make);
