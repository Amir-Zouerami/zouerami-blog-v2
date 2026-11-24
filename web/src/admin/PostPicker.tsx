import { useCallback, useEffect, useRef, useState } from 'react';
import { cover as artSvg, seedOf } from '../lib/cover';
import { fileUrl, pb, type Rec } from './api';
import { fmtDate } from './ui';

/** A published post as the Layout page shows it. */
export interface PostItem {
  id: string;
  slug: string;
  title: string;
  date: string;
  featured: boolean;
  /** Thumbnail URL, or null: then the site's generated artwork is drawn. */
  cover: string | null;
}

/** Title in English if there is one, else Persian, else the slug. */
export function toItem(rec: Rec): PostItem {
  const trs = ((rec.expand?.post_translations_via_post as Rec[] | undefined) ?? []).slice();
  const title =
    trs.find((t) => t.lang === 'en')?.title || trs.find((t) => t.lang === 'fa')?.title || rec.slug;
  return {
    id: rec.id,
    slug: rec.slug,
    title,
    date: rec.date,
    featured: !!rec.featured,
    cover: rec.cover ? fileUrl('posts', rec.id, rec.cover, '480x0') : null,
  };
}

export const POST_FIELDS =
  'id,slug,date,cover,featured,expand.post_translations_via_post.lang,expand.post_translations_via_post.title';

/** The picture of a post: its cover, or the same generated artwork the site shows. */
export function PostArt({ post }: { post: PostItem }) {
  if (post.cover) return <img src={post.cover} alt="" draggable={false} />;
  return (
    <div
      className="pp-art"
      aria-hidden="true"
      // our own generator's SVG (see lib/cover.ts), never user input
      // biome-ignore lint/security/noDangerouslySetInnerHtml: generated artwork
      dangerouslySetInnerHTML={{ __html: artSvg(seedOf(post.slug)) }}
    />
  );
}

const PAGE = 20;

/**
 * "Choose a post": a dialog with a search box over ALL published posts. It asks the server for 20 at a time, so it
 * stays light with hundreds of posts. `taken` maps a post id to the tile number it already has in this layout.
 */
export default function PostPicker({
  title,
  taken,
  onPick,
  onClose,
}: {
  title: string;
  taken: Record<string, number>;
  onPick: (post: PostItem) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PostItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const token = useRef(0);

  const fetchPage = useCallback(async (query: string, p: number, replace: boolean) => {
    const mine = ++token.current;
    setBusy(true);
    setFailed(false);
    try {
      const text = query.trim();
      const res = await pb.collection('posts').getList(p, PAGE, {
        filter: text
          ? pb.filter(
              'status = "published" && (slug ~ {:q} || post_translations_via_post.title ~ {:q})',
              { q: text },
            )
          : 'status = "published"',
        sort: '-date',
        expand: 'post_translations_via_post',
        fields: POST_FIELDS,
      });
      if (mine !== token.current) return; // a newer search replaced this one
      const got = res.items.map(toItem);
      setItems((cur) => (replace ? got : [...cur, ...got]));
      setTotal(res.totalItems);
      setPage(p);
      if (replace) setActive(0);
    } catch {
      if (mine === token.current) setFailed(true);
    } finally {
      if (mine === token.current) setBusy(false);
    }
  }, []);

  // first page now, then a new search 250 ms after you stop typing
  useEffect(() => {
    const t = setTimeout(() => void fetchPage(q, 1, true), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, fetchPage]);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      onPick(items[active] as PostItem);
    }
  };

  return (
    <div className="pp-wrap">
      <button
        type="button"
        className="pp-back"
        tabIndex={-1}
        aria-label="Close"
        onClick={onClose}
      />
      <div className="pp" role="dialog" aria-modal="true" aria-label={title} onKeyDown={key}>
        <div className="pp-head">
          <h3>{title}</h3>
          <button type="button" className="pp-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="pp-search">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or address…"
            aria-label="Search posts"
            role="combobox"
            aria-expanded="true"
            aria-controls="pp-list"
            aria-activedescendant={items[active] ? `pp-${items[active]?.id}` : undefined}
          />
          {q && (
            <button
              type="button"
              className="pp-clear"
              aria-label="Clear search"
              onClick={() => setQ('')}
            >
              ×
            </button>
          )}
        </div>
        <div className="pp-list" id="pp-list" role="listbox" ref={list}>
          {items.map((p, i) => {
            const at = taken[p.id];
            return (
              <button
                key={p.id}
                id={`pp-${p.id}`}
                type="button"
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                data-result={p.slug}
                className="pp-row"
                onMouseMove={() => i !== active && setActive(i)}
                onClick={() => onPick(p)}
              >
                <span className="pp-thumb">
                  <PostArt post={p} />
                </span>
                <span className="pp-text">
                  <strong>{p.title}</strong>
                  <span className="mono">
                    {fmtDate(p.date)} · /{p.slug}
                  </span>
                </span>
                {at ? (
                  <span className="pp-badge">In tile {at} · swap</span>
                ) : (
                  <span className="pp-go">Choose</span>
                )}
              </button>
            );
          })}
          {busy && <p className="pp-note mono">Searching…</p>}
          {failed && <p className="pp-note mono">Could not load posts. Try again.</p>}
          {!busy && !failed && !items.length && (
            <p className="pp-note mono">
              {q ? `No post matches “${q.trim()}”.` : 'No published posts yet.'}
            </p>
          )}
          {!busy && items.length < total && (
            <button
              type="button"
              className="pp-more"
              onClick={() => void fetchPage(q, page + 1, false)}
            >
              Show more ({total - items.length} left)
            </button>
          )}
        </div>
        <div className="pp-foot mono">
          {total ? `${total} ${q ? 'matching' : 'published'} post${total === 1 ? '' : 's'}` : ' '}
          <span>↑↓ to move · Enter to choose · Esc to close</span>
        </div>
      </div>
    </div>
  );
}
