import type { ReactNode } from "react";
import { isSafeUrl } from "./sanitize-url";

const TOKEN_REGEX = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Minimal safe inline markup: **bold**, *italic*, [text](url). Renders
 * directly to React nodes (no dangerouslySetInnerHTML, no HTML parser), so
 * there is no rich-text-editor dependency and no XSS surface — unmatched
 * text is emitted as plain strings and links are dropped to plain text if
 * their URL fails the safe-protocol allowlist.
 */
export function parseInlineRichText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(<em key={key++}>{match[2]}</em>);
    } else if (match[3] !== undefined && match[4] !== undefined) {
      const label = match[3];
      const href = match[4];
      if (isSafeUrl(href)) {
        const external = !href.startsWith("/") && !href.startsWith("#");
        nodes.push(
          <a
            key={key++}
            href={href}
            className="underline underline-offset-2 hover:text-secondary"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    }

    lastIndex = TOKEN_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
