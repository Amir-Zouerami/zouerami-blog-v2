import { useCallback, useEffect, useState } from 'react';
import { errText, pb, type Rec } from '../api';
import { Confirm, fmtDate, useToast } from '../ui';

const postSlug = (c: Rec): string =>
  ((c.expand?.post as Rec | undefined)?.slug as string | undefined) ?? '';

export default function Comments() {
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
