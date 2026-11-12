import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, describe } from '../lib/client-api';
import { Button } from '../ui/Button';

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
  replyingTo: string;
  cancel: string;
  delete: string;
  pending: string;
  pendingNote: string;
  signInToComment: string;
  verifyToComment: string;
  none: string;
  failed: string;
  loadFailed: string;
  loadMore: string;
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
  const [shown, setShown] = useState(3);
  const composerRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    const [list, me] = await Promise.all([
      api<{ comments: Comment[] }>(`/api/comments?post=${postId}`),
      api('/api/auth/me'),
    ]);
    if (!list.ok || !list.data) {
      setFailed(true);
      return;
    }
    setItems(list.data.comments);
    setSignedIn(me.ok);
    setFailed(false);
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  // opening a reply: bring the composer (which sits under the comment being answered) into view and focus it
  useEffect(() => {
    if (!replyTo) return;
    composerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    composerRef.current?.querySelector('textarea')?.focus({ preventScroll: true });
  }, [replyTo]);

  useEffect(() => {
    if (!siteKey || document.getElementById('cf-turnstile-script')) return;
    const s = document.createElement('script');
    s.id = 'cf-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    document.head.appendChild(s);
  }, [siteKey]);

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError('');
    const turnstile =
      (new FormData(e.currentTarget).get('cf-turnstile-response') as string | null) ?? undefined;
    const r = await api<{ pending: boolean }>('/api/comments', {
      json: { post: postId, body: text, parent: replyTo ?? undefined, turnstile },
    });
    setBusy(false);
    if (!r.ok) {
      setError(describe(r, labels.failed));
      return;
    }
    setText('');
    setReplyTo(null);
    setNote(r.data?.pending ? labels.pendingNote : '');
    setShown(Number.MAX_SAFE_INTEGER); // make sure the comment just written is on screen
    await load();
  };

  const remove = async (id: string) => {
    const r = await api(`/api/comments?id=${id}`, { method: 'DELETE' });
    if (r.ok) await load();
  };

  const roots = (items ?? []).filter((c) => !c.parent);
  const replies = (id: string) => (items ?? []).filter((c) => c.parent === id);
  const row = (c: Comment, re = false) => (
    <div
      className={`cmt ${re ? 're' : ''}${replyTo === c.id ? ' replying' : ''}`}
      key={c.id}
      id={`c-${c.id}`}
    >
      <span className="mono muted">
        {c.author} · {ago(c.created, locale)}
      </span>
      <div>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</p>
        <p className="mono muted" style={{ marginTop: 6, display: 'flex', gap: 14 }}>
          {c.pending && <span style={{ color: 'var(--acc)' }}>{labels.pending}</span>}
          {signedIn && !re && !c.pending && (
            <Button variant="link" onClick={() => setReplyTo(c.id)} aria-pressed={replyTo === c.id}>
              {labels.reply}
            </Button>
          )}
          {c.mine && (
            <Button variant="link" onClick={() => remove(c.id)}>
              {labels.delete}
            </Button>
          )}
        </p>
      </div>
    </div>
  );

  /** The comment box. While replying it sits directly under the comment being answered, joined to it by an accent line. */
  const composer = (target?: Comment) => (
    <form
      ref={target ? composerRef : undefined}
      onSubmit={submit}
      className={`auth-form${target ? ' reply-composer' : ''}`}
      style={{ marginTop: target ? 0 : 20 }}
      data-astro-reload
    >
      {target && (
        <div className="reply-head">
          <span className="mono">
            {labels.replyingTo} <strong>{target.author}</strong>
          </span>
          <q className="reply-quote">
            {target.body.length > 140 ? `${target.body.slice(0, 140)}…` : target.body}
          </q>
          <Button variant="link" onClick={() => setReplyTo(null)}>
            {labels.cancel}
          </Button>
        </div>
      )}
      <textarea
        className="area"
        rows={target ? 4 : 3}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={target ? `${labels.replyingTo} ${target.author}…` : labels.placeholder}
        aria-label={target ? `${labels.replyingTo} ${target.author}` : labels.placeholder}
        required
      />
      {siteKey && <div className="cf-turnstile" data-sitekey={siteKey} />}
      <Button size="lg" type="submit" disabled={busy}>
        {target ? labels.reply : labels.post}
      </Button>
      <p className="auth-result" role="alert" data-kind="err">
        {error}
      </p>
    </form>
  );

  return (
    <section style={{ marginTop: 80 }} aria-labelledby="comments-h">
      <div id="comments-h" className="mono muted" style={{ marginBottom: 16 }}>
        {labels.title}
      </div>
      {failed && <p className="mono muted">{labels.loadFailed}</p>}
      {items && roots.length === 0 && !failed && <p className="mono muted">{labels.none}</p>}
      {roots.slice(0, shown).map((c) => (
        <div key={c.id}>
          {row(c)}
          {replies(c.id).map((r) => row(r, true))}
          {signedIn && replyTo === c.id && composer(c)}
        </div>
      ))}
      {roots.length > shown && (
        <div className="cmt-more">
          <Button size="lg" data-load-more onClick={() => setShown((n) => n + 10)}>
            {labels.loadMore}
          </Button>
        </div>
      )}
      {note && (
        <p className="notice" role="status">
          {note}
        </p>
      )}
      {items && !signedIn && (
        <p style={{ marginTop: 24 }}>
          <Button size="lg" href={`${loginHref}?next=${encodeURIComponent(location.pathname)}`}>
            {labels.signInToComment}
          </Button>
        </p>
      )}
      {signedIn && !replyTo && composer()}
    </section>
  );
}
