import { describe, expect, it } from 'vitest';
import { getPost, listPosts } from '../../src/lib/posts';
import { anonClient, pbIsUp } from './helpers';

const up = await pbIsUp();

describe.skipIf(!up)('data layer against seeded PocketBase', () => {
  it('listPosts excludes the draft and includes the Persian-only post as fa', async () => {
    const posts = await listPosts({}, anonClient());
    expect(posts.map((p) => p.slug)).not.toContain('draft-post');
    expect(posts.find((p) => p.slug === 'persian-only')).toMatchObject({
      langs: ['fa'],
      titleLang: 'fa',
    });
    expect(posts.find((p) => p.slug === 'hello-bilingual')).toMatchObject({
      langs: ['en', 'fa'],
      titleLang: 'en',
    });
  });
  it('getPost returns null for the draft', async () => {
    expect(await getPost('draft-post', 'en', anonClient())).toBeNull();
  });
  it('getPost returns the Persian body for the bilingual post', async () => {
    const post = await getPost('hello-bilingual', 'fa', anonClient());
    expect(post?.lang).toBe('fa');
    expect(post?.title).toContain('وبلاگم');
  });
  it('getPost returns null for an unknown slug', async () => {
    expect(await getPost('does-not-exist', 'en', anonClient())).toBeNull();
  });
});
