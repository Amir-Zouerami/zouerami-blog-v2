import { useCallback, useEffect, useRef, useState } from 'react';
import { errText, fileUrl, pb, type Rec, randomToken, SLUG, slugify } from '../api';
import DateTimePicker from '../DateTimePicker';
import { fromPocketBase, toPocketBase } from '../date';
import ImageLibrary from '../ImageLibrary';
import LangTabs, { type Lang, langDir } from '../LangTabs';
import MarkdownEditor from '../MarkdownEditor';
import { Confirm, Field, useToast } from '../ui';
import { useDraft } from '../useDraft';

interface Tr {
  id?: string;
  title: string;
  summary: string;
  body_md: string;
}
const EMPTY: Tr = { title: '', summary: '', body_md: '' };

interface Form {
  slug: string;
  tags: string;
  date: string;
  trs: Record<Lang, Tr>;
}
/** What gets backed up locally: everything the writer typed (translation ids are server details). */
const snapshotOf = (f: Form) => ({
  slug: f.slug,
  tags: f.tags,
  date: f.date,
  trs: {
    en: { title: f.trs.en.title, summary: f.trs.en.summary, body_md: f.trs.en.body_md },
    fa: { title: f.trs.fa.title, summary: f.trs.fa.summary, body_md: f.trs.fa.body_md },
  },
});
const blank = (): Form => ({
  slug: '',
  tags: '',
  date: fromPocketBase(new Date().toISOString().replace('T', ' ')),
  trs: { en: { ...EMPTY }, fa: { ...EMPTY } },
});

export default function PostEdit({ id }: { id: string | null }) {
  const toast = useToast();
  const [post, setPost] = useState<Rec | null>(null);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [date, setDate] = useState(fromPocketBase(new Date().toISOString().replace('T', ' ')));
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
  const [baseline, setBaseline] = useState<string | null>(null);
  const postId = post?.id ?? id ?? undefined;

  const load = useCallback(async () => {
    if (!id) {
      setBaseline(JSON.stringify(snapshotOf(blank())));
      return;
    }
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
      setDate(fromPocketBase(p.date));
      setTags((p.tags ?? []).join(', '));
      setToken(p.preview_token ?? '');
      setImages(p.images ?? []);
      setCover(p.cover ?? '');
      setTrs(next);
      setOrig(structuredClone(next));
      setLang(next.en.title || !next.fa.title ? 'en' : 'fa');
      setDirty(false);
      setBaseline(
        JSON.stringify(
          snapshotOf({
            slug: p.slug,
            tags: (p.tags ?? []).join(', '),
            date: fromPocketBase(p.date),
            trs: next,
          }),
        ),
      );
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

  const draft = useDraft(`post:${post?.id ?? id ?? 'new'}`, snapshotOf({ slug, tags, date, trs }), {
    baseline,
    enabled: dirty,
  });
  const restoreDraft = () => {
    const d = draft.take();
    if (!d) return;
    setSlug(d.slug);
    setTags(d.tags);
    setDate(d.date);
    setTrs((s) => ({
      en: { ...s.en, ...d.trs.en },
      fa: { ...s.fa, ...d.trs.fa },
    }));
    setDirty(true);
    toast('Unsaved draft restored');
  };

  const save = useCallback(
    async (nextStatus?: 'draft' | 'published') => {
      if (saving) return;
      if (!SLUG.test(slug)) return toast('Slug: lowercase letters, numbers and dashes only', 'err');
      if (!trs.en.title.trim() && !trs.fa.title.trim())
        return toast('Write a title in at least one language', 'err');
      // never silently drop writing: a language with text but no title cannot be saved
      for (const l of ['en', 'fa'] as Lang[]) {
        const t = trs[l];
        if (!t.title.trim() && (t.summary.trim() || t.body_md.trim())) {
          setLang(l);
          return toast(
            `${l === 'fa' ? 'Persian' : 'English'} needs a title before it can be saved. Nothing was submitted and your text is untouched.`,
            'err',
          );
        }
      }
      setSaving(true);
      try {
        const st = nextStatus ?? status;
        const data: Record<string, unknown> = {
          slug,
          status: st,
          date: toPocketBase(date),
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
        const nextTrs = { ...trs };
        for (const l of ['en', 'fa'] as Lang[]) {
          const t = trs[l];
          if (!t.title.trim()) continue; // a language without a title does not exist (validated above)
          const body = {
            post: saved.id,
            lang: l,
            title: t.title.trim(),
            summary: t.summary,
            body_md: t.body_md,
          };
          const rec = t.id
            ? await pb.collection('post_translations').update(t.id, body)
            : await pb.collection('post_translations').create(body);
          nextTrs[l] = { ...t, id: rec.id };
        }
        // update in place: no reload, so the cursor, scroll position and language tab stay put
        setPost(saved);
        setStatus(saved.status);
        setImages(saved.images ?? images);
        setCover(saved.cover ?? '');
        setToken(saved.preview_token ?? '');
        setTrs(nextTrs);
        setOrig(structuredClone(nextTrs));
        setCoverFile(null);
        setDirty(false);
        draft.clear();
        setBaseline(JSON.stringify(snapshotOf({ slug, tags, date, trs: nextTrs })));
        toast(st === 'published' ? 'Saved and published' : 'Saved');
        if (!post) history.replaceState(null, '', `#/posts/${saved.id}`);
      } catch (e) {
        toast(errText(e), 'err');
      } finally {
        setSaving(false);
      }
    },
    [saving, slug, trs, status, date, tagList, tags, token, coverFile, post, images, toast, draft],
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

  /** The preview link only works once the token is stored, so save it right away for an existing post. */
  const generateToken = async () => {
    const next = randomToken();
    setToken(next);
    if (!post) return setDirty(true);
    try {
      await pb.collection('posts').update(post.id, { preview_token: next });
      toast('Preview link saved');
    } catch (e) {
      toast(errText(e), 'err');
    }
  };

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
        {dirty && id && (
          <button
            type="button"
            className="adm-btn"
            disabled={saving}
            data-discard
            onClick={() => {
              if (!confirm('Discard all unsaved changes and go back to the last saved version?'))
                return;
              draft.clear();
              void load();
            }}
          >
            Discard changes
          </button>
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

      {draft.recoverable && (
        <div className="adm-status draft" role="alert">
          <strong>Unsaved writing found</strong>
          <span>
            A copy from{' '}
            {new Date(draft.recoverable.at).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            was kept in this browser.
          </span>
          <button type="button" className="adm-btn solid" onClick={restoreDraft}>
            Restore it
          </button>
          <button type="button" className="adm-btn" onClick={draft.discard}>
            Discard
          </button>
        </div>
      )}

      <div className={`adm-status ${post ? post.status : 'draft'}`} role="status">
        {post?.status === 'published' ? (
          <>
            <strong>● Published</strong>
            <span>
              Live to everyone at{' '}
              <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                /blog/{post.slug}
              </a>
            </span>
          </>
        ) : (
          <>
            <strong>○ Draft</strong>
            <span>
              Hidden from the public
              {token
                ? '; only the preview link below works.'
                : '. Generate a preview link to share it.'}
            </span>
          </>
        )}
        {dirty && <span className="mono">Unsaved changes: press Save to apply them.</span>}
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
        <Field
          group
          label="Publish date"
          hint="Shown on the post and used for ordering. A future date does not delay publishing."
        >
          <DateTimePicker label="Publish date" withTime value={date} onChange={touch(setDate)} />
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
          group
          label="Draft preview link"
          hint={
            status === 'published'
              ? 'Only needed for drafts.'
              : 'Anyone with this link can read the draft.'
          }
        >
          <div className="row-inline">
            <button type="button" className="adm-btn" onClick={() => void generateToken()}>
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

      <LangTabs
        active={lang}
        onChange={setLang}
        state={(l) => ({ filled: !!trs[l].title, changed: changed(l) })}
      >
        {(trs[lang].id || trs[lang].title) && (
          <Confirm
            message={`Remove the ${lang.toUpperCase()} translation?`}
            onYes={() => void removeTranslation(lang)}
          />
        )}
      </LangTabs>

      <div className="adm-grid two">
        <Field label={`Title (${lang.toUpperCase()})`}>
          <input
            className="adm-title"
            value={t.title}
            onChange={(e) => setTr(lang, { title: e.target.value })}
            dir={langDir(lang)}
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
            dir={langDir(lang)}
            lang={lang}
          />
        </Field>
      </div>

      <MarkdownEditor
        key={lang}
        value={t.body_md}
        onChange={(v) => setTr(lang, { body_md: v })}
        dir={langDir(lang)}
        lang={lang}
        postId={postId}
        onUpload={upload}
        uploadHint="Save the post once to enable image uploads"
        onSave={() => void saveRef.current()}
      />

      <ImageLibrary
        postId={post?.id ?? null}
        images={images}
        onRemove={(n) => void removeImage(n)}
      />

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
