import { useCallback, useEffect, useState } from 'react';
import { errText, pb, type Rec } from '../api';
import DateRange from '../DateRange';
import { inRange } from '../date';
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

  const list = (rows ?? []).filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if ((range.from || range.to) && !inRange(p.date, range.from, range.to)) return false;
    const hay =
      `${p.slug} ${titles[p.id]?.en ?? ''} ${titles[p.id]?.fa ?? ''} ${(p.tags ?? []).join(' ')}`.toLowerCase();
    return !q || hay.includes(q.toLowerCase());
  });

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
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          aria-label="Filter by status"
        >
          <option value="all">All</option>
          <option value="draft">Drafts</option>
          <option value="published">Published</option>
        </select>
        <a className="adm-btn solid" href="#/posts/new">
          New post
        </a>
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
            {list.map((p) => (
              <tr key={p.id}>
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
    </>
  );
}
