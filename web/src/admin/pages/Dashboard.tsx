import { useEffect, useState } from 'react';
import { errText, pb, type Rec } from '../api';
import { useToast } from '../ui';

export default function Dashboard() {
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
