/// <reference path="../pb_data/types.d.ts" />
// POST /api/views/{slug}: count one view of a published post. No personal data is stored.
// The client sends at most one beacon per visitor per post per day; bots are ignored here.
routerAdd('POST', '/api/views/{slug}', (e) => {
  const ua = (e.request.header.get('User-Agent') || '').toLowerCase();
  if (!ua || /bot|crawl|spider|slurp|headless|preview|curl|wget|python|monitor|lighthouse/.test(ua)) {
    return e.noContent(204);
  }
  let post;
  try {
    post = $app.findFirstRecordByFilter('posts', 'slug = {:slug} && status = "published"', { slug: e.request.pathValue('slug') });
  } catch (_) {
    return e.noContent(204); // unknown or draft: do not reveal anything
  }
  $app.db().newQuery('UPDATE posts SET views = COALESCE(views, 0) + 1 WHERE id = {:id}').bind({ id: post.id }).execute();
  return e.noContent(204);
});
