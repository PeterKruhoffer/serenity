import { GroupSpec, Spec } from "@confect/core";
import events from "../events.spec";
import workspace from "../workspace.spec";

const spec: Spec.Spec<
  | GroupSpec.NamedAt<typeof events, "events">
  | GroupSpec.NamedAt<typeof workspace, "workspace">
> = Spec.make().addAt("events", events).addAt("workspace", workspace);

export default spec;
