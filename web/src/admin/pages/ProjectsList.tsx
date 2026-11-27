import { useEffect, useState } from 'react';
import type { MenuEntry } from '../../lib/context-menu';
import { Button } from '../../ui/Button';
import { errText, pb, type Rec } from '../api';
import { contextMenuProps, copyText, goto, icons, openTab } from '../contextMenu';
import { Pager, usePaged } from '../Pager';
import { useToast } from '../ui';

export default function ProjectsList() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const pg = usePaged(rows ?? [], 25);
  useEffect(() => {
    pb.collection('projects')
      .getFullList({ sort: 'sort,-year' })
      .then(setRows)
      .catch((e) => toast(errText(e), 'err'));
  }, [toast]);
  const [moving, setMoving] = useState(false);
  const reload = () =>
    pb
      .collection('projects')
      .getFullList({ sort: 'sort,-year' })
      .then(setRows)
      .catch((e) => toast(errText(e), 'err'));
  /** Swaps a project with its neighbour; the site lists projects in this order. */
  const move = async (from: number, to: number) => {
    if (!rows || moving || to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[from], next[to]] = [next[to] as Rec, next[from] as Rec];
    const renumbered = next.map((p, i) => ({ ...p, sort: (i + 1) * 10 }));
    setMoving(true);
    setRows(renumbered);
    try {
      for (const p of renumbered)
        if (rows.find((r) => r.id === p.id)?.sort !== p.sort)
          await pb.collection('projects').update(p.id, { sort: p.sort });
    } catch (e) {
      toast(errText(e), 'err');
      await reload();
    } finally {
      setMoving(false);
    }
  };
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
      id: 'preview',
      label: 'Open preview link',
      icon: icons.external,
      hidden: p.status === 'published' || !p.preview_token,
      onSelect: () => openTab(`/work/${p.slug}?token=${p.preview_token}`),
    },
    {
      id: 'copy-preview',
      label: 'Copy preview link',
      icon: icons.link,
      hidden: p.status === 'published' || !p.preview_token,
      onSelect: () =>
        copyText(
          `${location.origin}/work/${p.slug}?token=${p.preview_token}`,
          toast,
          'Preview link copied',
        ),
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
        <Button variant="solid" href="#/projects/new">
          New project
        </Button>
      </div>
      <p className="muted">The site shows projects in this order. Use the arrows to change it.</p>
      {!rows ? (
        <p className="mono muted">Loading…</p>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Year</th>
              <th>Status</th>
              <th>Move</th>
            </tr>
          </thead>
          <tbody>
            {pg.items.map((p) => (
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
                <td>
                  <div className="row-inline">
                    <Button
                      aria-label={`Move ${p.name} up`}
                      disabled={moving || rows[0]?.id === p.id}
                      onClick={() => {
                        const i = rows.findIndex((r) => r.id === p.id);
                        void move(i, i - 1);
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      aria-label={`Move ${p.name} down`}
                      disabled={moving || rows.at(-1)?.id === p.id}
                      onClick={() => {
                        const i = rows.findIndex((r) => r.id === p.id);
                        void move(i, i + 1);
                      }}
                    >
                      ↓
                    </Button>
                  </div>
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
