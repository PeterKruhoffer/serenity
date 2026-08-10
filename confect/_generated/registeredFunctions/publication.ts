import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import publication from "../../publication.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../publication.spec")["default"]>(databaseSchema, publication, RegisteredConvexFunction.make);
