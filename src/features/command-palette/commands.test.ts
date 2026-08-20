import { describe, expect, it } from "vite-plus/test";
import { rankCommands, type Command } from "./commands";

const command = (values: Partial<Command> & Pick<Command, "id" | "kind" | "label">): Command => ({
  description: "",
  href: "/",
  icon: "→",
  keywords: [],
  ...values,
});

const commands = [
  command({ id: "calendar", kind: "product", label: "Calendar" }),
  command({ id: "event", kind: "event", label: "Leadership essentials" }),
  command({
    id: "team",
    kind: "team",
    label: "Learning team",
    description: "Team calendar",
    keywords: ["programs"],
  }),
  command({ id: "create-event", kind: "action", label: "Create event" }),
];

describe("rankCommands", () => {
  it("ranks exact and prefix label matches ahead of metadata matches", () => {
    expect(rankCommands(commands, "calendar").map(({ id }) => id)).toEqual(["calendar", "team"]);
    expect(rankCommands(commands, "lead").map(({ id }) => id)).toEqual(["event"]);
  });

  it("matches all normalized query tokens across command metadata", () => {
    expect(rankCommands(commands, "PROGRAMS team").map(({ id }) => id)).toEqual(["team"]);
    expect(rankCommands(commands, "Créate event").map(({ id }) => id)).toEqual(["create-event"]);
  });

  it("uses stable kind priority for an empty query", () => {
    expect(rankCommands(commands, "").map(({ id }) => id)).toEqual([
      "create-event",
      "calendar",
      "event",
      "team",
    ]);
  });
});
