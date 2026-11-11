import { useEffect, useState } from 'react';
import { errText, pb, type Rec } from '../api';
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
