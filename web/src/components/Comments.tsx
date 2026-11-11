import { useCallback, useEffect, useState } from 'react';

interface Comment {
  id: string;
  body: string;
  created: string;
  parent: string | null;
  author: string;
  pending: boolean;
  mine: boolean;
}
interface Labels {
  title: string;
  placeholder: string;
  post: string;
  reply: string;
  cancel: string;
  delete: string;
  pending: string;
  pendingNote: string;
  signInToComment: string;
  verifyToComment: string;
  none: string;
  failed: string;
  loadFailed: string;
}

function ago(iso: string, locale: 'en' | 'fa'): string {
  const diff = (new Date(iso.replace(' ', 'T')).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === 'fa' ? 'fa' : 'en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [u, sec] of units)
    if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), u);
  return rtf.format(0, 'minute');
}

/** Plain-text comments (React escapes everything: no HTML ever rendered). First comment per user is held. */
export default function Comments({
  postId,
  loginHref,
  labels,
  locale,
  siteKey,
}: {
  postId: string;
  loginHref: string;
  labels: Labels;
  locale: 'en' | 'fa';
  siteKey?: string;
}) {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, me] = await Promise.all([
        fetch(`/api/comments?post=${postId}`),
        fetch('/api/auth/me').then((r) => r.ok),
      ]);
      if (!c.ok) throw new Error('x');
      setItems(((await c.json()) as { comments: Comment[] }).comments);
      setSignedIn(me);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!siteKey || document.getElementById('cf-turnstile-script')) return;
    const s = document.createElement('script');
    s.id = 'cf-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    document.head.appendChild(s);
  }, [siteKey]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError('');
    const turnstile =
      (new FormData(e.currentTarget).get('cf-turnstile-response') as string | null) ?? undefined;
    try {
      const r = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ post: postId, body: text, parent: replyTo ?? undefined, turnstile }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; pending?: boolean };
      if (!r.ok) {
        setError(d.error ?? labels.failed);
        return;
      }
      setText('');
      setReplyTo(null);
      setNote(d.pending ? labels.pendingNote : '');
      await load();
    } catch {
      setError(labels.failed);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const r = await fetch(`/api/comments?id=${id}`, { method: 'DELETE' });
    if (r.ok || r.status === 204) await load();
  };

  const roots = (items ?? []).filter((c) => !c.parent);
  const replies = (id: string) => (items ?? []).filter((c) => c.parent === id);
  const row = (c: Comment, re = false) => (
    <div className={`cmt ${re ? 're' : ''}`} key={c.id} id={`c-${c.id}`}>
      <span className="mono muted">
        {c.author} · {ago(c.created, locale)}
      </span>
      <div>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</p>
        <p className="mono muted" style={{ marginTop: 6, display: 'flex', gap: 14 }}>
          {c.pending && <span style={{ color: 'var(--acc)' }}>{labels.pending}</span>}
          {signedIn && !re && !c.pending && (
            <button
              type="button"
              className="linkbtn"
              onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
            >
              {replyTo === c.id ? labels.cancel : labels.reply}
            </button>
          )}
          {c.mine && (
            <button type="button" className="linkbtn" onClick={() => remove(c.id)}>
              {labels.delete}
            </button>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <section style={{ marginTop: 80 }} aria-labelledby="comments-h">
      <div id="comments-h" className="mono muted" style={{ marginBottom: 16 }}>
        {labels.title}
      </div>
      {failed && <p className="mono muted">{labels.loadFailed}</p>}
      {items && roots.length === 0 && !failed && <p className="mono muted">{labels.none}</p>}
      {roots.map((c) => (
        <div key={c.id}>
          {row(c)}
          {replies(c.id).map((r) => row(r, true))}
        </div>
      ))}
      {note && (
        <p className="notice" role="status">
          {note}
        </p>
      )}
      {items && !signedIn && (
        <p style={{ marginTop: 24 }}>
          <a className="btn" href={`${loginHref}?next=${encodeURIComponent(location.pathname)}`}>
            {labels.signInToComment}
          </a>
        </p>
      )}
      {signedIn && (
        <form onSubmit={submit} style={{ marginTop: 20 }} className="auth-form">
          <textarea
            className="area"
            rows={3}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `${labels.reply}…` : labels.placeholder}
            aria-label={labels.placeholder}
            required
          />
          {siteKey && <div className="cf-turnstile" data-sitekey={siteKey} />}
          <button className="btn" type="submit" disabled={busy}>
            {labels.post}
          </button>
          <p className="auth-result" role="alert" data-kind="err">
            {error}
          </p>
        </form>
      )}
    </section>
  );
}
