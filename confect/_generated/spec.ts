import { GroupSpec, Spec } from "@confect/core";
import incidents from "../incidents.spec";

const spec: Spec.Spec<
  | GroupSpec.NamedAt<typeof incidents, "incidents">
> = Spec.make().addAt("incidents", incidents);

export default spec;
