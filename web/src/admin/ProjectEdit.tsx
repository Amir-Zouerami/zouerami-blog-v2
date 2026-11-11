import { useCallback, useEffect, useState } from 'react';
import { errText, fileUrl, pb, type Rec, SLUG, slugify } from './api';
import MarkdownEditor from './MarkdownEditor';
import { Confirm, Field, useToast } from './ui';

type Lang = 'en' | 'fa';
interface Tr {
  id?: string;
  blurb: string;
  metric_label: string;
  body_md: string;
}
const EMPTY: Tr = { blurb: '', metric_label: '', body_md: '' };
const CATEGORIES = ['Web App', 'Design System', 'Tool', 'Open Source'];

export default function ProjectEdit({ id }: { id: string | null }) {
  const toast = useToast();
  const [rec, setRec] = useState<Rec | null>(null);
  const [f, setF] = useState({
    name: '',
    slug: '',
    year: new Date().getFullYear(),
    category: CATEGORIES[0] as string,
    stack: '',
    link_live: '',
    link_repo: '',
    metric_value: 0,
    sort: 10,
    status: 'draft',
  });
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [trs, setTrs] = useState<Record<Lang, Tr>>({ en: { ...EMPTY }, fa: { ...EMPTY } });
  const [lang, setLang] = useState<Lang>('en');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const p = await pb.collection('projects').getOne(id);
      const list = await pb
        .collection('project_translations')
        .getFullList({ filter: pb.filter('project = {:id}', { id }) });
      const next: Record<Lang, Tr> = { en: { ...EMPTY }, fa: { ...EMPTY } };
      for (const t of list)
        next[t.lang as Lang] = {
          id: t.id,
          blurb: t.blurb,
          metric_label: t.metric_label,
          body_md: t.body_md,
        };
      setRec(p);
      setF({
        name: p.name,
        slug: p.slug,
        year: p.year,
        category: p.category,
        stack: (p.stack ?? []).join(', '),
        link_live: p.link_live ?? '',
        link_repo: p.link_repo ?? '',
        metric_value: p.metric_value ?? 0,
        sort: p.sort ?? 0,
        status: p.status,
      });
      setTouchedSlug(true);
      setTrs(next);
      setDirty(false);
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);
  useEffect(() => void load(), [load]);

  const set = (patch: Partial<typeof f>) => {
    setF((s) => ({ ...s, ...patch }));
    setDirty(true);
    if (patch.name !== undefined && !touchedSlug && !id)
      setF((s) => ({ ...s, slug: slugify(patch.name ?? '') }));
  };
  const setTr = (patch: Partial<Tr>) => {
    setTrs((s) => ({ ...s, [lang]: { ...s[lang], ...patch } }));
    setDirty(true);
  };

  const save = async (status?: string) => {
    if (saving) return;
    if (!f.name.trim()) return toast('Name is required', 'err');
    if (!SLUG.test(f.slug)) return toast('Slug: lowercase letters, numbers and dashes only', 'err');
    setSaving(true);
    try {
      const data = {
        ...f,
        status: status ?? f.status,
        stack: f.stack
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        year: Number(f.year),
        metric_value: Number(f.metric_value),
        sort: Number(f.sort),
      };
      let saved: Rec;
      if (coverFile) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(data))
          fd.append(k, k === 'stack' ? JSON.stringify(v) : String(v));
        fd.append('cover', coverFile);
        saved = rec
          ? await pb.collection('projects').update(rec.id, fd)
          : await pb.collection('projects').create(fd);
      } else {
        saved = rec
          ? await pb.collection('projects').update(rec.id, data)
          : await pb.collection('projects').create(data);
      }
      for (const l of ['en', 'fa'] as Lang[]) {
        const t = trs[l];
        if (!t.blurb.trim() && !t.body_md.trim()) continue;
        const body = {
          project: saved.id,
          lang: l,
          blurb: t.blurb,
          metric_label: t.metric_label,
          body_md: t.body_md,
        };
        if (t.id) await pb.collection('project_translations').update(t.id, body);
        else await pb.collection('project_translations').create(body);
      }
      setCoverFile(null);
      toast('Saved');
      if (!rec) location.hash = `#/projects/${saved.id}`;
      else await load();
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="mono muted">Loading…</p>;
  const t = trs[lang];
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
        <button type="button" className="adm-btn" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {f.status === 'published' ? (
          <button type="button" className="adm-btn" onClick={() => void save('draft')}>
            Unpublish
          </button>
        ) : (
          <button type="button" className="adm-btn solid" onClick={() => void save('published')}>
            Publish
          </button>
        )}
      </div>
      <div className="adm-grid">
        <Field label="Name">
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Slug">
          <input
            value={f.slug}
            dir="ltr"
            onChange={(e) => {
              setTouchedSlug(true);
              set({ slug: e.target.value.toLowerCase() });
            }}
          />
        </Field>
        <Field label="Category">
          <select value={f.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Year">
          <input
            type="number"
            value={f.year}
            onChange={(e) => set({ year: Number(e.target.value) })}
          />
        </Field>
        <Field label="Stack (comma separated)">
          <input value={f.stack} dir="ltr" onChange={(e) => set({ stack: e.target.value })} />
        </Field>
        <Field label="Order (lower first)">
          <input
            type="number"
            value={f.sort}
            onChange={(e) => set({ sort: Number(e.target.value) })}
          />
        </Field>
        <Field label="Live URL">
          <input
            type="url"
            dir="ltr"
            value={f.link_live}
            onChange={(e) => set({ link_live: e.target.value })}
          />
        </Field>
        <Field label="Repository URL">
          <input
            type="url"
            dir="ltr"
            value={f.link_repo}
            onChange={(e) => set({ link_repo: e.target.value })}
          />
        </Field>
        <Field label="Headline number">
          <input
            type="number"
            value={f.metric_value}
            onChange={(e) => set({ metric_value: Number(e.target.value) })}
          />
        </Field>
        <Field label="Status">
          <select value={f.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </Field>
        <Field label="Cover (optional)">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setCoverFile(e.target.files?.[0] ?? null);
              setDirty(true);
            }}
          />
          {rec?.cover && (
            <img
              className="adm-thumb"
              src={fileUrl('projects', rec.id, rec.cover, '480x0')}
              alt=""
            />
          )}
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
            {l === 'en' ? 'English' : 'فارسی'} {trs[l].blurb || trs[l].body_md ? '●' : '○'}
          </button>
        ))}
      </div>
      <div className="adm-grid two">
        <Field label="Blurb (one or two sentences)">
          <textarea
            rows={2}
            maxLength={1000}
            value={t.blurb}
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
            onChange={(e) => setTr({ blurb: e.target.value })}
          />
        </Field>
        <Field label="Headline number label (e.g. “GitHub stars”)">
          <input
            value={t.metric_label}
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
            onChange={(e) => setTr({ metric_label: e.target.value })}
          />
        </Field>
      </div>
      <MarkdownEditor
        key={`${id ?? 'new'}-${lang}`}
        value={t.body_md}
        onChange={(v) => setTr({ body_md: v })}
        dir={lang === 'fa' ? 'rtl' : 'ltr'}
        lang={lang}
        onSave={() => void save()}
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
                  location.hash = '#/projects';
                })
            }
          />
        </section>
      )}
    </div>
  );
}
