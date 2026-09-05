import { GroupSpec, Spec } from "@confect/core";
import attendee from "../attendee.spec";
import events from "../events.spec";
import publication from "../publication.spec";
import registrations from "../registrations.spec";
import webhookDelivery from "../webhookDelivery.spec";
import webhooks from "../webhooks.spec";
import workspace from "../workspace.spec";

const spec: Spec.Spec<
  | GroupSpec.NamedAt<typeof attendee, "attendee">
  | GroupSpec.NamedAt<typeof events, "events">
  | GroupSpec.NamedAt<typeof publication, "publication">
  | GroupSpec.NamedAt<typeof registrations, "registrations">
  | GroupSpec.NamedAt<typeof webhookDelivery, "webhookDelivery">
  | GroupSpec.NamedAt<typeof webhooks, "webhooks">
  | GroupSpec.NamedAt<typeof workspace, "workspace">
> = Spec.make().addAt("attendee", attendee).addAt("events", events).addAt("publication", publication).addAt("registrations", registrations).addAt("webhookDelivery", webhookDelivery).addAt("webhooks", webhooks).addAt("workspace", workspace);

export default spec;
