import { useEffect, useState } from 'react';
import Comments from './pages/Comments';
import Dashboard from './pages/Dashboard';
import PostEdit from './pages/PostEdit';
import PostsList from './pages/PostsList';
import ProjectEdit from './pages/ProjectEdit';
import ProjectsList from './pages/ProjectsList';
import Subscribers from './pages/Subscribers';
import Users from './pages/Users';
import { ToastProvider } from './ui';

function useHash() {
  const [h, setH] = useState(() => location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const f = () => setH(location.hash.replace(/^#/, '') || '/');
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
}

const NAV: [string, string][] = [
  ['/', 'Dashboard'],
  ['/posts', 'Posts'],
  ['/projects', 'Projects'],
  ['/comments', 'Comments'],
  ['/subscribers', 'Subscribers'],
  ['/users', 'Users'],
];

export default function AdminApp() {
  const route = useHash();
  const [me, setMe] = useState<{ name: string; role: string } | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.user ?? null))
      .catch(() => setMe(null));
  }, []);

  if (me === undefined)
    return (
      <p className="mono muted" style={{ padding: 40 }}>
        Loading…
      </p>
    );
  if (!me) {
    location.assign('/login?next=/admin');
    return null;
  }
  if (me.role !== 'admin') {
    return (
      <main className="adm-denied">
        <h1>Admins only</h1>
        <p className="muted">You are signed in as {me.name}, but this account is not an admin.</p>
        <a className="adm-btn" href="/">
          Back to the site
        </a>
      </main>
    );
  }

  const [, section, id] = route.split('/');
  let view: React.ReactNode;
  switch (section) {
    case 'posts':
      view = id ? <PostEdit key={id} id={id === 'new' ? null : id} /> : <PostsList />;
      break;
    case 'projects':
      view = id ? <ProjectEdit key={id} id={id === 'new' ? null : id} /> : <ProjectsList />;
      break;
    case 'comments':
      view = <Comments />;
      break;
    case 'subscribers':
      view = <Subscribers />;
      break;
    case 'users':
      view = <Users />;
      break;
    default:
      view = <Dashboard />;
  }
  const active = `/${section ?? ''}`;

  return (
    <ToastProvider>
      <div className="adm">
        <aside className="adm-side">
          <a className="brand" href="#/">
            zouerami<sup>admin</sup>
          </a>
          <nav aria-label="Admin">
            {NAV.map(([href, label]) => (
              <a
                key={href}
                href={`#${href}`}
                className={active === href ? 'on' : ''}
                aria-current={active === href ? 'page' : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="adm-me mono muted">
            {me.name}
            <a href="/" target="_blank" rel="noopener noreferrer">
              View site ↗
            </a>
            <a href="/pb/_/" onClick={(e) => e.preventDefault()} hidden>
              PocketBase
            </a>
          </div>
        </aside>
        <main className="adm-main">{view}</main>
      </div>
    </ToastProvider>
  );
}
