import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/blog";
import { siteUrl } from "@/lib/site";

// Keep in step with REVALIDATE in lib/blog.ts.
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts();

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    // The explorer index. Individual slot/recipient routes are deliberately
    // absent — they are address-parameterised and effectively unbounded.
    {
      url: `${siteUrl}/app`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt ?? Date.now()),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
