/// <reference path="../pb_data/types.d.ts" />
// POST /api/views/{slug}: count one view of a published post. No personal data is stored.
// The client sends at most one beacon per visitor per post per day; bots are ignored here.
// Always answers 200 with the standard envelope (nothing about drafts/unknown slugs is revealed).
routerAdd('POST', '/api/views/{slug}', (e) => {
  const { traceIdOf, respond } = require(`${__hooks}/lib/envelope.js`);
  const traceId = traceIdOf(e);
  const slug = e.request.pathValue('slug');
  const ua = (e.request.header.get('User-Agent') || '').toLowerCase();
  if (!ua || /bot|crawl|spider|slurp|headless|preview|curl|wget|python|monitor|lighthouse/.test(ua)) {
    $app.logger().debug('view ignored (bot)', 'traceId', traceId, 'slug', slug);
    return respond(e, traceId, 200, 'ignored', { counted: false });
  }
  let post;
  try {
    post = $app.findFirstRecordByFilter('posts', 'slug = {:slug} && status = "published"', { slug: slug });
  } catch (_) {
    $app.logger().debug('view ignored (unknown or draft)', 'traceId', traceId, 'slug', slug);
    return respond(e, traceId, 200, 'ignored', { counted: false });
  }
  $app.db().newQuery('UPDATE posts SET views = COALESCE(views, 0) + 1 WHERE id = {:id}').bind({ id: post.id }).execute();
  $app.logger().info('view counted', 'traceId', traceId, 'slug', slug);
  return respond(e, traceId, 200, 'ok', { counted: true });
});
