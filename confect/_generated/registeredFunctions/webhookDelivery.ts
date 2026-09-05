import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../schema";
import webhookDelivery from "../../webhookDelivery.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../webhookDelivery.spec")["default"]>(databaseSchema, webhookDelivery, RegisteredNodeFunction.make);
