import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getAllPublishedSlugs, getAllCategories, getAllTags, getAllAuthors, getPageBySlug } from "@/lib/queries";

type SitemapEntry = MetadataRoute.Sitemap[number];

/**
 * Dynamic sitemap.xml with lastmod.
 * Includes: home, blog index, posts, categories, tags (only if >=3 posts? we
 * list all but thin tags can be noindexed via metadata), authors,
 * trust pages, archive, search is excluded (noindex). Admin excluded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags, authors] = await Promise.all([
    getAllPublishedSlugs().catch(() => []),
    getAllCategories().catch(() => []),
    getAllTags().catch(() => []),
    getAllAuthors().catch(() => []),
  ]);

  // Trust/static pages that are backed by a `pages` DB row carry that row's
  // updatedAt as lastmod. Pure static routes (home, blog, models, archive,
  // contact) have no DB row, so they are emitted without lastmod rather than
  // inventing a build-time date.
  const [aboutPage, privacyPage, termsPage, disclaimerPage, cookiePage, editorialPage] =
    await Promise.all([
      getPageBySlug("about").catch(() => null),
      getPageBySlug("privacy-policy").catch(() => null),
      getPageBySlug("terms-of-service").catch(() => null),
      getPageBySlug("disclaimer").catch(() => null),
      getPageBySlug("cookie-policy").catch(() => null),
      getPageBySlug("editorial-policy").catch(() => null),
    ]);

  // Emits lastmod from the page's DB updatedAt when available, otherwise omits it.
  const trustEntry = (
    url: string,
    page: { updatedAt: string } | null,
    changeFrequency: SitemapEntry["changeFrequency"],
    priority: number,
  ): SitemapEntry =>
    page
      ? { url, lastModified: new Date(page.updatedAt), changeFrequency, priority }
      : { url, changeFrequency, priority };

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: site.url, changeFrequency: "daily", priority: 1 },
    { url: `${site.url}/blog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site.url}/models`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site.url}/archive`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${site.url}/contact`, changeFrequency: "monthly", priority: 0.5 },
    trustEntry(`${site.url}/about`, aboutPage, "monthly", 0.7),
    trustEntry(`${site.url}/privacy-policy`, privacyPage, "yearly", 0.3),
    trustEntry(`${site.url}/terms-of-service`, termsPage, "yearly", 0.3),
    trustEntry(`${site.url}/disclaimer`, disclaimerPage, "yearly", 0.3),
    trustEntry(`${site.url}/cookie-policy`, cookiePage, "yearly", 0.3),
    trustEntry(`${site.url}/editorial-policy`, editorialPage, "yearly", 0.4),
  ];

  // Sitemap image entries must be absolute URLs. featuredImageUrl is stored
  // as a path (e.g. /images/articles/foo.svg) or a full URL; normalize both.
  const toAbsoluteImage = (src: string): string =>
    src.startsWith("http://") || src.startsWith("https://")
      ? src
      : `${site.url}${src.startsWith("/") ? src : `/${src}`}`;

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${site.url}/blog/${p.slug}`,
    lastModified: new Date(p.updatedAt || p.publishedAt || new Date()),
    changeFrequency: "weekly",
    priority: 0.8,
    images: p.featuredImageUrl ? [toAbsoluteImage(p.featuredImageUrl)] : [],
  }));

  const catRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${site.url}/category/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const tagRoutes: MetadataRoute.Sitemap = tags.map((t) => ({
    url: `${site.url}/tag/${t.slug}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  const authorRoutes: MetadataRoute.Sitemap = authors.map((a) => ({
    url: `${site.url}/author/${a.slug}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...catRoutes, ...tagRoutes, ...authorRoutes];
}
