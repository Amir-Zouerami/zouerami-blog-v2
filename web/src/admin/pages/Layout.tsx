import { useCallback, useEffect, useMemo, useState } from 'react';
import { LAYOUT_MAX, tileVariants } from '../../lib/tiles';
import { Button } from '../../ui/Button';
import { errText, pb, type Rec } from '../api';
import PostPicker, { POST_FIELDS, PostArt, type PostItem, toItem } from '../PostPicker';
import { fmtDate, useToast } from '../ui';

type Key = 'home' | 'featured';

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

interface State {
  ids: string[];
  /** what the server has (to know what changed) */
  saved: string[];
  /** no layout stored: the site chooses by itself */
  auto: boolean;
}
const EMPTY: State = { ids: [], saved: [], auto: true };

/**
 * Which posts the homepage and the blog page's featured collage show, and where.
 *
 * Each board is the real tile arrangement. Every tile has one job: it holds a post. "Change" on a tile picks another
 * post for it (a search over all posts), dragging a tile onto another swaps them, × takes one out, and the dashed last
 * tile adds a post. Nothing else.
 */
export default function Layout() {
  const toast = useToast();
  const [known, setKnown] = useState<Record<string, PostItem>>({});
  const [boards, setBoards] = useState<Record<Key, State>>({ home: EMPTY, featured: EMPTY });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<Key | null>(null);

  const remember = useCallback((posts: PostItem[]) => {
    setKnown((k) => {
      const next = { ...k };
      for (const p of posts) next[p.id] = p;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const get = (filter: string, perPage: number) =>
        pb.collection('posts').getList(1, perPage, {
          filter,
          sort: '-date',
          expand: 'post_translations_via_post',
          fields: POST_FIELDS,
        });
      const layouts = await pb.collection('layouts').getFullList();
      const idsOf = (key: Key): string[] => {
        const raw = layouts.find((l) => l.key === key)?.posts;
        return Array.isArray(raw) ? [...new Set(raw as string[])].slice(0, LAYOUT_MAX) : [];
      };
      const homeIds = idsOf('home');
      const order = idsOf('featured');
      // only what is needed: the newest five, the featured ones, and the posts a stored layout names
      const named = [...new Set([...homeIds, ...order])];
      const [newest, flagged, extra] = await Promise.all([
        get('status = "published"', LAYOUT_MAX),
        get('status = "published" && featured = true', 50),
        named.length
          ? get(`status = "published" && (${named.map((id) => `id = "${id}"`).join(' || ')})`, 20)
          : Promise.resolve({ items: [] as Rec[] }),
      ]);
      const items = [...newest.items, ...flagged.items, ...extra.items].map(toItem);
      const byId = new Map(items.map((p) => [p.id, p]));
      remember(items);

      const homeStored = homeIds.filter((id) => byId.has(id));
      const homeNow = homeStored.length ? homeStored : newest.items.map((r) => r.id);
      const rank = (id: string) =>
        order.includes(id) ? order.indexOf(id) : Number.POSITIVE_INFINITY;
      const featNow = flagged.items
        .map((r, i) => ({ id: r.id, i }))
        .sort((a, b) => (rank(a.id) === rank(b.id) ? a.i - b.i : rank(a.id) - rank(b.id)))
        .map((x) => x.id)
        .slice(0, LAYOUT_MAX);
      setBoards({
        home: { ids: homeNow, saved: homeNow, auto: !homeStored.length },
        featured: { ids: featNow, saved: featNow, auto: !order.length },
      });
      setLoaded(true);
    } catch (e) {
      toast(errText(e), 'err');
    }
  }, [toast, remember]);
  useEffect(() => void load(), [load]);

  const setIds = (key: Key, ids: string[]) =>
    setBoards((b) => ({ ...b, [key]: { ...b[key], ids } }));

  const save = async (key: Key) => {
    setBusy(key);
    try {
      const ids = boards[key].ids;
      if (key === 'featured') {
        // who is featured is the "Featured" switch on the post itself; the layout keeps their order
        const flagged = await pb.collection('posts').getFullList({
          filter: 'status = "published" && featured = true',
          fields: 'id',
        });
        for (const r of flagged)
          if (!ids.includes(r.id)) await pb.collection('posts').update(r.id, { featured: false });
        for (const id of ids)
          if (!flagged.some((r) => r.id === id))
            await pb.collection('posts').update(id, { featured: true });
      }
      const existing = (
        await pb.collection('layouts').getFullList({ filter: `key = "${key}"` })
      )[0];
      if (!ids.length) {
        if (existing) await pb.collection('layouts').delete(existing.id);
      } else if (existing) await pb.collection('layouts').update(existing.id, { posts: ids });
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
      for (const r of await pb.collection('layouts').getFullList({ filter: `key = "${key}"` }))
        await pb.collection('layouts').delete(r.id);
      toast('Back to automatic');
      await load();
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) return <p className="mono muted">Loading…</p>;
  return (
    <>
      <div className="adm-bar">
        <h1>Layout</h1>
      </div>
      <p className="muted lay-note">
        Pick which posts appear on the homepage and in the blog page's featured collage, and where.
        The boards below are the real arrangement and change with how many posts you choose. The
        site shows changes within a minute.
      </p>
      <Board
        testId="home"
        title="Homepage"
        place="The “Latest writing” section"
        autoText="the 5 newest posts"
        state={boards.home}
        posts={known}
        busy={busy === 'home'}
        onChange={(ids) => setIds('home', ids)}
        onRemember={remember}
        onSave={() => save('home')}
        onReset={() => reset('home')}
        onDiscard={() => void load()}
      />
      <Board
        testId="featured"
        title="Blog page"
        place="The featured collage above the list"
        autoText="your posts marked Featured, newest first"
        note="Adding a post here marks it Featured; taking one out un-marks it."
        state={boards.featured}
        posts={known}
        busy={busy === 'featured'}
        onChange={(ids) => setIds('featured', ids)}
        onRemember={remember}
        onSave={() => save('featured')}
        onReset={() => reset('featured')}
        onDiscard={() => void load()}
      />
    </>
  );
}

function Board({
  testId,
  title,
  place,
  autoText,
  note,
  state,
  posts,
  busy,
  onChange,
  onRemember,
  onSave,
  onReset,
  onDiscard,
}: {
  testId: string;
  title: string;
  place: string;
  autoText: string;
  note?: string;
  state: State;
  posts: Record<string, PostItem>;
  busy: boolean;
  onChange: (ids: string[]) => void;
  onRemember: (posts: PostItem[]) => void;
  onSave: () => void;
  onReset: () => void;
  onDiscard: () => void;
}) {
  const { ids } = state;
  const dirty = !same(ids, state.saved);
  const [picking, setPicking] = useState<{ index: number } | null>(null);
  const [over, setOver] = useState<number | null>(null);
  // one more, empty tile after the chosen ones shows what adding a post would do to the arrangement
  const total = ids.length + (ids.length < LAYOUT_MAX ? 1 : 0);
  const variants = tileVariants(total);
  const taken = useMemo(() => Object.fromEntries(ids.map((id, i) => [id, i + 1])), [ids]);

  const choose = (index: number, post: PostItem) => {
    onRemember([post]);
    const at = ids.indexOf(post.id);
    const next = [...ids];
    if (index >= ids.length) {
      if (at < 0) next.push(post.id);
    } else if (at >= 0) {
      [next[at], next[index]] = [next[index] as string, next[at] as string]; // already in another tile: swap
    } else {
      next[index] = post.id;
    }
    onChange(next);
    setPicking(null);
  };
  const swap = (a: number, b: number) => {
    if (a === b) return;
    const next = [...ids];
    [next[a], next[b]] = [next[b] as string, next[a] as string];
    onChange(next);
  };

  const pill = dirty ? (
    <span className="lay-pill warn">Unsaved changes</span>
  ) : state.auto ? (
    <span className="lay-pill">Automatic: {autoText}</span>
  ) : (
    <span className="lay-pill on">Your choice</span>
  );

  return (
    <section className="lay-board" data-board={testId}>
      <header className="lay-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{place}</p>
        </div>
        <span className="grow" />
        {pill}
        <Button disabled={busy || (state.auto && !dirty)} onClick={dirty ? onDiscard : onReset}>
          {dirty ? 'Discard changes' : 'Back to automatic'}
        </Button>
        <Button variant="solid" disabled={busy || !dirty} onClick={onSave}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </header>
      {note && <p className="lay-sub muted">{note}</p>}

      <div className="lay-grid" data-count={ids.length}>
        {Array.from({ length: total }, (_, i) => {
          const id = ids[i];
          const p = id ? posts[id] : undefined;
          const cls = `lay-${variants[i] ?? 'third'}`;
          if (!id || !p) {
            return (
              <button
                key="add"
                type="button"
                className={`lay-tile lay-empty ${cls}`}
                data-add
                onClick={() => setPicking({ index: ids.length })}
              >
                <span className="lay-plus">+</span>
                <span>Add a post</span>
              </button>
            );
          }
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: dragging is an extra; "Change" and "Remove" do everything from the keyboard
            <div
              key={id}
              className={`lay-tile ${cls}${over === i ? ' over' : ''}`}
              data-slot={i}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(i));
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (over !== i) setOver(i);
              }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const from = Number(e.dataTransfer.getData('text/plain'));
                if (Number.isInteger(from) && from >= 0 && from < ids.length) swap(from, i);
              }}
              onDragEnd={() => setOver(null)}
            >
              <PostArt post={p} />
              <span className="lay-n mono">{i + 1}</span>
              <div className="lay-acts">
                <button
                  type="button"
                  aria-label={`Change post in tile ${i + 1}`}
                  onClick={() => setPicking({ index: i })}
                >
                  Change
                </button>
                <button
                  type="button"
                  className="lay-x"
                  aria-label={`Remove ${p.title}`}
                  onClick={() => onChange(ids.filter((x) => x !== id))}
                >
                  ×
                </button>
              </div>
              <div className="lay-info">
                <strong>{p.title}</strong>
                <span className="mono">{fmtDate(p.date)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {ids.length > 1 && (
        <p className="lay-hint mono">Drag a tile onto another to swap their places.</p>
      )}

      {picking && (
        <PostPicker
          title={
            picking.index < ids.length
              ? `Choose the post for tile ${picking.index + 1}`
              : 'Add a post'
          }
          taken={taken}
          onPick={(post) => choose(picking.index, post)}
          onClose={() => setPicking(null)}
        />
      )}
    </section>
  );
}
