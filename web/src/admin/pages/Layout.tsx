import { useCallback, useEffect, useMemo, useState } from 'react';
import { LAYOUT_MAX, tileVariants } from '../../lib/tiles';
import { Button } from '../../ui/Button';
import { errText, fileUrl, pb, type Rec } from '../api';
import { fmtDate, useToast } from '../ui';

interface Item {
  id: string;
  slug: string;
  title: string;
  date: string;
  featured: boolean;
  cover: string | null;
}

type Key = 'home' | 'featured';

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Where posts sit on the homepage and in the blog page's featured collage, with the real tile layouts.
 * Drag a tile onto another to swap them, drag a post from "Not shown" onto a tile to put it there, or use the menus.
 */
export default function Layout() {
  const toast = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [home, setHome] = useState<string[]>([]);
  const [feat, setFeat] = useState<string[]>([]);
  const [saved, setSaved] = useState<{
    home: string[];
    feat: string[];
    homeAuto: boolean;
    featAuto: boolean;
  }>({
    home: [],
    feat: [],
    homeAuto: true,
    featAuto: true,
  });
  const [busy, setBusy] = useState<Key | null>(null);

  const load = useCallback(async () => {
    try {
      const [posts, trs, layouts] = await Promise.all([
        pb.collection('posts').getFullList({ filter: 'status = "published"', sort: '-date' }),
        pb.collection('post_translations').getFullList({ fields: 'post,lang,title' }),
        pb.collection('layouts').getFullList(),
      ]);
      const titles: Record<string, { en?: string; fa?: string }> = {};
      for (const t of trs) titles[t.post] = { ...titles[t.post], [t.lang]: t.title };
      const list: Item[] = posts.map((p: Rec) => ({
        id: p.id,
        slug: p.slug,
        title: titles[p.id]?.en || titles[p.id]?.fa || p.slug,
        date: p.date,
        featured: !!p.featured,
        cover: p.cover ? fileUrl('posts', p.id, p.cover, '480x0') : null,
      }));
      const idsOf = (key: Key): string[] => {
        const rec = layouts.find((l) => l.key === key);
        const raw = Array.isArray(rec?.posts) ? (rec?.posts as string[]) : [];
        return [...new Set(raw)].filter((id) => list.some((p) => p.id === id)).slice(0, LAYOUT_MAX);
      };
      const homeIds = idsOf('home');
      const order = idsOf('featured');
      // exactly what the website shows today: the chosen ones, otherwise the newest five / the marked ones
      const homeNow = homeIds.length ? homeIds : list.slice(0, LAYOUT_MAX).map((p) => p.id);
      const rank = (id: string) =>
        order.includes(id) ? order.indexOf(id) : Number.POSITIVE_INFINITY;
      const featNow = list
        .filter((p) => p.featured)
        .map((p, i) => ({ p, i }))
        .sort((a, b) => (rank(a.p.id) === rank(b.p.id) ? a.i - b.i : rank(a.p.id) - rank(b.p.id)))
        .map((x) => x.p.id)
        .slice(0, LAYOUT_MAX);
      setItems(list);
      setHome(homeNow);
      setFeat(featNow);
      setSaved({
        home: homeNow,
        feat: featNow,
        homeAuto: !homeIds.length,
        featAuto: !order.length,
      });
    } catch (e) {
      toast(errText(e), 'err');
    }
  }, [toast]);
  useEffect(() => void load(), [load]);

  const save = async (key: Key) => {
    if (!items) return;
    setBusy(key);
    try {
      const ids = key === 'home' ? home : feat;
      if (key === 'featured') {
        // membership lives on the posts themselves (the "Featured" switch in the post editor), order in the layout
        for (const p of items) {
          const want = ids.includes(p.id);
          if (p.featured !== want) await pb.collection('posts').update(p.id, { featured: want });
        }
      }
      const existing = await pb.collection('layouts').getFullList({ filter: `key = "${key}"` });
      const rec = existing[0];
      if (!ids.length) {
        if (rec) await pb.collection('layouts').delete(rec.id);
      } else if (rec) await pb.collection('layouts').update(rec.id, { posts: ids });
      else await pb.collection('layouts').create({ key, posts: ids });
      toast('Saved');
      await load();
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setBusy(null);
    }
  };

  const reset = async (key: Key) => {
    setBusy(key);
    try {
      const existing = await pb.collection('layouts').getFullList({ filter: `key = "${key}"` });
      for (const r of existing) await pb.collection('layouts').delete(r.id);
      toast('Back to automatic');
      await load();
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setBusy(null);
    }
  };

  if (!items) return <p className="mono muted">Loading…</p>;
  return (
    <>
      <div className="adm-bar">
        <h1>Layout</h1>
      </div>
      <p className="muted lay-note">
        Choose which posts appear in these two places and where. The tiles are drawn exactly as on
        the site, and the arrangement changes with how many posts you pick. Changes show on the site
        within a minute.
      </p>

      <Board
        title="Homepage · Latest writing"
        hint="Up to five posts. Automatic = the five newest."
        items={items}
        ids={home}
        onChange={setHome}
        dirty={!same(home, saved.home)}
        auto={saved.homeAuto && same(home, saved.home)}
        busy={busy === 'home'}
        onSave={() => save('home')}
        onReset={() => reset('home')}
        resetLabel="Back to the newest five"
        testId="home"
      />
      <Board
        title="Blog page · Featured"
        hint="Up to five posts, shown above the list. Adding one here marks it Featured; removing one un-marks it."
        items={items}
        ids={feat}
        onChange={setFeat}
        dirty={!same(feat, saved.feat)}
        auto={saved.featAuto && same(feat, saved.feat)}
        busy={busy === 'featured'}
        onSave={() => save('featured')}
        onReset={() => reset('featured')}
        resetLabel="Back to newest first"
        testId="featured"
      />
    </>
  );
}

interface BoardProps {
  title: string;
  hint: string;
  items: Item[];
  ids: string[];
  onChange: (ids: string[]) => void;
  dirty: boolean;
  auto: boolean;
  busy: boolean;
  onSave: () => void;
  onReset: () => void;
  resetLabel: string;
  testId: string;
}

type Drag = { from: 'slot'; index: number } | { from: 'pool'; id: string };

function Board({
  title,
  hint,
  items,
  ids,
  onChange,
  dirty,
  auto,
  busy,
  onSave,
  onReset,
  resetLabel,
  testId,
}: BoardProps) {
  const byId = useMemo(() => new Map(items.map((p) => [p.id, p])), [items]);
  const [over, setOver] = useState<number | 'add' | null>(null);
  const [q, setQ] = useState('');
  const pool = items.filter(
    (p) =>
      !ids.includes(p.id) && (!q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const variants = tileVariants(ids.length);

  const read = (e: React.DragEvent): Drag | null => {
    try {
      return JSON.parse(e.dataTransfer.getData('text/plain')) as Drag;
    } catch {
      return null;
    }
  };
  const start = (e: React.DragEvent, d: Drag) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(d));
    e.dataTransfer.effectAllowed = 'move';
  };
  const swap = (a: number, b: number) => {
    if (a === b) return;
    const next = [...ids];
    [next[a], next[b]] = [next[b] as string, next[a] as string];
    onChange(next);
  };
  const put = (index: number, id: string) => {
    const at = ids.indexOf(id);
    if (at === index) return;
    if (at >= 0) return swap(at, index);
    const next = [...ids];
    next[index] = id;
    onChange(next);
  };
  const drop = (e: React.DragEvent, target: number | 'add') => {
    e.preventDefault();
    setOver(null);
    const d = read(e);
    if (!d) return;
    if (target === 'add') {
      if (d.from === 'pool' && ids.length < LAYOUT_MAX && !ids.includes(d.id))
        onChange([...ids, d.id]);
      return;
    }
    if (d.from === 'slot') swap(d.index, target);
    else put(target, d.id);
  };
  const allow = (e: React.DragEvent, target: number | 'add') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (over !== target) setOver(target);
  };

  return (
    <section className="lay-board" data-board={testId}>
      <div className="lay-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{hint}</p>
        </div>
        <span className="grow" />
        {auto && <span className="mono muted">Automatic</span>}
        {dirty && (
          <span className="mono" style={{ color: 'var(--acc)' }}>
            Unsaved changes
          </span>
        )}
        <Button disabled={busy || auto} onClick={onReset}>
          {resetLabel}
        </Button>
        <Button variant="solid" disabled={busy || !dirty} onClick={onSave}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="lay-grid" data-count={ids.length}>
        {ids.map((id, i) => {
          const p = byId.get(id);
          if (!p) return null;
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: dragging is an extra; every action also has a menu or button
            <div
              key={id}
              className={`lay-slot lay-${variants[i] ?? 'third'}${over === i ? ' over' : ''}`}
              draggable
              data-slot={i}
              onDragStart={(e) => start(e, { from: 'slot', index: i })}
              onDragOver={(e) => allow(e, i)}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(e) => drop(e, i)}
              onDragEnd={() => setOver(null)}
            >
              {p.cover && <img src={p.cover} alt="" draggable={false} />}
              <span className="lay-n mono">{i + 1}</span>
              <button
                type="button"
                className="lay-x"
                aria-label={`Remove ${p.title}`}
                title="Remove from this layout"
                onClick={() => onChange(ids.filter((x) => x !== id))}
              >
                ×
              </button>
              <div className="lay-info">
                <strong>{p.title}</strong>
                <span className="mono">{fmtDate(p.date)}</span>
                <select
                  aria-label={`Post in tile ${i + 1}`}
                  value={id}
                  onChange={(e) => put(i, e.target.value)}
                >
                  {items.map((o) => (
                    <option key={o.id} value={o.id}>
                      {ids.includes(o.id) && o.id !== id ? `${ids.indexOf(o.id) + 1} · ` : ''}
                      {o.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {ids.length < LAYOUT_MAX && (
        // biome-ignore lint/a11y/noStaticElementInteractions: a drop target; the menu beside it does the same
        <div
          className={`lay-add${over === 'add' ? ' over' : ''}`}
          onDragOver={(e) => allow(e, 'add')}
          onDragLeave={() => setOver((o) => (o === 'add' ? null : o))}
          onDrop={(e) => drop(e, 'add')}
        >
          <span className="muted">
            Add a post{ids.length ? ` (tile ${ids.length + 1})` : ''}: drop one here or
          </span>
          <select
            aria-label="Add a post"
            value=""
            onChange={(e) => e.target.value && onChange([...ids, e.target.value])}
          >
            <option value="">choose…</option>
            {pool.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <details className="lay-pool" open>
        <summary className="mono">
          Not shown here ({items.filter((p) => !ids.includes(p.id)).length}), drag onto a tile
        </summary>
        <input
          className="lay-search"
          placeholder="Search posts…"
          aria-label="Search posts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="lay-chips">
          {pool.map((p) => (
            <button
              key={p.id}
              type="button"
              className="lay-chip"
              draggable
              data-chip={p.slug}
              title="Drag onto a tile, or click to add"
              onDragStart={(e) => start(e, { from: 'pool', id: p.id })}
              onDragEnd={() => setOver(null)}
              onClick={() => ids.length < LAYOUT_MAX && onChange([...ids, p.id])}
            >
              {p.cover ? <img src={p.cover} alt="" draggable={false} /> : <i />}
              <span>{p.title}</span>
            </button>
          ))}
          {!pool.length && <span className="mono muted">Nothing else to show.</span>}
        </div>
      </details>
    </section>
  );
}
