import type { Category, Media, Post } from "@/lib/cms-types";
import { populated } from "@/lib/cms-types";
import { studio } from "@/lib/site";

/**
 * Articles are authored once in the studio's Payload CMS (econome.studio) and
 * read here over its public REST API. Only posts filed under the 0xSlots
 * category surface on this site, so the studio stays the single place anything
 * is written.
 */
const CMS_URL = (
  process.env.NEXT_PUBLIC_CMS_URL ?? "https://econome.studio/cms-api"
).replace(/\/$/, "");

/**
 * Category slug that marks a studio article as belonging to this site.
 * Overridable so a run can preview against another category before articles
 * have been filed under this one.
 */
const CATEGORY = process.env.NEXT_PUBLIC_CMS_CATEGORY ?? "0xslots";

/**
 * How long a CMS read stays cached. Kept short because publishing in the
 * studio should show up here on its own: at an hour, a new article sat behind
 * a stale /blog and sitemap long after it went live. ISR is lazy — this only
 * costs a request when someone actually loads the page after the window.
 *
 * Must stay in step with the `revalidate` each page exports; the shorter of
 * the two does nothing if the fetch underneath is still serving old data.
 */
const REVALIDATE = 60;

// The build container has no route to the CMS in most deploys (Dokploy builds
// on a different network than the running service). Rather than fail the
// build, degrade to empty and let ISR fill the pages in at runtime. A failure
// at runtime is real and propagates.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

type ListResponse = {
  docs: Post[];
  totalDocs: number;
  totalPages: number;
  page: number;
};

async function cmsFetch<T>(path: string, fallback: T): Promise<T> {
  const url = `${CMS_URL}${path}`;
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    if (IS_BUILD) {
      console.warn(`[blog] CMS unreachable at build, degrading: ${message}`);
      return fallback;
    }
    throw new Error(`[blog] CMS request failed (${url}): ${message}`);
  }
}

/** Shared query: published 0xSlots posts, pinned first, then newest. */
function listQuery(extra = ""): string {
  const params = [
    "where[_status][equals]=published",
    `where[categories.slug][equals]=${CATEGORY}`,
    "depth=2",
    "sort=-featured,-publishedAt",
    extra,
  ].filter(Boolean);
  return `/posts?${params.join("&")}`;
}

export async function getPosts(limit = 50): Promise<Post[]> {
  const data = await cmsFetch<ListResponse>(listQuery(`limit=${limit}`), {
    docs: [],
    totalDocs: 0,
    totalPages: 0,
    page: 1,
  });
  return data.docs ?? [];
}

export async function getPostSlugs(): Promise<string[]> {
  const posts = await getPosts();
  return posts.map((p) => p.slug).filter(Boolean);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  // Re-applies the category filter so a studio article outside 0xSlots is a
  // 404 here even if someone guesses its slug.
  const data = await cmsFetch<ListResponse>(
    listQuery(`limit=1&where[slug][equals]=${encodeURIComponent(slug)}`),
    { docs: [], totalDocs: 0, totalPages: 0, page: 1 },
  );
  return data.docs?.[0] ?? null;
}

/** Media urls arrive absolute from the IPFS gateway, but tolerate relative. */
export function mediaUrl(
  value: Media | number | null | undefined,
): string | null {
  const media = populated<Media>(value);
  if (!media?.url) return null;
  if (/^https?:\/\//.test(media.url)) return media.url;
  return `${CMS_URL.replace(/\/cms-api$/, "")}${media.url}`;
}

/**
 * Links inside articles are authored against the studio's own site, so a bare
 * "/contact" means econome.studio/contact — here it would 404. Anything
 * root-relative is resolved back to the studio; fragments and absolute urls
 * are left alone.
 */
export function resolveArticleHref(href: string): string {
  if (!href) return "#";
  if (href.startsWith("/")) return `${studio.url}${href}`;
  return href;
}

export function categoryTitles(post: Post): Category[] {
  return (post.categories ?? []).filter(
    (c): c is Category => typeof c === "object" && c !== null,
  );
}

/** Meta descriptions read badly past ~160 chars in SERPs; cut on a word. */
export function clampDescription(
  text: string | null | undefined,
  max = 160,
): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, clean.lastIndexOf(" ", max - 1))}…`;
}
