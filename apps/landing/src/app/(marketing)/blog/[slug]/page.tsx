import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RenderBlocks } from "@/components/marketing/blog/render-blocks";
import {
  categoryTitles,
  clampDescription,
  getPostBySlug,
  getPostSlugs,
  mediaUrl,
} from "@/lib/blog";
import type { Author } from "@/lib/cms-types";
import { populatedList } from "@/lib/cms-types";
import { title as siteTitle, siteUrl, studio } from "@/lib/site";

// Keep in step with REVALIDATE in lib/blog.ts.
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  // The studio's SEO plugin fills meta.*; fall back to the article's own
  // fields when a post predates it.
  const title = post.meta?.title ?? post.title;
  const description = clampDescription(post.meta?.description ?? post.excerpt);
  const image = mediaUrl(post.meta?.image) ?? mediaUrl(post.heroImage);

  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      // Next replaces the parent openGraph wholesale rather than merging, so
      // siteName/url have to be restated or the article unfurls without them.
      type: "article",
      siteName: siteTitle,
      url: `/blog/${post.slug}`,
      title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt ?? undefined,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const hero = mediaUrl(post.heroImage);
  const image = mediaUrl(post.meta?.image) ?? hero;
  const categories = categoryTitles(post);
  const authors = populatedList<Author>(post.authors);
  const date = formatDate(post.publishedAt);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: clampDescription(post.meta?.description ?? post.excerpt),
      url: `${siteUrl}/blog/${post.slug}`,
      mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
      datePublished: post.publishedAt ?? undefined,
      dateModified: post.updatedAt ?? post.publishedAt ?? undefined,
      ...(image ? { image: [image] } : {}),
      ...(authors.length
        ? {
            author: authors.map((a) => ({
              "@type": "Person",
              name: a.name ?? undefined,
            })),
          }
        : {
            author: {
              "@type": "Organization",
              name: studio.name,
              url: studio.url,
            },
          }),
      publisher: {
        "@type": "Organization",
        name: siteTitle,
        url: siteUrl,
      },
      keywords: categories.map((c) => c.title).join(", ") || undefined,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: "Writing",
          item: `${siteUrl}/blog`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title,
          item: `${siteUrl}/blog/${post.slug}`,
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD injection
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <Link
          href="/blog"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-destructive"
        >
          ← All writing
        </Link>

        <article className="mt-10">
          <header className="border-b-2 border-foreground pb-8">
            {hero && (
              <div className="mb-8 inline-flex border-2 border-foreground bg-muted p-3">
                <Image
                  src={hero}
                  alt={post.title}
                  width={64}
                  height={64}
                  className="h-14 w-14 object-contain"
                  unoptimized
                />
              </div>
            )}
            <h1 className="display max-w-4xl text-3xl md:text-5xl">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {date && (
                <time dateTime={post.publishedAt ?? undefined}>{date}</time>
              )}
              {authors.length > 0 && (
                <span>
                  {authors
                    .map((a) => a.name)
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
              {categories.map((category) => (
                <span
                  key={category.id}
                  className="border border-border px-2 py-0.5"
                >
                  {category.title}
                </span>
              ))}
            </div>
          </header>

          {/* Prose keeps a narrower measure than the 6xl frame: set to the full
              width, lines run well past the ~75 characters that stay readable. */}
          <div className="mt-10 max-w-3xl">
            <RenderBlocks blocks={post.content} />
          </div>

          <footer className="mt-16 border-t-2 border-foreground pt-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Written at{" "}
              <a
                href={studio.url}
                target="_blank"
                rel="noreferrer"
                className="text-foreground transition-colors hover:text-destructive"
              >
                {studio.name}
              </a>
            </p>
          </footer>
        </article>
      </main>
    </>
  );
}
