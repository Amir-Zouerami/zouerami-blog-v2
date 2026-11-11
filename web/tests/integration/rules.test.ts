import { describe, expect, it } from 'vitest';
import { adminClient, anonClient, pbIsUp } from './helpers';

const up = await pbIsUp();

describe.skipIf(!up)('PocketBase public access rules (seeded data)', () => {
  it('lists only published posts to anonymous callers', async () => {
    const posts = await anonClient().collection('posts').getFullList();
    expect(posts.length).toBeGreaterThanOrEqual(3);
    expect(posts.every((p) => p.status === 'published')).toBe(true);
  });

  it('hides a draft from direct lookup by id', async () => {
    const admin = await adminClient();
    if (!admin) return; // needs PB_SUPERUSER_* to find the draft's id
    const draft = await admin.collection('posts').getFirstListItem('status = "draft"');
    await expect(anonClient().collection('posts').getOne(draft.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects anonymous writes', async () => {
    await expect(
      anonClient()
        .collection('posts')
        .create({ slug: 'nope', date: '2026-01-01', status: 'published' }),
    ).rejects.toSatisfy((e: { status: number }) => [400, 403].includes(e.status));
  });

  it('exposes exactly one (fa) translation for the Persian-only post', async () => {
    const trs = await anonClient()
      .collection('post_translations')
      .getFullList({ filter: 'post.slug = "persian-only"' });
    expect(trs.map((t) => t.lang)).toEqual(['fa']);
  });

  it('hides translations of draft posts', async () => {
    const trs = await anonClient()
      .collection('post_translations')
      .getFullList({ filter: 'post.slug = "draft-post"' });
    expect(trs).toEqual([]);
  });
});
