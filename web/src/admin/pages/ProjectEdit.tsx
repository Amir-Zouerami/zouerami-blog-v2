import { useCallback, useEffect, useRef, useState } from 'react';
import { METRIC_ICONS } from '../../lib/metricIcons';
import { Button } from '../../ui/Button';
import { FilePicker } from '../../ui/FilePicker';
import { Select } from '../../ui/Select';
import { errText, fileUrl, pb, type Rec, randomToken, SLUG, slugify } from '../api';
import ImageLibrary from '../ImageLibrary';
import LangTabs, { type Lang, langDir } from '../LangTabs';
import MarkdownEditor from '../MarkdownEditor';
import TagPicker from '../TagPicker';
import { Confirm, Field, useSaveShortcut, useToast } from '../ui';
import { useDraft } from '../useDraft';

interface Tr {
  id?: string;
  blurb: string;
  metric_label: string;
  body_md: string;
}
const EMPTY: Tr = { blurb: '', metric_label: '', body_md: '' };
const CATEGORIES = ['Web App', 'Design System', 'Tool', 'Open Source'];
const LANGS: Lang[] = ['en', 'fa'];
const NAME: Record<Lang, string> = { en: 'English', fa: 'Persian' };

interface Form {
  name: string;
  slug: string;
  year: string;
  category: string;
  /** comma separated, like a post's tags */
  stack: string;
  link_live: string;
  link_repo: string;
  /** the big number on the project page; empty = none */
  metric: string;
  metricIcon: string;
}
const blank = (): Form => ({
  name: '',
  slug: '',
  year: String(new Date().getFullYear()),
  category: CATEGORIES[0] as string,
  stack: '',
  link_live: '',
  link_repo: '',
  metric: '',
  metricIcon: '',
});
const formOf = (p: Rec): Form => ({
  name: p.name,
  slug: p.slug,
  year: String(p.year),
  category: p.category,
  stack: (p.stack ?? []).join(', '),
  link_live: p.link_live ?? '',
  link_repo: p.link_repo ?? '',
  metric: p.metric_value ? String(p.metric_value) : '',
  metricIcon: p.metric_icon ?? '',
});
const emptyTrs = (): Record<Lang, Tr> => ({ en: { ...EMPTY }, fa: { ...EMPTY } });
/** What the writer typed: backed up locally and compared against the saved version. */
const snapshotOf = (f: Form, t: Record<Lang, Tr>) => ({
  f,
  trs: {
    en: { blurb: t.en.blurb, metric_label: t.en.metric_label, body_md: t.en.body_md },
    fa: { blurb: t.fa.blurb, metric_label: t.fa.metric_label, body_md: t.fa.body_md },
  },
});
const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export default function ProjectEdit({ id }: { id: string | null }) {
  const toast = useToast();
  const [rec, setRec] = useState<Rec | null>(null);
  const [f, setF] = useState<Form>(blank);
  const [trs, setTrs] = useState<Record<Lang, Tr>>(emptyTrs);
  const [orig, setOrig] = useState<Record<Lang, Tr>>(emptyTrs);
  const [lang, setLang] = useState<Lang>('en');
  const [slugTouched, setSlugTouched] = useState(false);
  const [token, setToken] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [cover, setCover] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [allStack, setAllStack] = useState<string[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [baseline, setBaseline] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setBaseline(JSON.stringify(snapshotOf(blank(), emptyTrs())));
      return;
    }
    try {
      const p = await pb.collection('projects').getOne(id);
      const found = await pb
        .collection('project_translations')
        .getFullList({ filter: pb.filter('project = {:id}', { id }) });
      const next = emptyTrs();
      for (const t of found)
        next[t.lang as Lang] = {
          id: t.id,
          blurb: t.blurb,
          metric_label: t.metric_label,
          body_md: t.body_md,
        };
      setRec(p);
      setF(formOf(p));
      setSlugTouched(true);
      setToken(p.preview_token ?? '');
      setImages(p.images ?? []);
      setCover(p.cover ?? '');
      setCoverFile(null);
      setTrs(next);
      setOrig(structuredClone(next));
      setLang(next.en.blurb || !next.fa.blurb ? 'en' : 'fa');
      setDirty(false);
      setBaseline(JSON.stringify(snapshotOf(formOf(p), next)));
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
    pb.collection('projects')
      .getFullList({ fields: 'stack' })
      .then((r) => setAllStack([...new Set(r.flatMap((x) => (x.stack as string[]) ?? []))].sort()))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener('beforeunload', h);
    return () => removeEventListener('beforeunload', h);
  }, [dirty]);

  const draft = useDraft(`project:${rec?.id ?? id ?? 'new'}`, snapshotOf(f, trs), {
    baseline,
    enabled: dirty,
  });
  const restoreDraft = () => {
    const d = draft.take();
    if (!d) return;
    setF((s) => ({ ...s, ...d.f }));
    setTrs((s) => ({ en: { ...s.en, ...d.trs.en }, fa: { ...s.fa, ...d.trs.fa } }));
    setDirty(true);
    toast('Unsaved draft restored');
  };

  const set = (patch: Partial<Form>) => {
    setF((s) => {
      const next = { ...s, ...patch };
      if (patch.name !== undefined && !slugTouched && !rec) next.slug = slugify(patch.name);
      return next;
    });
    setDirty(true);
  };
  const setTr = (l: Lang, patch: Partial<Tr>) => {
    setTrs((s) => ({ ...s, [l]: { ...s[l], ...patch } }));
    setDirty(true);
  };

  const save = async (nextStatus?: 'draft' | 'published') => {
    if (saving) return;
    const status = nextStatus ?? rec?.status ?? 'draft';
    if (!f.name.trim()) return toast('Name is required', 'err');
    if (!SLUG.test(f.slug)) return toast('Slug: lowercase letters, numbers and dashes only', 'err');
    // never silently drop writing: a language exists once it has a card description
    for (const l of LANGS) {
      const t = trs[l];
      if (!t.blurb.trim() && (t.id || t.body_md.trim() || t.metric_label.trim())) {
        setLang(l);
        return toast(
          `${NAME[l]} needs a card description before it can be saved. Your text is untouched.`,
          'err',
        );
      }
    }
    if (status === 'published' && !LANGS.some((l) => trs[l].blurb.trim()))
      return toast('Write a card description before publishing, or nothing can be shown', 'err');
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        name: f.name.trim(),
        slug: f.slug,
        year: Number(f.year),
        category: f.category,
        stack: list(f.stack),
        link_live: f.link_live,
        link_repo: f.link_repo,
        metric_value: Number(f.metric) || 0,
        metric_icon: f.metricIcon,
        status,
        preview_token: token,
      };
      if (!rec) {
        // a new project goes to the end of the list (the arrows there move it)
        const last = await pb.collection('projects').getList(1, 1, { sort: '-sort' });
        data.sort = (Number(last.items[0]?.sort) || 0) + 10;
      }
      let body: Record<string, unknown> | FormData = data;
      if (coverFile) {
        body = new FormData();
        for (const [k, v] of Object.entries(data))
          body.append(k, k === 'stack' ? JSON.stringify(v) : String(v));
        body.append('cover', coverFile);
      }
      const saved: Rec = rec
        ? await pb.collection('projects').update(rec.id, body)
        : await pb.collection('projects').create(body);
      setRec(saved); // from here on this is an update, even if a translation below fails
      const nextTrs = { ...trs };
      for (const l of LANGS) {
        const t = trs[l];
        if (!t.blurb.trim()) continue;
        const tr = {
          project: saved.id,
          lang: l,
          blurb: t.blurb,
          metric_label: t.metric_label,
          body_md: t.body_md,
        };
        const done = t.id
          ? await pb.collection('project_translations').update(t.id, tr)
          : await pb.collection('project_translations').create(tr);
        nextTrs[l] = { ...t, id: done.id };
        setTrs((s) => ({ ...s, [l]: { ...s[l], id: done.id } }));
      }
      // update in place: no reload, so the cursor, scroll position and language tab stay put
      const form = formOf(saved);
      setF(form);
      setImages(saved.images ?? []);
      setCover(saved.cover ?? '');
      setCoverFile(null);
      setOrig(structuredClone(nextTrs));
      setDirty(false);
      draft.clear();
      setBaseline(JSON.stringify(snapshotOf(form, nextTrs)));
      toast(status === 'published' ? 'Saved and published' : 'Saved');
      if (!rec) history.replaceState(null, '', `#/projects/${saved.id}`);
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setSaving(false);
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useSaveShortcut(() => void saveRef.current());

  const upload = rec
    ? async (files: File[]): Promise<string[]> => {
        const before = new Set(images);
        const fd = new FormData();
        for (const file of files) fd.append('images+', file);
        try {
          const done = await pb.collection('projects').update(rec.id, fd);
          setImages(done.images);
          toast(`Uploaded ${files.length} image${files.length > 1 ? 's' : ''}`);
          return (done.images as string[]).filter((n) => !before.has(n));
        } catch (e) {
          toast(errText(e), 'err');
          return [];
        }
      }
    : undefined;

  /** Changes to the stored record that apply at once (like the preview link and removing files). */
  const apply = async (patch: Record<string, unknown>, done?: string) => {
    if (!rec) return;
    try {
      const next = await pb.collection('projects').update(rec.id, patch);
      setImages(next.images ?? []);
      setCover(next.cover ?? '');
      if (done) toast(done);
    } catch (e) {
      toast(errText(e), 'err');
    }
  };

  const generateToken = async () => {
    const next = randomToken();
    setToken(next);
    if (!rec) return setDirty(true);
    await apply({ preview_token: next }, 'Preview link saved');
  };

  const removeTranslation = async (l: Lang) => {
    const t = trs[l];
    if (t.id)
      await pb
        .collection('project_translations')
        .delete(t.id)
        .catch((e) => toast(errText(e), 'err'));
    setTrs((s) => ({ ...s, [l]: { ...EMPTY } }));
    setOrig((s) => ({ ...s, [l]: { ...EMPTY } }));
    toast(`${l.toUpperCase()} translation removed`);
  };

  if (loading) return <p className="mono muted">Loading…</p>;
  const t = trs[lang];
  const published = rec?.status === 'published';
  // the saved slug: that is the address the site knows
  const previewUrl = token && rec ? `/work/${rec.slug}?token=${token}` : '';
  const chosen = list(f.stack);
  // the word after the last comma narrows the chips, unless it is already a complete existing entry
  const lastWord = f.stack.slice(f.stack.lastIndexOf(',') + 1).trim();
  const changed = (l: Lang) => JSON.stringify(trs[l]) !== JSON.stringify(orig[l]);

  return (
    <div className="adm-edit">
      <div className="adm-bar">
        <a className="mono muted" href="#/projects">
          ← Projects
        </a>
        <span className="grow" />
        {dirty && (
          <span className="mono" style={{ color: 'var(--acc)' }}>
            Unsaved changes
          </span>
        )}
        {dirty && id && (
          <Button
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
          </Button>
        )}
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save (Ctrl+S)'}
        </Button>
        {published ? (
          <Button disabled={saving} onClick={() => void save('draft')}>
            Unpublish
          </Button>
        ) : (
          <Button variant="solid" disabled={saving} onClick={() => void save('published')}>
            Publish
          </Button>
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
          <Button variant="solid" onClick={restoreDraft}>
            Restore it
          </Button>
          <Button onClick={draft.discard}>Discard</Button>
        </div>
      )}

      <div className={`adm-status ${published ? 'published' : 'draft'}`} role="status">
        {rec && published ? (
          <>
            <strong>● Published</strong>
            <span>
              Live to everyone at{' '}
              <a href={`/work/${rec.slug}`} target="_blank" rel="noopener noreferrer">
                /work/{rec.slug}
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
                : '. Generate a preview link to see it.'}
            </span>
          </>
        )}
        {dirty && <span className="mono">Unsaved changes: press Save to apply them.</span>}
      </div>

      <div className="adm-grid">
        <Field label="Name">
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Slug (URL)" hint="Latin letters, numbers, dashes. The address is /work/slug.">
          <input
            value={f.slug}
            dir="ltr"
            onChange={(e) => {
              setSlugTouched(true);
              set({ slug: e.target.value.toLowerCase() });
            }}
          />
        </Field>
        <Field label="Type" hint="Used by the filter tabs on the Work page.">
          <Select value={f.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Year">
          <input type="number" value={f.year} onChange={(e) => set({ year: e.target.value })} />
        </Field>
        <Field label="Technologies (comma separated)">
          <input value={f.stack} dir="ltr" onChange={(e) => set({ stack: e.target.value })} />
          <TagPicker
            all={allStack}
            selected={chosen}
            typing={allStack.includes(lastWord) ? '' : lastWord}
            noun="technology"
            plural="technologies"
            onToggle={(x) =>
              set({
                stack: (chosen.includes(x) ? chosen.filter((c) => c !== x) : [...chosen, x]).join(
                  ', ',
                ),
              })
            }
          />
        </Field>
        <Field label="Live site (optional)">
          <input
            type="url"
            dir="ltr"
            placeholder="https://"
            value={f.link_live}
            onChange={(e) => set({ link_live: e.target.value })}
          />
        </Field>
        <Field label="Source code (optional)">
          <input
            type="url"
            dir="ltr"
            placeholder="https://"
            value={f.link_repo}
            onChange={(e) => set({ link_repo: e.target.value })}
          />
        </Field>
        <Field
          group
          label="Cover image (optional)"
          hint="Without one, the site draws its own artwork."
        >
          <FilePicker
            accept="image/*"
            onChange={(file) => {
              setCoverFile(file);
              setDirty(true);
            }}
          />
          {cover && rec && (
            <>
              <img className="adm-thumb" src={fileUrl('projects', rec.id, cover, '480x0')} alt="" />
              <Button onClick={() => void apply({ cover: null }, 'Cover removed')}>
                Remove cover
              </Button>
            </>
          )}
        </Field>
        <Field
          group
          label="Draft preview link"
          hint={
            published
              ? 'Only needed for drafts.'
              : 'Shows the last saved version, once it has a card description. Anyone with the link can read it.'
          }
        >
          <div className="row-inline">
            <Button onClick={() => void generateToken()}>
              {token ? 'Regenerate' : 'Generate'}
            </Button>
            {previewUrl && (
              <>
                <Button
                  onClick={() => {
                    void navigator.clipboard.writeText(location.origin + previewUrl);
                    toast('Link copied');
                  }}
                >
                  Copy
                </Button>
                <Button href={previewUrl} target="_blank" rel="noopener noreferrer">
                  Open
                </Button>
              </>
            )}
          </div>
        </Field>
      </div>

      <LangTabs
        active={lang}
        onChange={setLang}
        state={(l) => ({ filled: !!trs[l].blurb, changed: changed(l) })}
      >
        {(t.id || t.blurb || t.body_md) && (
          <Confirm
            message={`Remove the ${lang.toUpperCase()} translation?`}
            onYes={() => void removeTranslation(lang)}
          />
        )}
      </LangTabs>

      <Field
        label={`Card description (${lang.toUpperCase()})`}
        hint="One or two sentences. Shown on the project's card, in search results and link previews."
      >
        <textarea
          rows={2}
          maxLength={1000}
          value={t.blurb}
          dir={langDir(lang)}
          lang={lang}
          spellCheck={true}
          onChange={(e) => setTr(lang, { blurb: e.target.value })}
        />
      </Field>
      <div className="adm-grid two">
        <Field
          label="Highlight number (optional)"
          hint="A big number at the top of the project page, e.g. 1200. Empty shows nothing. Same in both languages."
        >
          <input type="number" value={f.metric} onChange={(e) => set({ metric: e.target.value })} />
        </Field>
        <Field
          label={`What the number counts (${lang.toUpperCase()})`}
          hint="Written under the number, e.g. “GitHub stars”."
        >
          <input
            value={t.metric_label}
            dir={langDir(lang)}
            lang={lang}
            onChange={(e) => setTr(lang, { metric_label: e.target.value })}
          />
        </Field>
      </div>

      <div className="adm-icons-row">
        <Field group label="Icon beside the number (optional)">
          <div className="adm-icons">
            <button
              type="button"
              className={`none${f.metricIcon ? '' : ' on'}`}
              aria-pressed={!f.metricIcon}
              onClick={() => set({ metricIcon: '' })}
            >
              None
            </button>
            {Object.entries(METRIC_ICONS).map(([name, [label, path]]) => (
              <button
                key={name}
                type="button"
                title={label}
                aria-label={`${label} icon`}
                className={f.metricIcon === name ? 'on' : ''}
                aria-pressed={f.metricIcon === name}
                onClick={() => set({ metricIcon: name })}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={path} />
                </svg>
              </button>
            ))}
          </div>
        </Field>
      </div>

      <h3 className="mono muted">Case study ({lang.toUpperCase()})</h3>
      <MarkdownEditor
        key={lang}
        value={t.body_md}
        onChange={(v) => setTr(lang, { body_md: v })}
        dir={langDir(lang)}
        lang={lang}
        postId={rec?.id}
        collection="projects"
        onUpload={upload}
        uploadHint="Save the project once to enable image uploads"
      />

      <ImageLibrary
        collection="projects"
        postId={rec?.id ?? null}
        images={images}
        onRemove={(n) => void apply({ 'images-': [n] })}
      />

      {rec && (
        <section className="adm-danger">
          <span />
          <Confirm
            message="Delete this project and its translations?"
            onYes={() =>
              void pb
                .collection('projects')
                .delete(rec.id)
                .then(() => {
                  draft.clear();
                  location.hash = '#/projects';
                })
                .catch((e) => toast(errText(e), 'err'))
            }
          />
        </section>
      )}
    </div>
  );
}
