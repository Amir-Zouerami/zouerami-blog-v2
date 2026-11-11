import { useCallback, useEffect, useState } from 'react';
import { errText, fileUrl, pb, type Rec } from './api';
import { Confirm, fmtDate, useToast } from './ui';

export function PostsList() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [titles, setTitles] = useState<Record<string, { en?: string; fa?: string }>>({});
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [q, setQ] = useState('');

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

export function ProjectsList() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  useEffect(() => {
    pb.collection('projects')
      .getFullList({ sort: 'sort,-year' })
      .then(setRows)
      .catch((e) => toast(errText(e), 'err'));
  }, [toast]);
  return (
    <>
      <div className="adm-bar">
        <h1>Projects</h1>
        <span className="grow" />
        <a className="adm-btn solid" href="#/projects/new">
          New project
        </a>
      </div>
      {!rows ? (
        <p className="mono muted">Loading…</p>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Year</th>
              <th>Status</th>
              <th>Order</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <a href={`#/projects/${p.id}`}>{p.name}</a>
                  <br />
                  <small className="mono muted">/{p.slug}</small>
                </td>
                <td>{p.category}</td>
                <td className="mono">{p.year}</td>
                <td>
                  <span className={`adm-pill ${p.status}`}>{p.status}</span>
                </td>
                <td className="mono">{p.sort}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

const postSlug = (c: Rec): string =>
  ((c.expand?.post as Rec | undefined)?.slug as string | undefined) ?? '';

export function CommentsAdmin() {
  const toast = useToast();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      setRows(
        await pb.collection('comments').getFullList({
          filter: pb.filter('status = {:s}', { s: status }),
          sort: '-created',
          expand: 'post,user',
          fields: '*,expand.post.slug,expand.user.email,expand.user.name',
        }),
      );
      const c: Record<string, number> = {};
      for (const s of ['pending', 'approved', 'rejected'])
        c[s] = (
          await pb
            .collection('comments')
            .getList(1, 1, { filter: pb.filter('status = {:s}', { s }) })
        ).totalItems;
      setCounts(c);
    } catch (e) {
      toast(errText(e), 'err');
    }
  }, [status, toast]);
  useEffect(() => void load(), [load]);

  const set = async (id: string, s: string) => {
    try {
      await pb.collection('comments').update(id, { status: s });
      toast(s === 'approved' ? 'Approved' : 'Rejected');
      void load();
    } catch (e) {
      toast(errText(e), 'err');
    }
  };
  const del = async (id: string) => {
    await pb
      .collection('comments')
      .delete(id)
      .catch((e) => toast(errText(e), 'err'));
    void load();
  };
  const approveAll = async () => {
    for (const r of rows ?? [])
      await pb
        .collection('comments')
        .update(r.id, { status: 'approved' })
        .catch(() => {});
    toast('All approved');
    void load();
  };

  return (
    <>
      <div className="adm-bar">
        <h1>Comments</h1>
        <span className="grow" />
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`adm-btn ${status === s ? 'solid' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s} {counts[s] !== undefined ? `(${counts[s]})` : ''}
          </button>
        ))}
        {status === 'pending' && !!rows?.length && (
          <button type="button" className="adm-btn" onClick={() => void approveAll()}>
            Approve all
          </button>
        )}
      </div>
      {!rows ? (
        <p className="mono muted">Loading…</p>
      ) : (
        <div className="adm-cmts">
          {rows.map((c) => (
            <article key={c.id} className="adm-cmt">
              <header className="mono muted">
                {c.author_name} · {(c.expand?.user as Rec | undefined)?.email} ·{' '}
                {fmtDate(c.created)} ·{' '}
                {postSlug(c) && (
                  <a href={`/blog/${postSlug(c)}`} target="_blank" rel="noopener noreferrer">
                    /{postSlug(c)} ↗
                  </a>
                )}
              </header>
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</p>
              <div className="row-inline">
                {status !== 'approved' && (
                  <button
                    type="button"
                    className="adm-btn solid"
                    onClick={() => void set(c.id, 'approved')}
                  >
                    Approve
                  </button>
                )}
                {status !== 'rejected' && (
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={() => void set(c.id, 'rejected')}
                  >
                    Reject
                  </button>
                )}
                <Confirm message="Delete this comment permanently?" onYes={() => void del(c.id)} />
              </div>
            </article>
          ))}
          {!rows.length && <p className="muted">No {status} comments.</p>}
        </div>
      )}
    </>
  );
}

export function SubscribersAdmin() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const load = useCallback(() => {
    pb.collection('subscribers')
      .getFullList({ sort: '-created' })
      .then(setRows)
      .catch((e) => toast(errText(e), 'err'));
  }, [toast]);
  useEffect(load, [load]);
  const csv = () => {
    const lines = [
      'email,confirmed,locale,created',
      ...(rows ?? []).map((r) => `${r.email},${r.confirmed},${r.locale},${r.created}`),
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'subscribers.csv';
    a.click();
  };
  const confirmed = (rows ?? []).filter((r) => r.confirmed).length;
  return (
    <>
      <div className="adm-bar">
        <h1>Subscribers</h1>
        <span className="grow" />
        <span className="mono muted">
          {confirmed} confirmed / {rows?.length ?? 0} total
        </span>
        <button type="button" className="adm-btn" onClick={csv} disabled={!rows?.length}>
          Export CSV
        </button>
      </div>
      {!rows ? (
        <p className="mono muted">Loading…</p>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Confirmed</th>
              <th>Language</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.email}</td>
                <td>{r.confirmed ? '✓' : '—'}</td>
                <td className="mono">{r.locale}</td>
                <td className="mono muted">{fmtDate(r.created)}</td>
                <td>
                  <Confirm
                    message={`Remove ${r.email}?`}
                    onYes={() => void pb.collection('subscribers').delete(r.id).then(load)}
                  />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="muted">
                  No subscribers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}

export function UsersAdmin() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const load = useCallback(() => {
    pb.collection('users')
      .getFullList({ sort: '-created' })
      .then(setRows)
      .catch((e) => toast(errText(e), 'err'));
  }, [toast]);
  useEffect(load, [load]);
  return (
    <>
      <div className="adm-bar">
        <h1>Users</h1>
        <span className="grow" />
        <span className="mono muted">
          Promote to admin: <code>bun run make-admin email</code>
        </span>
      </div>
      {!rows ? (
        <p className="mono muted">Loading…</p>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Verified</th>
              <th>Role</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.verified ? '✓' : '—'}</td>
                <td className="mono">{r.role || 'user'}</td>
                <td className="mono muted">{fmtDate(r.created)}</td>
                <td>
                  {r.role !== 'admin' && (
                    <Confirm
                      message={`Delete ${r.email} and all their comments, likes and bookmarks?`}
                      onYes={() => void pb.collection('users').delete(r.id).then(load)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function Dashboard() {
  const toast = useToast();
  const [d, setD] = useState<{
    pub: number;
    draft: number;
    pending: number;
    subs: number;
    users: number;
    views: number;
    likes: number;
    top: Rec[];
  } | null>(null);
  useEffect(() => {
    (async () => {
      const n = (c: string, f?: string) =>
        pb
          .collection(c)
          .getList(1, 1, { filter: f })
          .then((r) => r.totalItems);
      const [pub, draft, pending, subs, users, all, top] = await Promise.all([
        n('posts', 'status = "published"'),
        n('posts', 'status = "draft"'),
        n('comments', 'status = "pending"'),
        n('subscribers', 'confirmed = true'),
        n('users'),
        pb.collection('posts').getFullList({ fields: 'views,likes' }),
        pb.collection('posts').getList(1, 5, {
          sort: '-views',
          filter: 'status = "published"',
          fields: 'id,slug,views,likes',
        }),
      ]);
      setD({
        pub,
        draft,
        pending,
        subs,
        users,
        views: all.reduce((a, p) => a + (p.views ?? 0), 0),
        likes: all.reduce((a, p) => a + (p.likes ?? 0), 0),
        top: top.items,
      });
    })().catch((e) => toast(errText(e), 'err'));
  }, [toast]);
  if (!d) return <p className="mono muted">Loading…</p>;
  const card = (label: string, v: number | string, href?: string) => (
    <a className="adm-card" href={href}>
      <b>{v}</b>
      <span className="mono muted">{label}</span>
    </a>
  );
  return (
    <>
      <div className="adm-bar">
        <h1>Dashboard</h1>
        <span className="grow" />
        <a className="adm-btn solid" href="#/posts/new">
          Write a post
        </a>
      </div>
      <div className="adm-cards">
        {card('Published posts', d.pub, '#/posts')}
        {card('Drafts', d.draft, '#/posts')}
        {card('Comments to review', d.pending, '#/comments')}
        {card('Confirmed subscribers', d.subs, '#/subscribers')}
        {card('Users', d.users, '#/users')}
        {card('Total views', d.views)}
        {card('Total likes', d.likes)}
      </div>
      <h2 className="mono muted" style={{ marginTop: 40 }}>
        Most viewed
      </h2>
      <table className="adm-table">
        <tbody>
          {d.top.map((p) => (
            <tr key={p.id}>
              <td>
                <a href={`#/posts/${p.id}`}>/{p.slug}</a>
              </td>
              <td className="mono">{p.views ?? 0} views</td>
              <td className="mono">{p.likes ?? 0} ♥</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export { fileUrl };
