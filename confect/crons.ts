import { CronJob, CronJobs } from "@confect/server";
import * as Duration from "effect/Duration";
import refs from "./_generated/refs";

export default CronJobs.make().add(
  CronJob.make(
    "recover interrupted webhook deliveries",
    Duration.minutes(5),
    refs.internal.webhooks.recoverDeliveries,
    {},
  ),
);
