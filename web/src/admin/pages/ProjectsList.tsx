import { useEffect, useState } from 'react';
import type { MenuEntry } from '../../lib/context-menu';
import { errText, pb, type Rec } from '../api';
import { contextMenuProps, copyText, goto, icons, openTab } from '../contextMenu';
import { useToast } from '../ui';

export default function ProjectsList() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  useEffect(() => {
    pb.collection('projects')
      .getFullList({ sort: 'sort,-year' })
      .then(setRows)
      .catch((e) => toast(errText(e), 'err'));
  }, [toast]);
  const reload = () =>
    pb
      .collection('projects')
      .getFullList({ sort: 'sort,-year' })
      .then(setRows)
      .catch((e) => toast(errText(e), 'err'));
  const rowMenu = (p: Rec): MenuEntry[] => [
    {
      id: 'edit',
      label: 'Edit',
      icon: icons.edit,
      onSelect: () => goto(`#/projects/${p.id}`),
    },
    {
      id: 'open',
      label: 'View on site',
      icon: icons.external,
      hidden: p.status !== 'published',
      onSelect: () => openTab(`/work/${p.slug}`),
    },
    {
      id: 'copy',
      label: 'Copy public link',
      icon: icons.link,
      hidden: p.status !== 'published',
      onSelect: () => copyText(`${location.origin}/work/${p.slug}`, toast, 'Link copied'),
    },
    { type: 'separator' },
    {
      id: 'toggle',
      label: p.status === 'published' ? 'Unpublish' : 'Publish',
      icon: p.status === 'published' ? icons.eyeOff : icons.check,
      onSelect: async () => {
        try {
          await pb
            .collection('projects')
            .update(p.id, { status: p.status === 'published' ? 'draft' : 'published' });
          await reload();
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
        if (!confirm(`Delete "${p.name}" and its translations?`)) return;
        try {
          await pb.collection('projects').delete(p.id);
          toast('Project deleted');
          await reload();
        } catch (e) {
          toast(errText(e), 'err');
        }
      },
    },
  ];
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
              <tr key={p.id} {...contextMenuProps(() => rowMenu(p), 'Project actions')}>
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
