import { For, Match, Switch, createMemo, type JSX } from "solid-js";

// A small Markdown subset for organizer-written text shown to attendees: paragraphs, line
// breaks, "-" or "*" bullet lists, **bold**, *italic*, [links](https://…), and bare URLs.
// It renders through JSX, never innerHTML, and only links http, https, and mailto URLs.

type Inline =
  | { kind: "text"; text: string }
  | { kind: "break" }
  | { kind: "strong" | "em"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] };

type Block = { kind: "paragraph"; children: Inline[] } | { kind: "list"; items: Inline[][] };

const inlinePattern =
  /\[([^\]\n]+)\]\(([^()\s]+)\)|\*\*(?!\s)([^\n]+?)(?<!\s)\*\*|\*(?!\s)([^*\n]+?)(?<!\s)\*|(?<![\p{L}\p{N}_])_(?!\s)([^_\n]+?)(?<!\s)_(?![\p{L}\p{N}_])|(https?:\/\/[^\s<>"]+)/gu;

const safeHref = (value: string) => {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const parseInline = (source: string, allowLinks = true): Inline[] => {
  const nodes: Inline[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = nodes.at(-1);
    if (last?.kind === "text") last.text += text;
    else nodes.push({ kind: "text", text });
  };
  let cursor = 0;
  for (const match of source.matchAll(inlinePattern)) {
    const [whole, label, href, strong, starEm, underscoreEm, bareUrl] = match;
    pushText(source.slice(cursor, match.index));
    cursor = match.index + whole.length;
    if (label !== undefined && href !== undefined) {
      const safe = allowLinks ? safeHref(href) : null;
      if (safe) nodes.push({ kind: "link", href: safe, children: parseInline(label, false) });
      else pushText(whole);
    } else if (strong !== undefined) {
      nodes.push({ kind: "strong", children: parseInline(strong, allowLinks) });
    } else if (starEm !== undefined || underscoreEm !== undefined) {
      nodes.push({ kind: "em", children: parseInline(starEm ?? underscoreEm!, allowLinks) });
    } else if (bareUrl !== undefined) {
      // Sentence punctuation after a URL belongs to the sentence, not the link.
      const url = bareUrl.replace(/[.,;:!?)]+$/, "");
      const safe = allowLinks ? safeHref(url) : null;
      if (safe) nodes.push({ kind: "link", href: safe, children: [{ kind: "text", text: url }] });
      else pushText(url);
      pushText(bareUrl.slice(url.length));
    }
  }
  pushText(source.slice(cursor));
  return nodes;
};

export const parseMarkdown = (source: string): Block[] => {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] = [];
  const flush = () => {
    if (paragraph.length) {
      blocks.push({
        kind: "paragraph",
        children: paragraph.flatMap((line, index) => [
          ...(index ? [{ kind: "break" } as const] : []),
          ...parseInline(line),
        ]),
      });
    }
    if (list.length) blocks.push({ kind: "list", items: list });
    paragraph = [];
    list = [];
  };
  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (item) {
      if (paragraph.length) flush();
      list.push(parseInline(item[1]!));
    } else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
};

const inlineText = (nodes: Inline[]): string =>
  nodes
    .map((node) =>
      node.kind === "text" ? node.text : node.kind === "break" ? " " : inlineText(node.children),
    )
    .join("");

export const markdownToPlainText = (source: string) =>
  parseMarkdown(source)
    .map((block) =>
      block.kind === "paragraph"
        ? inlineText(block.children)
        : block.items.map(inlineText).join(" "),
    )
    .join(" ");

const renderInline = (nodes: Inline[]): JSX.Element => (
  <For each={nodes}>
    {(node) => (
      <Switch>
        <Match when={node.kind === "text" && node}>{(text) => text().text}</Match>
        <Match when={node.kind === "break"}>
          <br />
        </Match>
        <Match when={node.kind === "strong" && node}>
          {(strong) => <strong>{renderInline(strong().children)}</strong>}
        </Match>
        <Match when={node.kind === "em" && node}>
          {(em) => <em>{renderInline(em().children)}</em>}
        </Match>
        <Match when={node.kind === "link" && node}>
          {(link) => (
            <a href={link().href} target="_blank" rel="noopener noreferrer">
              {renderInline(link().children)}
            </a>
          )}
        </Match>
      </Switch>
    )}
  </For>
);

export const Markdown = (props: { source: string; class?: string }) => {
  const blocks = createMemo(() => parseMarkdown(props.source));
  return (
    <div class={props.class}>
      <For each={blocks()}>
        {(block) =>
          block.kind === "paragraph" ? (
            <p>{renderInline(block.children)}</p>
          ) : (
            <ul>
              <For each={block.items}>{(item) => <li>{renderInline(item)}</li>}</For>
            </ul>
          )
        }
      </For>
    </div>
  );
};
