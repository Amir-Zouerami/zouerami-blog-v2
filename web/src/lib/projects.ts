import type PocketBase from 'pocketbase';
import { getPb, toUpstream } from './pb';
import { imageUrl } from './posts';
import {
  type Lang,
  type Project,
  type ProjectRecord,
  ProjectRecordSchema,
  type ProjectSummary,
  type ProjectTranslationRecord,
  ProjectTranslationRecordSchema,
  SlugSchema,
} from './schemas';

const LANG_ORDER: Lang[] = ['en', 'fa'];

function summarize(p: ProjectRecord, trs: ProjectTranslationRecord[], prefer?: Lang) {
  const langs = LANG_ORDER.filter((l) => trs.some((t) => t.lang === l));
  const shown =
    (prefer && trs.find((t) => t.lang === prefer)) || trs.find((t) => t.lang === langs[0]);
  if (!shown) return null;
  const summary: ProjectSummary = {
    slug: p.slug,
    name: p.name,
    year: p.year,
    category: p.category,
    stack: p.stack,
    blurb: shown.blurb,
    metricValue: p.metric_value,
    metricIcon: p.metric_icon,
    metricLabel: shown.metric_label,
    linkLive: p.link_live,
    linkRepo: p.link_repo,
    langs,
    cover: p.cover ? imageUrl(p, p.cover, undefined, 'projects') : null,
  };
  return { summary, tr: shown };
}

/** Published projects in `sort` order. Projects without any translation are skipped. */
export async function listProjects(
  opts: { limit?: number; lang?: Lang } = {},
  pb: PocketBase = getPb(),
): Promise<ProjectSummary[]> {
  let projects: ProjectRecord[];
  let trs: ProjectTranslationRecord[];
  try {
    const [rp, rt] = await Promise.all([
      pb.collection('projects').getFullList({ sort: 'sort,-year', filter: 'status = "published"' }),
      pb.collection('project_translations').getFullList({ filter: 'project.status = "published"' }),
    ]);
    projects = rp.map((r) => ProjectRecordSchema.parse(r));
    trs = rt.map((r) => ProjectTranslationRecordSchema.parse(r));
  } catch (error) {
    toUpstream(error);
  }
  const out = projects
    .filter((p) => p.status === 'published')
    .map(
      (p) =>
        summarize(
          p,
          trs.filter((t) => t.project === p.id),
          opts.lang,
        )?.summary,
    )
    .filter((s): s is ProjectSummary => !!s);
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export async function getProject(
  slug: string,
  lang: Lang,
  pb: PocketBase = getPb(),
  /** `token`: draft preview token (matches the project's `preview_token`; PocketBase enforces it). */
  opts: { token?: string } = {},
): Promise<Project | null> {
  if (!SlugSchema.safeParse(slug).success) return null;
  const query = opts.token ? { token: opts.token } : undefined;
  let rec: ProjectRecord;
  let trs: ProjectTranslationRecord[];
  try {
    rec = ProjectRecordSchema.parse(
      await pb
        .collection('projects')
        .getFirstListItem(
          opts.token ? `slug = "${slug}"` : `slug = "${slug}" && status = "published"`,
          { query },
        ),
    );
    trs = (
      await pb
        .collection('project_translations')
        .getFullList({ filter: `project = "${rec.id}"`, query })
    )
      .map((r) => ProjectTranslationRecordSchema.parse(r))
      .filter((t) => t.project === rec.id);
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    toUpstream(error);
  }
  const preview = rec.status !== 'published';
  if (preview && !opts.token) return null;
  const tr = trs.find((t) => t.lang === lang);
  const s = summarize(rec, trs, lang);
  if (!tr || !s) return null;
  return { ...s.summary, lang, bodyMd: tr.body_md, id: rec.id, preview };
}
