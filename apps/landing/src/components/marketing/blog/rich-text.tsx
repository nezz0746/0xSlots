import type { ReactNode } from "react";
import { resolveArticleHref } from "@/lib/blog";
import type { LexicalNode, LexicalRoot } from "@/lib/cms-types";

/*
  A compact renderer for Payload's serialized lexical state.

  The studio's own site renders these with @payloadcms/richtext-lexical/react,
  but that pulls the Payload runtime into what is otherwise a static marketing
  site. The serialized format is small and stable, so the handful of node types
  the editor actually emits are handled here instead — styled with the 0xSlots
  tokens rather than a prose plugin, which is the point: same words, this
  site's voice.

  Unknown node types fall through to their children rather than disappearing,
  so a new editor feature degrades to plain text instead of a blank article.
*/

// Text formatting is a bitmask, not an enum — a node can be bold *and* code.
const BOLD = 1;
const ITALIC = 1 << 1;
const STRIKETHROUGH = 1 << 2;
const UNDERLINE = 1 << 3;
const CODE = 1 << 4;
const SUBSCRIPT = 1 << 5;
const SUPERSCRIPT = 1 << 6;

const linkClass =
  "text-destructive underline decoration-destructive/40 underline-offset-2 transition-colors hover:decoration-destructive";

function renderText(node: LexicalNode, key: string): ReactNode {
  const format = typeof node.format === "number" ? node.format : 0;
  let element: ReactNode = node.text ?? "";

  if (format & CODE) {
    element = (
      <code className="bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground ring-1 ring-border">
        {element}
      </code>
    );
  }
  if (format & BOLD)
    element = <strong className="font-semibold">{element}</strong>;
  if (format & ITALIC) element = <em>{element}</em>;
  if (format & STRIKETHROUGH) element = <s>{element}</s>;
  if (format & UNDERLINE) element = <u>{element}</u>;
  if (format & SUBSCRIPT) element = <sub>{element}</sub>;
  if (format & SUPERSCRIPT) element = <sup>{element}</sup>;

  return <span key={key}>{element}</span>;
}

function childrenOf(node: LexicalNode, keyPrefix: string): ReactNode[] {
  return (node.children ?? []).map((child, i) =>
    renderNode(child, `${keyPrefix}-${i}`),
  );
}

const headingClass: Record<string, string> = {
  h1: "display mt-14 mb-5 text-3xl md:text-4xl",
  h2: "display mt-12 mb-4 text-2xl md:text-3xl",
  h3: "display-tight mt-10 mb-3 text-lg md:text-xl",
  h4: "display-tight mt-8 mb-2 text-base",
  h5: "display-tight mt-6 mb-2 text-sm",
  h6: "eyebrow mt-6 mb-2",
};

function renderNode(node: LexicalNode, key: string): ReactNode {
  switch (node.type) {
    case "text":
      return renderText(node, key);

    case "linebreak":
      return <br key={key} />;

    case "paragraph": {
      const kids = childrenOf(node, key);
      // Lexical emits empty paragraphs as spacing; rendering them as <p> adds
      // stray gaps, so drop the ones with no content.
      if (kids.length === 0) return null;
      const align = typeof node.format === "string" ? node.format : "";
      return (
        <p
          key={key}
          className="my-5 leading-[1.75] text-foreground"
          style={align ? { textAlign: align as "center" } : undefined}
        >
          {kids}
        </p>
      );
    }

    case "heading": {
      const Tag = (node.tag ?? "h2") as "h2";
      return (
        <Tag
          key={key}
          className={headingClass[node.tag ?? "h2"] ?? headingClass.h2}
        >
          {childrenOf(node, key)}
        </Tag>
      );
    }

    case "quote":
      return (
        <blockquote
          key={key}
          className="my-8 border-l-2 border-destructive bg-muted py-4 pl-5 pr-4 text-lg leading-relaxed text-foreground"
        >
          {childrenOf(node, key)}
        </blockquote>
      );

    case "list": {
      const ordered = node.tag === "ol" || node.listType === "number";
      const List = ordered ? "ol" : "ul";
      return (
        <List
          key={key}
          start={ordered && node.start !== 1 ? node.start : undefined}
          className={`my-5 space-y-2 pl-6 ${
            ordered ? "list-decimal" : "list-disc"
          } marker:text-muted-foreground`}
        >
          {childrenOf(node, key)}
        </List>
      );
    }

    case "listitem":
      return (
        <li key={key} className="leading-[1.7] text-foreground">
          {childrenOf(node, key)}
        </li>
      );

    case "link":
    case "autolink": {
      const fields = node.fields ?? {};
      // Both kinds of internal link point into the studio's site: a doc
      // reference to one of its articles, and a root-relative url like
      // "/contact". Neither exists here, so resolve both back to the studio.
      const docValue = fields.doc?.value;
      const raw =
        fields.url ??
        (typeof docValue === "object" && docValue?.slug
          ? `/blog/${docValue.slug}`
          : "#");
      const href = resolveArticleHref(raw);
      const external = /^https?:\/\//.test(href);
      return (
        <a
          key={key}
          href={href}
          className={linkClass}
          {...(fields.newTab || external
            ? { target: "_blank", rel: "noreferrer" }
            : {})}
        >
          {childrenOf(node, key)}
        </a>
      );
    }

    case "horizontalrule":
      return <hr key={key} className="my-10 border-t-2 border-foreground" />;

    case "root":
      return <div key={key}>{childrenOf(node, key)}</div>;

    default:
      // Unknown node: keep the words, lose the styling.
      return <span key={key}>{childrenOf(node, key)}</span>;
  }
}

export function RichText({ data }: { data: LexicalRoot | null | undefined }) {
  if (!data?.root) return null;
  return <>{childrenOf(data.root, "n")}</>;
}
