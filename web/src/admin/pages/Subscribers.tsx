import { useCallback, useEffect, useState } from 'react';
import type { MenuEntry } from '../../lib/context-menu';
import { errText, pb, type Rec } from '../api';
import { contextMenuProps, copyText, icons, mailTo } from '../contextMenu';
import DateRange from '../DateRange';
import { inRange } from '../date';
import { Pager, usePaged } from '../Pager';
import { Confirm, fmtDate, useToast } from '../ui';

export default function Subscribers() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const visible = (rows ?? []).filter((r) => inRange(r.created, range.from, range.to));
  const pg = usePaged(visible, 25, `${range.from}|${range.to}`);
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
      ...visible.map((r) => `${r.email},${r.confirmed},${r.locale},${r.created}`),
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'subscribers.csv';
    a.click();
  };
  const rowMenu = (r: Rec): MenuEntry[] => [
    {
      id: 'copy',
      label: 'Copy email',
      icon: icons.copy,
      onSelect: () => copyText(r.email, toast, 'Email copied'),
    },
    {
      id: 'mail',
      label: 'Write an email',
      icon: icons.mail,
      onSelect: () => mailTo(r.email),
    },
    { type: 'separator' },
    {
      id: 'delete',
      label: 'Remove…',
      icon: icons.trash,
      danger: true,
      onSelect: async () => {
        if (!confirm(`Remove ${r.email}?`)) return;
        await pb
          .collection('subscribers')
          .delete(r.id)
          .then(load)
          .catch((e) => toast(errText(e), 'err'));
      },
    },
  ];
  const confirmed = visible.filter((r) => r.confirmed).length;
  return (
    <>
      <div className="adm-bar">
        <h1>Subscribers</h1>
        <span className="grow" />
        <DateRange label="Joined" from={range.from} to={range.to} onChange={setRange} />
        <span className="mono muted">
          {confirmed} confirmed / {visible.length} shown
        </span>
        <button type="button" className="adm-btn" onClick={csv} disabled={!visible.length}>
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
            {pg.items.map((r) => (
              <tr key={r.id} {...contextMenuProps(() => rowMenu(r), 'Subscriber actions')}>
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
            {!visible.length && (
              <tr>
                <td colSpan={5} className="muted">
                  No subscribers yet.
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
