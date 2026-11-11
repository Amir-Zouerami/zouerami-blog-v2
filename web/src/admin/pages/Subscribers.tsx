import { useCallback, useEffect, useState } from 'react';
import { errText, pb, type Rec } from '../api';
import { Confirm, fmtDate, useToast } from '../ui';

export default function Subscribers() {
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
