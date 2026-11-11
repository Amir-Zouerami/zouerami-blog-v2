/// <reference path="../pb_data/types.d.ts" />
// Moderation + counters + newsletter double opt-in. (Handlers are isolated: no shared outer scope.)

// A user's first comment is held for review; once one is approved, later comments publish immediately.
onRecordCreateRequest((e) => {
  const user = e.record.get('user');
  const approved = $app.countRecords('comments', $dbx.exp('user = {:u} AND status = "approved"', { u: user }));
  e.record.set('status', approved > 0 ? 'approved' : 'pending');
  let name = 'Anonymous';
  try {
    name = String($app.findRecordById('users', user).get('name') || 'Anonymous').slice(0, 80);
  } catch (_) {}
  e.record.set('author_name', name);
  $app.logger().info('comment submitted', 'userId', user, 'status', e.record.get('status'));
  e.next();
}, 'comments');

// like counter on posts (bookmarks stay private, no counter)
onRecordAfterCreateSuccess((e) => {
  $app.db().newQuery('UPDATE posts SET likes = COALESCE(likes, 0) + 1 WHERE id = {:id}').bind({ id: e.record.get('post') }).execute();
  e.next();
}, 'likes');
onRecordAfterDeleteSuccess((e) => {
  $app.db().newQuery('UPDATE posts SET likes = MAX(COALESCE(likes, 0) - 1, 0) WHERE id = {:id}').bind({ id: e.record.get('post') }).execute();
  e.next();
}, 'likes');

// newsletter: store a token, then email the confirmation link
onRecordCreateRequest((e) => {
  e.record.set('email', String(e.record.get('email')).trim().toLowerCase());
  e.record.set('confirmed', false);
  e.record.set('token', $security.randomString(40));
  e.next();
}, 'subscribers');

onRecordAfterCreateSuccess((e) => {
  e.next();
  const settings = $app.settings();
  const fa = e.record.get('locale') === 'fa';
  const base = String(settings.meta.appURL).replace(/\/$/, '');
  const link = base + (fa ? '/fa' : '') + '/subscribe/confirm?token=' + e.record.get('token');
  try {
    $app.newMailClient().send(
      new MailerMessage({
        from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
        to: [{ address: e.record.get('email') }],
        subject: fa ? 'تأیید عضویت در خبرنامه' : 'Confirm your subscription',
        html: fa
          ? '<p dir="rtl">برای تأیید عضویت روی پیوند زیر بزنید:</p><p dir="rtl"><a href="' + link + '">' + link + '</a></p>'
          : '<p>Confirm your subscription to zouerami.dev:</p><p><a href="' + link + '">' + link + '</a></p>',
      }),
    );
  } catch (err) {
    $app.logger().error('subscribe mail failed', 'error', String(err));
  }
}, 'subscribers');

routerAdd('POST', '/api/subscribers/confirm', (e) => {
  const { traceIdOf, respond } = require(`${__hooks}/lib/envelope.js`);
  const traceId = traceIdOf(e);
  const token = String((e.requestInfo().body || {}).token || '');
  if (token.length < 20) return respond(e, traceId, 400, 'invalid_token', null, 'This link is invalid or already used.');
  try {
    const rec = $app.findFirstRecordByFilter('subscribers', 'token = {:t}', { t: token });
    $app.db().newQuery('UPDATE subscribers SET confirmed = 1 WHERE id = {:id}').bind({ id: rec.id }).execute();
    $app.logger().info('newsletter subscription confirmed', 'traceId', traceId, 'subscriberId', rec.id);
    return respond(e, traceId, 200, 'ok', null, 'Subscription confirmed.');
  } catch (_) {
    $app.logger().warn('newsletter confirmation with unknown token', 'traceId', traceId);
    return respond(e, traceId, 400, 'invalid_token', null, 'This link is invalid or already used.');
  }
});

routerAdd('POST', '/api/subscribers/unsubscribe', (e) => {
  const { traceIdOf, respond } = require(`${__hooks}/lib/envelope.js`);
  const traceId = traceIdOf(e);
  const token = String((e.requestInfo().body || {}).token || '');
  if (token.length < 20) return respond(e, traceId, 400, 'invalid_token', null, 'This link is invalid or already used.');
  try {
    const rec = $app.findFirstRecordByFilter('subscribers', 'token = {:t}', { t: token });
    $app.delete(rec);
    $app.logger().info('newsletter unsubscribed', 'traceId', traceId, 'subscriberId', rec.id);
    return respond(e, traceId, 200, 'ok', null, 'You have been unsubscribed.');
  } catch (_) {
    $app.logger().warn('newsletter unsubscribe with unknown token', 'traceId', traceId);
    return respond(e, traceId, 400, 'invalid_token', null, 'This link is invalid or already used.');
  }
});
