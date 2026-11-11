import { useEffect, useState } from 'react';

interface State {
  likes: number;
  liked: boolean;
  bookmarked: boolean;
  signedIn: boolean;
}
interface Labels {
  like: string;
  save: string;
  share: string;
  copied: string;
}

/** Like / save / share for one post. Counts come from the server; confetti is lazy-loaded on like. */
export default function PostActions({
  postId,
  loginHref,
  labels,
  locale,
}: {
  postId: string;
  loginHref: string;
  labels: Labels;
  locale: 'en' | 'fa';
}) {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/api/interactions/${postId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setS(d as State))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [postId]);

  const toggle = async (kind: 'like' | 'bookmark') => {
    if (!s?.signedIn) {
      location.assign(`${loginHref}?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/interactions/${postId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      if (r.status === 401) {
        location.assign(`${loginHref}?next=${encodeURIComponent(location.pathname)}`);
        return;
      }
      if (r.ok) {
        const next = (await r.json()) as State;
        if (kind === 'like' && next.liked && !s.liked) burst();
        setS(next);
      }
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0] ?? '');
    } catch {
      /* clipboard blocked: still acknowledge */
    }
    setNote(labels.copied);
    setTimeout(() => setNote(''), 1800);
  };

  const fmt = (n: number) => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n);
  return (
    <div className="acts">
      <button
        type="button"
        className={s?.liked ? 'on' : ''}
        aria-pressed={!!s?.liked}
        onClick={() => toggle('like')}
        data-like
      >
        {labels.like} {s ? fmt(s.likes) : ''}
      </button>
      <button
        type="button"
        className={s?.bookmarked ? 'on' : ''}
        aria-pressed={!!s?.bookmarked}
        onClick={() => toggle('bookmark')}
        data-save
      >
        {labels.save}
      </button>
      <button type="button" onClick={share} data-share-btn>
        {labels.share}
      </button>
      <span className="mono muted" role="status" aria-live="polite" style={{ width: '100%' }}>
        {note}
      </span>
    </div>
  );
}

async function burst() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { default: confetti } = await import('canvas-confetti');
  void confetti({
    particleCount: 70,
    spread: 70,
    origin: { y: 0.7 },
    colors: ['#d4ff3a', '#ecece6', '#2a3bff'],
    disableForReducedMotion: true,
  });
}
