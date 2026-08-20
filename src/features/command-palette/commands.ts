export type CommandKind = "product" | "action" | "event" | "team" | "template" | "approval";

export type Command = {
  id: string;
  kind: CommandKind;
  label: string;
  description: string;
  keywords: readonly string[];
  href: string;
  icon: string;
};

const kindPriority: Record<CommandKind, number> = {
  action: 0,
  product: 1,
  event: 2,
  team: 3,
  template: 4,
  approval: 5,
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const score = (command: Command, query: string) => {
  const label = normalize(command.label);
  if (!query) return 4;
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;

  const tokens = query.split(" ");
  if (tokens.every((token) => label.includes(token))) return 2;

  const searchable = normalize([command.label, command.description, ...command.keywords].join(" "));
  if (tokens.every((token) => searchable.includes(token))) return 3;
  return null;
};

export const rankCommands = (commands: readonly Command[], query: string) => {
  const normalizedQuery = normalize(query);
  return commands
    .map((command, index) => ({ command, index, score: score(command, normalizedQuery) }))
    .filter((result): result is typeof result & { score: number } => result.score !== null)
    .sort(
      (left, right) =>
        left.score - right.score ||
        kindPriority[left.command.kind] - kindPriority[right.command.kind] ||
        left.index - right.index,
    )
    .map(({ command }) => command);
};
