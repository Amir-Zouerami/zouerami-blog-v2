import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { FilePicker } from '../../ui/FilePicker';
import { Select } from '../../ui/Select';
import { errText, fileUrl, pb, type Rec, SLUG, slugify } from '../api';
import LangTabs, { type Lang, langDir } from '../LangTabs';
import MarkdownEditor from '../MarkdownEditor';
import { Confirm, Field, useToast } from '../ui';
import { useDraft } from '../useDraft';

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
  const [baseline, setBaseline] = useState<string | null>(id ? null : '');

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
      setBaseline(JSON.stringify(snap(p, next)));
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);
  useEffect(() => void load(), [load]);

  const strip = (t: Record<Lang, Tr>) => ({
    en: { blurb: t.en.blurb, metric_label: t.en.metric_label, body_md: t.en.body_md },
    fa: { blurb: t.fa.blurb, metric_label: t.fa.metric_label, body_md: t.fa.body_md },
  });
  const snap = (p: Rec, t: Record<Lang, Tr>) => ({
    f: {
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
    },
    trs: strip(t),
  });
  const draft = useDraft(
    `project:${rec?.id ?? id ?? 'new'}`,
    { f, trs: strip(trs) },
    { baseline: baseline ?? null, enabled: dirty },
  );
  const restoreDraft = () => {
    const d = draft.take();
    if (!d) return;
    setF(d.f);
    setTrs((s) => ({ en: { ...s.en, ...d.trs.en }, fa: { ...s.fa, ...d.trs.fa } }));
    setDirty(true);
    toast('Unsaved draft restored');
  };

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
      draft.clear();
      toast('Saved');
      if (!rec) history.replaceState(null, '', `#/projects/${saved.id}`);
      setRec(saved);
      setDirty(false);
      setBaseline(JSON.stringify(snap(saved, trs)));
      if (id) await load();
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
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {f.status === 'published' ? (
          <Button onClick={() => void save('draft')}>Unpublish</Button>
        ) : (
          <Button variant="solid" onClick={() => void save('published')}>
            Publish
          </Button>
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
          <Select value={f.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
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
          <Select value={f.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
        </Field>
        <Field group label="Cover (optional)">
          <FilePicker
            accept="image/*"
            onChange={(file) => {
              setCoverFile(file);
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
      <LangTabs
        active={lang}
        onChange={setLang}
        state={(l) => ({ filled: !!(trs[l].blurb || trs[l].body_md) })}
      />
      <div className="adm-grid two">
        <Field label="Blurb (one or two sentences)">
          <textarea
            rows={2}
            maxLength={1000}
            value={t.blurb}
            dir={langDir(lang)}
            onChange={(e) => setTr({ blurb: e.target.value })}
          />
        </Field>
        <Field label="Headline number label (e.g. “GitHub stars”)">
          <input
            value={t.metric_label}
            dir={langDir(lang)}
            onChange={(e) => setTr({ metric_label: e.target.value })}
          />
        </Field>
      </div>
      <MarkdownEditor
        key={lang}
        value={t.body_md}
        onChange={(v) => setTr({ body_md: v })}
        dir={langDir(lang)}
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
