import Image from "next/image";
import { RichText } from "@/components/marketing/blog/rich-text";
import { Button } from "@/components/ui/button";
import { mediaUrl, resolveArticleHref } from "@/lib/blog";
import type { Media, PostBlock } from "@/lib/cms-types";
import { populated } from "@/lib/cms-types";

/** Wide/full images break the reading measure deliberately. */
const imageWidth: Record<string, string> = {
  normal: "",
  wide: "md:-mx-12",
  full: "md:-mx-20",
};

function Figure({
  value,
  caption,
  size,
}: {
  value: Media | number;
  caption?: string | null;
  size?: string | null;
}) {
  const url = mediaUrl(value);
  if (!url) return null;
  const media = populated<Media>(value);
  return (
    <figure className={`my-8 ${imageWidth[size ?? "normal"] ?? ""}`}>
      <Image
        src={url}
        alt={media?.alt ?? caption ?? ""}
        width={media?.width ?? 1600}
        height={media?.height ?? 900}
        className="h-auto w-full border-2 border-foreground"
        // Media is served from the studio's IPFS gateway, already sized.
        unoptimized
      />
      {caption && (
        <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** YouTube/Vimeo watch urls have to become embed urls before they'll frame. */
function embedSrc(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return `https://www.youtube.com/embed${url.pathname}`;
    }
    if (host.endsWith("youtube.com")) {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (url.pathname.startsWith("/embed/")) return raw;
    }
    if (host.endsWith("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function RenderBlocks({
  blocks,
}: {
  blocks: PostBlock[] | null | undefined;
}) {
  return (
    <>
      {(blocks ?? []).map((block, i) => {
        const key = block.id ?? `${block.blockType}-${i}`;

        switch (block.blockType) {
          case "richText":
            return <RichText key={key} data={block.richText} />;

          case "image":
            return (
              <Figure
                key={key}
                value={block.image}
                caption={block.caption}
                size={block.size}
              />
            );

          case "gallery":
            return (
              <div
                key={key}
                className="my-8 grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                {(block.images ?? []).map((item, j) => (
                  <Figure
                    key={item.id ?? `${key}-${j}`}
                    value={item.image}
                    caption={item.caption}
                  />
                ))}
              </div>
            );

          case "quote":
            return (
              <figure key={key} className="my-10">
                <blockquote className="border-l-2 border-destructive bg-muted py-5 pl-6 pr-5 text-xl leading-relaxed text-foreground">
                  {block.quote}
                </blockquote>
                {block.attribution && (
                  <figcaption className="mt-3 pl-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    — {block.attribution}
                  </figcaption>
                )}
              </figure>
            );

          case "cta": {
            // Authored on the studio's site, so "/contact" means theirs.
            const href = resolveArticleHref(block.buttonHref);
            const external = /^https?:\/\//.test(href);
            return (
              <aside
                key={key}
                className="my-12 border-2 border-foreground bg-muted p-6 offset-ink md:p-8"
              >
                <p className="display-tight text-lg md:text-xl">
                  {block.heading}
                </p>
                {block.body && (
                  <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
                    {block.body}
                  </p>
                )}
                <div className="mt-5">
                  <Button asChild size="sm">
                    <a
                      href={href}
                      {...(external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                    >
                      {block.buttonLabel}
                    </a>
                  </Button>
                </div>
              </aside>
            );
          }

          case "code":
            return (
              <div key={key} className="my-8 border-2 border-foreground bg-foreground">
                {block.language && (
                  <p className="border-b border-muted-foreground/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {block.language}
                  </p>
                )}
                <pre className="overflow-x-auto p-4">
                  <code className="font-mono text-[13px] leading-relaxed text-background">
                    {block.code}
                  </code>
                </pre>
              </div>
            );

          case "embed": {
            const src = embedSrc(block.url);
            if (!src) return null;
            return (
              <figure key={key} className="my-8">
                <div className="aspect-video w-full border-2 border-foreground">
                  <iframe
                    src={src}
                    title={block.caption ?? "Embedded video"}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
                {block.caption && (
                  <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );
          }

          default:
            return null;
        }
      })}
    </>
  );
}
