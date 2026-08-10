import type { User } from "@workos-inc/authkit-js";

type UserName = Pick<User, "email" | "firstName" | "lastName">;

export const accountNameFor = (user: UserName | null | undefined) => {
  if (!user) return "Signed in";

  const fullName = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || user.email.trim() || "Signed in";
};

export const greetingNameFor = (
  user: UserName | null | undefined,
  workspaceDisplayName: string,
) => {
  const firstName = user?.firstName?.trim();
  if (firstName) return firstName;

  const workspaceFirstName = workspaceDisplayName.trim().split(/\s+/)[0] ?? "";
  const looksLikeAName = /^[\p{L}\p{M}.'’-]+$/u.test(workspaceFirstName);

  return looksLikeAName ? workspaceFirstName : "there";
};
