/**
 * Page-level data loading. Each loader fetches what one page needs and returns a tagged result so the
 * Astro views stay declarative: they only decide how to render ok / notfound / unavailable.
 */

import { createHash } from 'node:crypto';
import type { Locale } from '../i18n';
import { localePath } from '../i18n';
import { getLog } from './log';
import { Lru } from './lru';
import { readingMinutes, renderMarkdown } from './markdown';
import { UpstreamError } from './pb';
import { adjacent, getPost, imageUrl, listPosts } from './posts';
import { getProject, listProjects } from './projects';
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

/** Rendered markdown keyed by post + content hash: Shiki highlighting is the expensive part of a post view. */
const postBodies = new Lru<{ html: string; headings: { id: string; text: string }[] }>(100);

async function renderPostBody(post: Post) {
  const key = createHash('sha1').update(`${post.id}\0${post.bodyMd}`).digest('hex');
  const hit = postBodies.get(key);
  if (hit) return hit;
  const fresh = await renderMarkdown(post.bodyMd, {
    resolveImage: (name) => imageUrl({ id: post.id }, name),
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
    const [posts, projects] = await Promise.all([
      listPosts({ limit: 5 }),
      listProjects({ limit: 6, lang: locale }),
    ]);
    return { posts, projects };
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
export const yearsOf = (posts: PostSummary[]): string[] => [
  ...new Set(posts.map((p) => p.date.slice(0, 4))),
];

export const loadBlogIndex = () => load<PostSummary[]>('blog-index', async () => listPosts());
export const loadWorkIndex = (locale: Locale) =>
  load<ProjectSummary[]>('work-index', async () => listProjects({ lang: locale }));

export interface PostPage {
  post: Post;
  html: string;
  headings: { id: string; text: string }[];
  minutes: number;
  previous: PostSummary | null;
  next: PostSummary | null;
  /** Locale → URL for every language this post exists in (drives hreflang and the language menu). */
  alternates: Alternates;
}

export const loadPostPage = (slug: string, locale: Locale, token?: string) =>
  load<PostPage>('post', async () => {
    const post = await getPost(slug, locale, undefined, { fallback: true, token });
    if (!post) return null;
    const [all, body] = await Promise.all([listPosts(), renderPostBody(post)]);
    return {
      post,
      html: body.html,
      headings: body.headings,
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

export const loadProjectPage = (slug: string, locale: Locale) =>
  load<ProjectPage>('project', async () => {
    const project = (await getProject(slug, locale)) ?? (await getProject(slug, 'en'));
    if (!project) return null;
    const [all, rendered] = await Promise.all([
      listProjects({ lang: locale }),
      renderMarkdown(project.bodyMd, { resolveImage: (n) => n }),
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
