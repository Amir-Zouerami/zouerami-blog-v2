/**
 * Page-level data loading. Each loader fetches what one page needs and returns a tagged result so the
 * Astro views stay declarative: they only decide how to render ok / notfound / unavailable.
 */

import { createHash } from 'node:crypto';
import type { Locale } from '../i18n';
import { localePath, yearLabel } from '../i18n';
import { getConfig } from './config';
import { getLayout, LAYOUT_MAX, orderFeatured, pickInOrder } from './layouts';
import { getLog } from './log';
import { Lru } from './lru';
import { readingMinutes, renderMarkdown } from './markdown';
import { UpstreamError } from './pb';
import { adjacent, getPost, imageUrl, listPosts } from './posts';
import { getProject, listProjects } from './projects';
import { postSlugs, type Reference, type ResolvedPost } from './references';
import type { Post, PostSummary, Project, ProjectSummary } from './schemas';

export type Loaded<T> = { kind: 'ok'; data: T } | { kind: 'notfound' } | { kind: 'unavailable' };

/** Runs a loader: `null` means "does not exist", an UpstreamError means "backend down"; anything else is a bug. */
export async function load<T>(scope: string, fn: () => Promise<T | null>): Promise<Loaded<T>> {
  try {
    const data = await fn();
    return data === null ? { kind: 'notfound' } : { kind: 'ok', data };
  } catch (err) {
    if (!(err instanceof UpstreamError)) throw err;
    getLog().error({ err, scope }, 'page data unavailable');
    return { kind: 'unavailable' };
  }
}

/** What `[@post:slug]` becomes: the published post (title in the reader's language) with a link in the same chrome. */
export function postResolver(all: PostSummary[], locale: Locale) {
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  const host = new URL(getConfig().siteUrl).host;
  return {
    bySlug,
    resolve: async (slug: string): Promise<ResolvedPost | null> => {
      const p = bySlug.get(slug);
      if (!p) return null;
      const path = localePath(locale, `/blog/${slug}`);
      return {
        slug,
        title: p.title,
        url: path,
        domain: host,
        path,
        date: p.date,
        tags: p.tags,
        cover: p.cover,
      };
    },
  };
}

/** Rendered markdown keyed by post + content hash: Shiki highlighting is the expensive part of a post view. */
const postBodies = new Lru<{
  html: string;
  headings: { id: string; text: string }[];
  references: Reference[];
}>(100);

async function renderPostBody(post: Post, locale: Locale, all: PostSummary[]) {
  const { bySlug, resolve } = postResolver(all, locale);
  // posts cited with [@post:slug] are part of the output: when one is renamed the cached page must change too
  const cited = postSlugs(post.bodyMd)
    .map((s) => {
      const p = bySlug.get(s);
      return p ? `${s}:${p.title}:${p.date}:${p.cover ?? ''}` : s;
    })
    .join('|');
  const key = createHash('sha1')
    .update(`${post.id}\0${post.lang}\0${locale}\0${cited}\0${post.bodyMd}`)
    .digest('hex');
  const hit = postBodies.get(key);
  if (hit) return hit;
  const fresh = await renderMarkdown(post.bodyMd, {
    resolveImage: (name) => imageUrl({ id: post.id }, name),
    lang: post.lang,
    resolvePost: resolve,
  });
  postBodies.set(key, fresh);
  return fresh;
}

type Alternates = Partial<Record<Locale, string>>;

export interface HomePage {
  posts: PostSummary[];
  projects: ProjectSummary[];
}
export const loadHome = (locale: Locale) =>
  load<HomePage>('home', async () => {
    const [all, projects, chosen] = await Promise.all([
      listPosts({ lang: locale }),
      listProjects({ limit: 6, lang: locale }),
      getLayout('home'),
    ]);
    // the posts picked in the back office, in that order; nothing picked (or none still published) = the newest five
    const picked = pickInOrder(all, chosen);
    return { posts: picked.length ? picked : all.slice(0, LAYOUT_MAX), projects };
  });

export interface BlogFilter {
  tag: string;
  q: string;
}

/** Tag + free-text filter over the already-loaded list (title, summary, tags). */
export function filterPosts(all: PostSummary[], { tag, q }: BlogFilter): PostSummary[] {
  const needle = q.trim().toLowerCase();
  return all.filter(
    (p) =>
      (tag === 'all' || p.tags.includes(tag)) &&
      (!needle || `${p.title} ${p.summary} ${p.tags.join(' ')}`.toLowerCase().includes(needle)),
  );
}

export const allTags = (posts: PostSummary[]): string[] =>
  [...new Set(posts.flatMap((p) => p.tags))].sort();
/** Posts (already newest-first) grouped by the year in the reader's calendar: Jalali on the Persian site. */
export function groupByYear(
  posts: PostSummary[],
  locale: Locale,
): { year: string; posts: PostSummary[] }[] {
  const groups: { year: string; posts: PostSummary[] }[] = [];
  for (const p of posts) {
    const year = yearLabel(p.date, locale);
    const last = groups.at(-1);
    if (last && last.year === year) last.posts.push(p);
    else groups.push({ year, posts: [p] });
  }
  return groups;
}

export interface BlogIndex {
  posts: PostSummary[];
  /** The featured collage: marked posts in the order chosen in the back office (see orderFeatured). */
  featured: PostSummary[];
}
export const loadBlogIndex = (locale: Locale) =>
  load<BlogIndex>('blog-index', async () => {
    const [posts, order] = await Promise.all([listPosts({ lang: locale }), getLayout('featured')]);
    return { posts, featured: orderFeatured(posts, order) };
  });
export const loadWorkIndex = (locale: Locale) =>
  load<ProjectSummary[]>('work-index', async () => listProjects({ lang: locale }));

export interface PostPage {
  post: Post;
  html: string;
  headings: { id: string; text: string }[];
  references: Reference[];
  minutes: number;
  previous: PostSummary | null;
  next: PostSummary | null;
  /** Locale → URL for every language this post exists in (drives hreflang and the language menu). */
  alternates: Alternates;
}

/** `contentLang`: the language of the text (chosen with the in-post toggle); the page chrome stays in `locale`. */
export const loadPostPage = (
  slug: string,
  locale: Locale,
  token?: string,
  contentLang: Locale = locale,
) =>
  load<PostPage>('post', async () => {
    const post = await getPost(slug, contentLang, undefined, { fallback: true, token });
    if (!post) return null;
    const all = await listPosts({ lang: locale });
    const body = await renderPostBody(post, locale, all);
    return {
      post,
      html: body.html,
      headings: body.headings,
      references: body.references,
      minutes: readingMinutes(post.bodyMd),
      ...adjacent(all, post.slug),
      alternates: Object.fromEntries(
        post.langs.map((l) => [l, localePath(l, `/blog/${post.slug}`)]),
      ),
    };
  });

export interface ProjectPage {
  project: Project;
  html: string;
  next: ProjectSummary | null;
  alternates: Alternates;
  /** Case studies are written in English; other locales show it inside their own chrome. */
  fellBack: boolean;
}

/** Highlighting code is the expensive part: done once per version of the text, as for posts. */
async function renderProjectBody(project: Project) {
  const key = createHash('sha1')
    .update(`project\0${project.id}\0${project.lang}\0${project.bodyMd}`)
    .digest('hex');
  const hit = postBodies.get(key);
  if (hit) return hit;
  const fresh = await renderMarkdown(project.bodyMd, {
    resolveImage: (name) => imageUrl(project, name, undefined, 'projects'),
    lang: project.lang,
  });
  postBodies.set(key, fresh);
  return fresh;
}

export const loadProjectPage = (slug: string, locale: Locale, token?: string) =>
  load<ProjectPage>('project', async () => {
    const get = (lang: Locale) => getProject(slug, lang, undefined, { token });
    // the asked language, else whichever one is written
    const project = (await get(locale)) ?? (await get('en')) ?? (await get('fa'));
    if (!project) return null;
    const [all, rendered] = await Promise.all([
      listProjects({ lang: locale }),
      renderProjectBody(project),
    ]);
    const i = all.findIndex((p) => p.slug === project.slug);
    return {
      project,
      html: rendered.html,
      next: all.length > 1 && i >= 0 ? (all[(i + 1) % all.length] ?? null) : null,
      alternates: Object.fromEntries(
        project.langs.map((l) => [l, localePath(l, `/work/${project.slug}`)]),
      ),
      fellBack: project.lang !== locale,
    };
  });
