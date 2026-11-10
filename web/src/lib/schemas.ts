import { z } from 'zod';

export const LangSchema = z.enum(['en', 'fa']);
export type Lang = z.infer<typeof LangSchema>;

export const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid slug');
export const StatusSchema = z.enum(['draft', 'published']);

/** A row of the `posts` collection as PocketBase returns it. */
export const PostRecordSchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  cover: z.string(),
  date: z.string(),
  status: StatusSchema,
  tags: z.array(z.string()),
  images: z.array(z.string()),
});
export type PostRecord = z.infer<typeof PostRecordSchema>;

/** A row of the `post_translations` collection. */
export const PostTranslationRecordSchema = z.object({
  id: z.string(),
  post: z.string(),
  lang: LangSchema,
  title: z.string(),
  summary: z.string(),
  body_md: z.string(),
});
export type PostTranslationRecord = z.infer<typeof PostTranslationRecordSchema>;

/** Translation row without the (potentially huge) body — what list queries fetch. */
export const PostTranslationListSchema = PostTranslationRecordSchema.omit({ body_md: true });
export type PostTranslationListItem = z.infer<typeof PostTranslationListSchema>;

export type PostSummary = {
  slug: string;
  date: string;
  tags: string[];
  /** Languages this post exists in, in display-priority order (en before fa). */
  langs: Lang[];
  /** Language of `title`/`summary`: the primary (first) existing translation. */
  titleLang: Lang;
  title: string;
  summary: string;
  cover: string | null;
};

export type Post = PostSummary & {
  /** The language of `bodyMd` (the one that was requested). */
  lang: Lang;
  bodyMd: string;
  images: string[];
};
