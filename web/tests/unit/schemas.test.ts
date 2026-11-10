import { describe, expect, it } from 'vitest';
import { PostRecordSchema, PostTranslationRecordSchema } from '../../src/lib/schemas';

const post = {
  id: 'p1',
  slug: 'hello-world',
  cover: '',
  date: '2026-11-02 00:00:00.000Z',
  status: 'published',
  tags: ['Web'],
  images: [],
};
const tr = { id: 't1', post: 'p1', lang: 'en', title: 'Hi', summary: 's', body_md: '# hi' };

describe('PostRecordSchema', () => {
  it('accepts a published post', () => {
    expect(PostRecordSchema.parse(post).status).toBe('published');
  });
  it('rejects a slug with spaces or capitals, naming the field', () => {
    expect(() => PostRecordSchema.parse({ ...post, slug: 'Bad Slug' })).toThrow(/slug/);
  });
  it('rejects an unknown status, naming the field', () => {
    expect(() => PostRecordSchema.parse({ ...post, status: 'archived' })).toThrow(/status/);
  });
  it('rejects a missing field, naming it', () => {
    const { date: _d, ...rest } = post;
    expect(() => PostRecordSchema.parse(rest)).toThrow(/date/);
  });
});

describe('PostTranslationRecordSchema', () => {
  it('accepts en and fa', () => {
    expect(PostTranslationRecordSchema.parse(tr).lang).toBe('en');
    expect(PostTranslationRecordSchema.parse({ ...tr, lang: 'fa' }).lang).toBe('fa');
  });
  it('rejects an unknown language, naming the field', () => {
    expect(() => PostTranslationRecordSchema.parse({ ...tr, lang: 'de' })).toThrow(/lang/);
  });
});
