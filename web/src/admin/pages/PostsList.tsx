import { useCallback, useEffect, useState } from 'react';
import type { MenuEntry } from '../../lib/context-menu';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { errText, pb, type Rec } from '../api';
import { contextMenuProps, copyText, goto, icons, openTab } from '../contextMenu';
import DateRange from '../DateRange';
import { inRange } from '../date';
import { Pager, usePaged } from '../Pager';
import { fmtDate, useToast } from '../ui';

export default function PostsList() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [titles, setTitles] = useState<Record<string, { en?: string; fa?: string }>>({});
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [q, setQ] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });

  const load = useCallback(async () => {
    try {
      const [posts, trs] = await Promise.all([
        pb.collection('posts').getFullList({ sort: '-date' }),
        pb.collection('post_translations').getFullList({ fields: 'post,lang,title' }),
      ]);
      const map: Record<string, { en?: string; fa?: string }> = {};
      for (const t of trs) {
        const entry = map[t.post] ?? {};
        entry[t.lang as 'en' | 'fa'] = t.title;
        map[t.post] = entry;
      }
      setTitles(map);
      setRows(posts);
    } catch (e) {
      toast(errText(e), 'err');
    }
  }, [toast]);
  useEffect(() => void load(), [load]);

  const rowMenu = (p: Rec): MenuEntry[] => {
    const title = titles[p.id]?.en || titles[p.id]?.fa || p.slug;
    const published = p.status === 'published';
    return [
      {
        id: 'edit',
        label: 'Edit',
        icon: icons.edit,
        onSelect: () => goto(`#/posts/${p.id}`),
      },
      {
        id: 'open',
        label: 'View on site',
        icon: icons.external,
        hidden: !published,
        onSelect: () => openTab(`/blog/${p.slug}`),
      },
      {
        id: 'preview',
        label: 'Open preview link',
        icon: icons.eye,
        hidden: published || !p.preview_token,
        onSelect: () =>
          void window.open(`/blog/${p.slug}?token=${p.preview_token}`, '_blank', 'noopener'),
      },
      { type: 'separator' },
      {
        id: 'copy-url',
        label: 'Copy public link',
        icon: icons.link,
        hidden: !published,
        onSelect: () => copyText(`${location.origin}/blog/${p.slug}`, toast, 'Link copied'),
      },
      {
        id: 'copy-preview',
        label: 'Copy preview link',
        icon: icons.link,
        hidden: published || !p.preview_token,
        onSelect: () =>
          copyText(
            `${location.origin}/blog/${p.slug}?token=${p.preview_token}`,
            toast,
            'Preview link copied',
          ),
      },
      {
        id: 'copy-slug',
        label: 'Copy slug',
        icon: icons.copy,
        onSelect: () => copyText(p.slug, toast, 'Slug copied'),
      },
      { type: 'separator' },
      {
        id: 'toggle',
        label: published ? 'Unpublish' : 'Publish',
        icon: published ? icons.eyeOff : icons.check,
        onSelect: async () => {
          try {
            await pb
              .collection('posts')
              .update(p.id, { status: published ? 'draft' : 'published' });
            toast(published ? 'Unpublished' : 'Published');
            await load();
          } catch (e) {
            toast(errText(e), 'err');
          }
        },
      },
      {
        id: 'delete',
        label: 'Delete…',
        icon: icons.trash,
        danger: true,
        onSelect: async () => {
          if (
            !confirm(
              `Delete "${title}", its translations, comments, likes and bookmarks? This cannot be undone.`,
            )
          )
            return;
          try {
            await pb.collection('posts').delete(p.id);
            toast('Post deleted');
            await load();
          } catch (e) {
            toast(errText(e), 'err');
          }
        },
      },
    ];
  };

  const list = (rows ?? []).filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if ((range.from || range.to) && !inRange(p.date, range.from, range.to)) return false;
    const hay =
      `${p.slug} ${titles[p.id]?.en ?? ''} ${titles[p.id]?.fa ?? ''} ${(p.tags ?? []).join(' ')}`.toLowerCase();
    return !q || hay.includes(q.toLowerCase());
  });
  const pg = usePaged(list, 25, `${filter}|${q}|${range.from}|${range.to}`);

  return (
    <>
      <div className="adm-bar">
        <h1>Posts</h1>
        <span className="grow" />
        <input
          className="adm-search"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search posts"
        />
        <DateRange label="Published" from={range.from} to={range.to} onChange={setRange} />
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          aria-label="Filter by status"
        >
          <option value="all">All</option>
          <option value="draft">Drafts</option>
          <option value="published">Published</option>
        </Select>
        <Button variant="solid" href="#/posts/new">
          New post
        </Button>
      </div>
      {!rows ? (
        <p className="mono muted">Loading…</p>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Languages</th>
              <th>Status</th>
              <th>Date</th>
              <th>Views</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pg.items.map((p) => (
              <tr key={p.id} {...contextMenuProps(() => rowMenu(p), 'Post actions')}>
                <td>
                  <a href={`#/posts/${p.id}`}>{titles[p.id]?.en || titles[p.id]?.fa || p.slug}</a>
                  <br />
                  <small className="mono muted">/{p.slug}</small>
                </td>
                <td className="mono">
                  {titles[p.id]?.en ? 'EN ' : ''}
                  {titles[p.id]?.fa ? 'FA' : ''}
                </td>
                <td>
                  <span className={`adm-pill ${p.status}`}>{p.status}</span>
                </td>
                <td className="mono muted">{fmtDate(p.date)}</td>
                <td className="mono">{p.views ?? 0}</td>
                <td>
                  {p.status === 'published' && (
                    <a
                      className="mono muted"
                      href={`/blog/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={6} className="muted">
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      <Pager {...pg} />
    </>
  );
}
