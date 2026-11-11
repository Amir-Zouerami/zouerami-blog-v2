/// <reference path="../pb_data/types.d.ts" />
// View counter + draft preview tokens.
// A draft is viewable by anyone who presents its preview_token as ?token=… (rules read @request.query).
migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    posts.fields.add(new NumberField({ name: 'views', onlyInt: true, min: 0 }));
    posts.fields.add(new TextField({ name: 'preview_token', max: 64 }));
    posts.viewRule = 'status = "published" || (preview_token != "" && @request.query.token = preview_token)';
    app.save(posts);

    const tr = app.findCollectionByNameOrId('post_translations');
    const rule = 'post.status = "published" || (post.preview_token != "" && @request.query.token = post.preview_token)';
    tr.listRule = rule;
    tr.viewRule = rule;
    app.save(tr);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    posts.fields.removeByName('views');
    posts.fields.removeByName('preview_token');
    posts.viewRule = 'status = "published"';
    app.save(posts);
    const tr = app.findCollectionByNameOrId('post_translations');
    tr.listRule = 'post.status = "published"';
    tr.viewRule = 'post.status = "published"';
    app.save(tr);
  },
);
