/// <reference path="../pb_data/types.d.ts" />
// The SDK's getFirstListItem uses the list endpoint, so the preview-token rule must apply to listRule too.
migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    posts.listRule = 'status = "published" || (preview_token != "" && @request.query.token = preview_token)';
    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    posts.listRule = 'status = "published"';
    app.save(posts);
  },
);
