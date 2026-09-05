import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";

export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "deliver",
    args: () => Schema.Struct({ deliveryId: Id("webhook_deliveries") }),
    returns: () => Schema.Null,
  }),
);
