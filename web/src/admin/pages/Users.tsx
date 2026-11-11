import { useCallback, useEffect, useState } from 'react';
import type { MenuEntry } from '../../lib/context-menu';
import { errText, pb, type Rec } from '../api';
import { contextMenuProps, copyText, icons, mailTo } from '../contextMenu';
import { Pager, usePaged } from '../Pager';
import { Confirm, fmtDate, useToast } from '../ui';

export default function Users() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const pg = usePaged(rows ?? [], 25);
  const load = useCallback(() => {
    pb.collection('users')
      .getFullList({ sort: '-created' })
      .then(setRows)
      .catch((e) => toast(errText(e), 'err'));
  }, [toast]);
  useEffect(load, [load]);
  const rowMenu = (r: Rec): MenuEntry[] => [
    {
      id: 'copy',
      label: 'Copy email',
      icon: icons.copy,
      onSelect: () => copyText(r.email, toast, 'Email copied'),
    },
    {
      id: 'copy-id',
      label: 'Copy user id',
      icon: icons.copy,
      onSelect: () => copyText(r.id, toast, 'Id copied'),
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
      label: 'Delete user…',
      icon: icons.trash,
      danger: true,
      disabled: r.role === 'admin',
      onSelect: async () => {
        if (!confirm(`Delete ${r.email} and all their comments, likes and bookmarks?`)) return;
        await pb
          .collection('users')
          .delete(r.id)
          .then(load)
          .catch((e) => toast(errText(e), 'err'));
      },
    },
  ];
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
            {pg.items.map((r) => (
              <tr key={r.id} {...contextMenuProps(() => rowMenu(r), 'User actions')}>
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
      <Pager {...pg} />
    </>
  );
}
