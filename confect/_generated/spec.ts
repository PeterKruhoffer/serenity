import { GroupSpec, Spec } from "@confect/core";
import events from "../events.spec";
import publication from "../publication.spec";
import registrations from "../registrations.spec";
import workspace from "../workspace.spec";

const spec: Spec.Spec<
  | GroupSpec.NamedAt<typeof events, "events">
  | GroupSpec.NamedAt<typeof publication, "publication">
  | GroupSpec.NamedAt<typeof registrations, "registrations">
  | GroupSpec.NamedAt<typeof workspace, "workspace">
> = Spec.make().addAt("events", events).addAt("publication", publication).addAt("registrations", registrations).addAt("workspace", workspace);

export default spec;
