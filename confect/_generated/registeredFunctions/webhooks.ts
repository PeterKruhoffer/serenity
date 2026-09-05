import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import webhooks from "../../webhooks.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../webhooks.spec")["default"]>(databaseSchema, webhooks, RegisteredConvexFunction.make);
