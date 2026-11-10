/** Idempotent sample data for local development. Run: `bun run seed` (needs PB_SUPERUSER_* in ../.env). */
import PocketBase from 'pocketbase';

const url = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090';
const email = process.env.PB_SUPERUSER_EMAIL;
const password = process.env.PB_SUPERUSER_PASSWORD;
if (!email || !password) throw new Error('PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD are required');

const pb = new PocketBase(url);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(email, password);

type Lang = 'en' | 'fa';
type TrSeed = { lang: Lang; title: string; summary: string; body_md: string };
const posts: {
  slug: string;
  date: string;
  status: 'draft' | 'published';
  tags: string[];
  tr: TrSeed[];
}[] = [
  {
    slug: 'hello-bilingual',
    date: '2026-11-02 12:00:00.000Z',
    status: 'published',
    tags: ['Notes', 'Web'],
    tr: [
      {
        lang: 'en',
        title: 'Why I rebuilt my blog (again)',
        summary: 'A blog is mostly words.',
        body_md: '# Hello\n\nEvery few years I get the itch.',
      },
      {
        lang: 'fa',
        title: 'چرا دوباره وبلاگم را از نو ساختم',
        summary: 'وبلاگ بیشتر از هر چیز کلمه است.',
        body_md: '# سلام\n\nهر چند سال یک‌بار هوس می‌کنم.',
      },
    ],
  },
  {
    slug: 'english-only',
    date: '2026-10-18 12:00:00.000Z',
    status: 'published',
    tags: ['DevOps'],
    tr: [
      {
        lang: 'en',
        title: 'PocketBase in production',
        summary: 'Sharp edges nobody warns you about.',
        body_md: 'Body.',
      },
    ],
  },
  {
    slug: 'persian-only',
    date: '2026-08-14 12:00:00.000Z',
    status: 'published',
    tags: ['Persian', 'Design'],
    tr: [
      {
        lang: 'fa',
        title: 'تایپوگرافی فارسی در وب',
        summary: 'راست‌به‌چپ بدون درد.',
        body_md: 'متن.',
      },
    ],
  },
  {
    slug: 'draft-post',
    date: '2026-11-09 12:00:00.000Z',
    status: 'draft',
    tags: ['Notes'],
    tr: [{ lang: 'en', title: 'An unfinished draft', summary: 'Not public.', body_md: 'WIP' }],
  },
];

for (const p of posts) {
  const existing = await pb
    .collection('posts')
    .getFirstListItem(`slug = "${p.slug}"`)
    .catch(() => null);
  const data = { slug: p.slug, date: p.date, status: p.status, tags: p.tags };
  const rec = existing
    ? await pb.collection('posts').update(existing.id, data)
    : await pb.collection('posts').create(data);
  for (const t of p.tr) {
    const tr = await pb
      .collection('post_translations')
      .getFirstListItem(`post = "${rec.id}" && lang = "${t.lang}"`)
      .catch(() => null);
    if (tr) await pb.collection('post_translations').update(tr.id, t);
    else await pb.collection('post_translations').create({ post: rec.id, ...t });
  }
}

const projects = [
  {
    slug: 'lumen',
    name: 'Lumen',
    year: 2026,
    category: 'Design System',
    stack: ['TypeScript', 'Astro'],
    metric_value: 48,
    sort: 1,
    blurb: 'A themeable component library.',
    metric_label: 'components',
  },
  {
    slug: 'tarh',
    name: 'Tarh',
    year: 2026,
    category: 'Web App',
    stack: ['PocketBase', 'Svelte'],
    metric_value: 1200,
    sort: 2,
    blurb: 'A self-hosted kanban for tiny teams.',
    metric_label: 'stars',
  },
];
for (const { blurb, metric_label, ...p } of projects) {
  const existing = await pb
    .collection('projects')
    .getFirstListItem(`slug = "${p.slug}"`)
    .catch(() => null);
  const data = { ...p, status: 'published' };
  const rec = existing
    ? await pb.collection('projects').update(existing.id, data)
    : await pb.collection('projects').create(data);
  const tr = await pb
    .collection('project_translations')
    .getFirstListItem(`project = "${rec.id}" && lang = "en"`)
    .catch(() => null);
  const trData = { lang: 'en', blurb, metric_label };
  if (tr) await pb.collection('project_translations').update(tr.id, trData);
  else await pb.collection('project_translations').create({ project: rec.id, ...trData });
}
console.log('seeded: %d posts, %d projects', posts.length, projects.length);
