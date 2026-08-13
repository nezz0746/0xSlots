/**
 * The slice of the studio's Payload schema this site consumes.
 *
 * Hand-written rather than imported: the CMS lives in another repo, and the
 * vitrine only reads published posts over REST. Keep these in step with
 * studio-commerce `apps/landing/payload/collections` and `payload/blocks`.
 */

export type Media = {
  id: number;
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
};

export type Category = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
};

export type Author = {
  id: number;
  name?: string | null;
};

/** Lexical serialized nodes, narrowed to what the studio's editor emits. */
export type LexicalNode = {
  type: string;
  version?: number;
  /** Bitmask on text nodes; block alignment ("center"…) on element nodes. */
  format?: number | string;
  text?: string;
  tag?: string;
  listType?: string;
  start?: number;
  children?: LexicalNode[];
  fields?: {
    url?: string | null;
    newTab?: boolean | null;
    linkType?: string | null;
    doc?: { value?: { slug?: string } | number } | null;
  } | null;
};

export type LexicalRoot = { root: LexicalNode };

export type RichTextBlock = {
  blockType: "richText";
  id?: string | null;
  richText: LexicalRoot;
};

export type ImageBlock = {
  blockType: "image";
  id?: string | null;
  image: Media | number;
  caption?: string | null;
  size?: "normal" | "wide" | "full" | null;
};

export type GalleryBlock = {
  blockType: "gallery";
  id?: string | null;
  images?:
    | { id?: string | null; image: Media | number; caption?: string | null }[]
    | null;
};

export type QuoteBlock = {
  blockType: "quote";
  id?: string | null;
  quote: string;
  attribution?: string | null;
};

export type CTABlock = {
  blockType: "cta";
  id?: string | null;
  heading: string;
  body?: string | null;
  buttonLabel: string;
  buttonHref: string;
};

export type CodeBlock = {
  blockType: "code";
  id?: string | null;
  language?: string | null;
  code: string;
};

export type EmbedBlock = {
  blockType: "embed";
  id?: string | null;
  url: string;
  caption?: string | null;
};

export type PostBlock =
  | RichTextBlock
  | ImageBlock
  | GalleryBlock
  | QuoteBlock
  | CTABlock
  | CodeBlock
  | EmbedBlock;

export type Post = {
  id: number;
  title: string;
  slug: string;
  featured?: boolean | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  excerpt?: string | null;
  authors?: (Author | number)[] | null;
  categories?: (Category | number)[] | null;
  heroImage?: Media | number | null;
  cardBackground?: Media | number | null;
  content?: PostBlock[] | null;
  meta?: {
    title?: string | null;
    description?: string | null;
    image?: Media | number | null;
  } | null;
};

/** `depth` populates relationships; anything still a number never resolved. */
export function populated<T>(value: T | number | null | undefined): T | null {
  return typeof value === "object" && value !== null ? (value as T) : null;
}

export function populatedList<T>(
  values: (T | number)[] | null | undefined,
): T[] {
  return (values ?? []).filter(
    (v): v is T => typeof v === "object" && v !== null,
  );
}
