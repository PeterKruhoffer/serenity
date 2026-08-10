import { describe, expect, it } from "vite-plus/test";
import { accountNameFor, greetingNameFor } from "./display-name";

describe("display names", () => {
  it("uses the authenticated user's name in the workspace greeting", () => {
    const user = { firstName: "  Alex ", lastName: "Morgan", email: "alex@example.com" };

    expect(greetingNameFor(user, "user_01KZP38GG113ZT7BYZBADJQ5")).toBe("Alex");
    expect(accountNameFor(user)).toBe("Alex Morgan");
  });

  it("uses a human-readable workspace name when the auth profile has no first name", () => {
    const user = { firstName: null, lastName: null, email: "alex@example.com" };

    expect(greetingNameFor(user, "Alex Morgan")).toBe("Alex");
  });

  it("does not expose generated IDs or email addresses as names", () => {
    const user = { firstName: null, lastName: null, email: "alex@example.com" };

    expect(greetingNameFor(user, "user_01KZP38GG113ZT7BYZBADJQ5")).toBe("there");
    expect(greetingNameFor(user, "alex@example.com")).toBe("there");
  });
});
