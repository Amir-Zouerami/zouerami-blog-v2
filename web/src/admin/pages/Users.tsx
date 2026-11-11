import { useCallback, useEffect, useState } from 'react';
import { errText, pb, type Rec } from '../api';
import { Confirm, fmtDate, useToast } from '../ui';

export default function Users() {
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
