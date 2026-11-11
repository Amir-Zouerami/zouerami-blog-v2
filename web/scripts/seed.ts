/** Idempotent sample data for local development. Run: `bun run seed` (needs PB_SUPERUSER_* in ../.env). */
import PocketBase from 'pocketbase';
import { posts, projectBody, projects, SIGNAL_ART_SVG } from './seed-data';

const url = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090';
const email = process.env.PB_SUPERUSER_EMAIL;
const password = process.env.PB_SUPERUSER_PASSWORD;
if (!email || !password) throw new Error('PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD are required');

const pb = new PocketBase(url);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(email, password);

for (const p of posts) {
  const existing = await pb
    .collection('posts')
    .getFirstListItem(`slug = "${p.slug}"`)
    .catch(() => null);
  const data = {
    slug: p.slug,
    date: p.date,
    status: p.status,
    tags: p.tags,
    preview_token: p.preview_token ?? '',
  };
  let rec = existing
    ? await pb.collection('posts').update(existing.id, data)
    : await pb.collection('posts').create(data);

  // Demo image for the first post: PocketBase renames uploads, so resolve the stored filename.
  let imageName = '';
  if (p.slug === 'hello-bilingual') {
    if (!rec.images?.length) {
      const form = new FormData();
      form.append(
        'images',
        new Blob([SIGNAL_ART_SVG], { type: 'image/svg+xml' }),
        'signal-art.svg',
      );
      rec = await pb.collection('posts').update(rec.id, form);
    }
    imageName = rec.images[0] ?? '';
  }

  for (const t of p.tr) {
    const body = imageName
      ? t.body_md.replace('img:signal-art.svg', `img:${imageName}`)
      : t.body_md;
    const trData = { ...t, body_md: body };
    const tr = await pb
      .collection('post_translations')
      .getFirstListItem(`post = "${rec.id}" && lang = "${t.lang}"`)
      .catch(() => null);
    if (tr) await pb.collection('post_translations').update(tr.id, trData);
    else await pb.collection('post_translations').create({ post: rec.id, ...trData });
  }
}

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
  const trData = { lang: 'en', blurb, metric_label, body_md: projectBody(p.name) };
  if (tr) await pb.collection('project_translations').update(tr.id, trData);
  else await pb.collection('project_translations').create({ project: rec.id, ...trData });
}
console.log('seeded: %d posts, %d projects', posts.length, projects.length);
