import { describe, expect, it } from 'vitest';
import { getPost } from '../../src/lib/posts';
import { adminClient, anonClient, PB_TEST_URL, pbIsUp } from './helpers';

const up = await pbIsUp();

describe.skipIf(!up)('draft preview + view counter (real PocketBase rules)', () => {
  it('a draft is invisible without its token and with a wrong token', async () => {
    expect(await getPost('draft-post', 'en', anonClient())).toBeNull();
    expect(await getPost('draft-post', 'en', anonClient(), { token: 'wrong' })).toBeNull();
    expect(await getPost('draft-post', 'en', anonClient(), { token: '' })).toBeNull();
  });
  it('a draft is served with the right token and flagged as preview', async () => {
    const post = await getPost('draft-post', 'en', anonClient(), {
      token: 'dev-preview-token-0001',
    });
    expect(post).toMatchObject({ slug: 'draft-post', preview: true });
  });
  it('a token for one draft does not open another post that has no token', async () => {
    const admin = await adminClient();
    if (!admin) return;
    const rec = await admin
      .collection('posts')
      .create({ slug: 'tmp-notoken', date: '2026-01-01', status: 'draft', tags: [] });
    try {
      await admin
        .collection('post_translations')
        .create({ post: rec.id, lang: 'en', title: 'T', summary: '', body_md: 'x' });
      expect(
        await getPost('tmp-notoken', 'en', anonClient(), { token: 'dev-preview-token-0001' }),
      ).toBeNull();
      expect(await getPost('tmp-notoken', 'en', anonClient(), { token: '' })).toBeNull();
    } finally {
      await admin.collection('posts').delete(rec.id);
    }
  });
  it('fallback serves the other language and says so', async () => {
    const post = await getPost('persian-only', 'en', anonClient(), { fallback: true });
    expect(post).toMatchObject({ lang: 'fa', fellBack: true });
    expect(await getPost('persian-only', 'en', anonClient())).toBeNull();
  });
  it('anonymous POST /api/views counts published posts only, and ignores bots', async () => {
    const read = async () =>
      (await anonClient().collection('posts').getFirstListItem('slug = "english-only"'))
        .views as number;
    const before = await read();
    const human = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0';
    await fetch(`${PB_TEST_URL}/api/views/english-only`, {
      method: 'POST',
      headers: { 'user-agent': human },
    });
    expect(await read()).toBe(before + 1);
    await fetch(`${PB_TEST_URL}/api/views/english-only`, {
      method: 'POST',
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    expect(await read()).toBe(before + 1);
    const draft = await fetch(`${PB_TEST_URL}/api/views/draft-post`, {
      method: 'POST',
      headers: { 'user-agent': human },
    });
    expect(draft.status).toBe(200); // same answer as for a published post's ignored view: no information leak
    expect(((await draft.json()) as { data: { counted: boolean } }).data.counted).toBe(false);
    const admin = await adminClient();
    if (admin) {
      const d = await admin.collection('posts').getFirstListItem('slug = "draft-post"');
      expect(d.views ?? 0).toBe(0);
    }
  });
  it('views cannot be written by anonymous clients through the collection API', async () => {
    const admin = await adminClient();
    if (!admin) return;
    const rec = await admin.collection('posts').getFirstListItem('slug = "english-only"');
    await expect(
      anonClient().collection('posts').update(rec.id, { views: 99999 }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
