import { useCallback, useEffect, useRef, useState } from 'react';
import {
  errText,
  fileUrl,
  fromLocalInput,
  pb,
  type Rec,
  randomToken,
  SLUG,
  slugify,
  toLocalInput,
} from './api';
import MarkdownEditor from './MarkdownEditor';
import { Confirm, Field, useToast } from './ui';

type Lang = 'en' | 'fa';
interface Tr {
  id?: string;
  title: string;
  summary: string;
  body_md: string;
}
const EMPTY: Tr = { title: '', summary: '', body_md: '' };

export default function PostEdit({ id }: { id: string | null }) {
  const toast = useToast();
  const [post, setPost] = useState<Rec | null>(null);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [date, setDate] = useState(toLocalInput(new Date().toISOString().replace('T', ' ')));
  const [tags, setTags] = useState('');
  const [token, setToken] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [cover, setCover] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [trs, setTrs] = useState<Record<Lang, Tr>>({ en: { ...EMPTY }, fa: { ...EMPTY } });
  const [orig, setOrig] = useState<Record<Lang, Tr>>({ en: { ...EMPTY }, fa: { ...EMPTY } });
  const [lang, setLang] = useState<Lang>('en');
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const postId = post?.id ?? id ?? undefined;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await pb.collection('posts').getOne(id);
      const list = await pb
        .collection('post_translations')
        .getFullList({ filter: pb.filter('post = {:id}', { id }) });
      const next: Record<Lang, Tr> = { en: { ...EMPTY }, fa: { ...EMPTY } };
      for (const t of list)
        next[t.lang as Lang] = { id: t.id, title: t.title, summary: t.summary, body_md: t.body_md };
      setPost(p);
      setSlug(p.slug);
      setSlugTouched(true);
      setStatus(p.status);
      setDate(toLocalInput(p.date));
      setTags((p.tags ?? []).join(', '));
      setToken(p.preview_token ?? '');
      setImages(p.images ?? []);
      setCover(p.cover ?? '');
      setTrs(next);
      setOrig(structuredClone(next));
      setLang(next.en.title || !next.fa.title ? 'en' : 'fa');
      setDirty(false);
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
    pb.collection('posts')
      .getFullList({ fields: 'tags' })
      .then((r) => setAllTags([...new Set(r.flatMap((x) => (x.tags as string[]) ?? []))].sort()))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener('beforeunload', h);
    return () => removeEventListener('beforeunload', h);
  }, [dirty]);

  const setTr = (l: Lang, patch: Partial<Tr>) => {
    setTrs((s) => ({ ...s, [l]: { ...s[l], ...patch } }));
    setDirty(true);
    if (l === 'en' && patch.title !== undefined && !slugTouched && !id)
      setSlug(slugify(patch.title));
  };
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDirty(true);
    };

  const tagList = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const save = useCallback(
    async (nextStatus?: 'draft' | 'published') => {
      if (saving) return;
      if (!SLUG.test(slug)) return toast('Slug: lowercase letters, numbers and dashes only', 'err');
      if (!trs.en.title.trim() && !trs.fa.title.trim())
        return toast('Write a title in at least one language', 'err');
      setSaving(true);
      try {
        const st = nextStatus ?? status;
        const data: Record<string, unknown> = {
          slug,
          status: st,
          date: fromLocalInput(date),
          tags: tagList,
          preview_token: token,
        };
        let saved: Rec;
        if (coverFile) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(data))
            fd.append(k, k === 'tags' ? JSON.stringify(v) : String(v));
          fd.append('cover', coverFile);
          saved = post
            ? await pb.collection('posts').update(post.id, fd)
            : await pb.collection('posts').create(fd);
        } else {
          saved = post
            ? await pb.collection('posts').update(post.id, data)
            : await pb.collection('posts').create(data);
        }
        for (const l of ['en', 'fa'] as Lang[]) {
          const t = trs[l];
          if (!t.title.trim()) continue; // a language without a title does not exist
          const body = {
            post: saved.id,
            lang: l,
            title: t.title.trim(),
            summary: t.summary,
            body_md: t.body_md,
          };
          if (t.id) await pb.collection('post_translations').update(t.id, body);
          else await pb.collection('post_translations').create(body);
        }
        setCoverFile(null);
        toast(st === 'published' ? 'Saved and published' : 'Saved');
        if (!post) {
          location.hash = `#/posts/${saved.id}`;
        } else {
          await load();
        }
      } catch (e) {
        toast(errText(e), 'err');
      } finally {
        setSaving(false);
      }
    },
    [saving, slug, trs, status, date, tagList, token, coverFile, post, toast, load],
  );

  const saveRef = useRef(save);
  saveRef.current = save;

  const upload = post
    ? async (files: File[]): Promise<string[]> => {
        const before = new Set(images);
        const fd = new FormData();
        for (const f of files) fd.append('images+', f);
        try {
          const rec = await pb.collection('posts').update(post.id, fd);
          setImages(rec.images);
          toast(`Uploaded ${files.length} image${files.length > 1 ? 's' : ''}`);
          return (rec.images as string[]).filter((n) => !before.has(n));
        } catch (e) {
          toast(errText(e), 'err');
          return [];
        }
      }
    : undefined;

  const removeImage = async (name: string) => {
    if (!post) return;
    try {
      const rec = await pb.collection('posts').update(post.id, { 'images-': [name] });
      setImages(rec.images);
    } catch (e) {
      toast(errText(e), 'err');
    }
  };

  const removeTranslation = async (l: Lang) => {
    const t = trs[l];
    if (t.id)
      await pb
        .collection('post_translations')
        .delete(t.id)
        .catch((e) => toast(errText(e), 'err'));
    setTrs((s) => ({ ...s, [l]: { ...EMPTY } }));
    toast(`${l.toUpperCase()} translation removed`);
  };

  const remove = async () => {
    if (!post) return;
    try {
      await pb.collection('posts').delete(post.id);
      toast('Post deleted');
      location.hash = '#/posts';
    } catch (e) {
      toast(errText(e), 'err');
    }
  };

  if (loading) return <p className="mono muted">Loading…</p>;
  const t = trs[lang];
  const previewUrl = token && slug ? `/blog/${slug}?token=${token}` : '';
  const changed = (l: Lang) => JSON.stringify(trs[l]) !== JSON.stringify(orig[l]);

  return (
    <div className="adm-edit">
      <div className="adm-bar">
        <a className="mono muted" href="#/posts">
          ← Posts
        </a>
        <span className="grow" />
        {dirty && (
          <span className="mono" style={{ color: 'var(--acc)' }}>
            Unsaved changes
          </span>
        )}
        <button type="button" className="adm-btn" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save (Ctrl+S)'}
        </button>
        {status === 'published' ? (
          <button
            type="button"
            className="adm-btn"
            disabled={saving}
            onClick={() => void save('draft')}
          >
            Unpublish
          </button>
        ) : (
          <button
            type="button"
            className="adm-btn solid"
            disabled={saving}
            onClick={() => void save('published')}
          >
            Publish
          </button>
        )}
      </div>

      <div className="adm-grid">
        <Field label="Slug (URL)" hint="Latin letters, numbers, dashes. Same for every language.">
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              touch(setSlug)(e.target.value.toLowerCase());
            }}
            dir="ltr"
          />
        </Field>
        <Field label="Publish date">
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => touch(setDate)(e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => touch(setStatus)(e.target.value as 'draft' | 'published')}
          >
            <option value="draft">Draft (hidden)</option>
            <option value="published">Published</option>
          </select>
        </Field>
        <Field label="Tags (comma separated)">
          <input
            value={tags}
            onChange={(e) => touch(setTags)(e.target.value)}
            list="all-tags"
            dir="ltr"
          />
          <datalist id="all-tags">
            {allTags.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <Field label="Cover image (optional)">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setCoverFile(e.target.files?.[0] ?? null);
              setDirty(true);
            }}
          />
          {cover && post && (
            <img className="adm-thumb" src={fileUrl('posts', post.id, cover, '480x0')} alt="" />
          )}
        </Field>
        <Field
          label="Draft preview link"
          hint={
            status === 'published'
              ? 'Only needed for drafts.'
              : 'Anyone with this link can read the draft.'
          }
        >
          <div className="row-inline">
            <button
              type="button"
              className="adm-btn"
              onClick={() => touch(setToken)(randomToken())}
            >
              {token ? 'Regenerate' : 'Generate'}
            </button>
            {token && (
              <button
                type="button"
                className="adm-btn"
                onClick={() => {
                  void navigator.clipboard.writeText(location.origin + previewUrl);
                  toast('Link copied');
                }}
              >
                Copy
              </button>
            )}
            {token && post && (
              <a className="adm-btn" href={previewUrl} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            )}
          </div>
        </Field>
      </div>

      <div className="adm-langtabs" role="tablist">
        {(['en', 'fa'] as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={lang === l}
            className={lang === l ? 'on' : ''}
            onClick={() => setLang(l)}
          >
            {l === 'en' ? 'English' : 'فارسی'} {trs[l].title ? '●' : '○'}
            {changed(l) ? ' *' : ''}
          </button>
        ))}
        <span className="grow" />
        {(trs[lang].id || trs[lang].title) && (
          <Confirm
            message={`Remove the ${lang.toUpperCase()} translation?`}
            onYes={() => void removeTranslation(lang)}
          />
        )}
      </div>

      <div className="adm-grid two">
        <Field label={`Title (${lang.toUpperCase()})`}>
          <input
            className="adm-title"
            value={t.title}
            onChange={(e) => setTr(lang, { title: e.target.value })}
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
            lang={lang}
            placeholder={lang === 'fa' ? 'عنوان' : 'Title'}
          />
        </Field>
        <Field
          label={`Summary (${lang.toUpperCase()})`}
          hint="Shown in lists, search results and link previews."
        >
          <textarea
            rows={2}
            maxLength={1000}
            value={t.summary}
            onChange={(e) => setTr(lang, { summary: e.target.value })}
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
            lang={lang}
          />
        </Field>
      </div>

      <MarkdownEditor
        key={`${postId ?? 'new'}-${lang}`}
        value={t.body_md}
        onChange={(v) => setTr(lang, { body_md: v })}
        dir={lang === 'fa' ? 'rtl' : 'ltr'}
        lang={lang}
        postId={postId}
        onUpload={upload}
        uploadHint="Save the post once to enable image uploads"
        onSave={() => void saveRef.current()}
      />

      <section className="adm-images">
        <h3 className="mono muted">Images {post ? `(${images.length})` : ''}</h3>
        {!post && (
          <p className="muted">
            Save the post once to enable image uploads. You can also paste or drop images straight
            into the editor.
          </p>
        )}
        <div className="adm-imgs">
          {post &&
            images.map((n) => (
              <figure key={n}>
                <img
                  src={fileUrl('posts', post.id, n, n.endsWith('.svg') ? undefined : '480x0')}
                  alt=""
                  loading="lazy"
                />
                <figcaption className="mono">{n}</figcaption>
                <div className="row-inline">
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={() => {
                      void navigator.clipboard.writeText(`![](img:${n})`);
                      toast('Markdown copied');
                    }}
                  >
                    Copy markdown
                  </button>
                  <button
                    type="button"
                    className="adm-btn danger"
                    onClick={() => {
                      if (confirm('Remove this image? Posts that use it will show a broken image.'))
                        void removeImage(n);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </figure>
            ))}
        </div>
      </section>

      {post && (
        <section className="adm-danger">
          <span className="mono muted">
            {post.views ?? 0} views · {post.likes ?? 0} likes
          </span>
          <Confirm
            message="Delete this post, all its translations, comments, likes and bookmarks? This cannot be undone."
            onYes={() => void remove()}
          />
        </section>
      )}
    </div>
  );
}
