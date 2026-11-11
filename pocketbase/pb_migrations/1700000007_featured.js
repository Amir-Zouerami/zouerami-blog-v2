/// <reference path="../pb_data/types.d.ts" />
// Posts can be marked "featured": the blog page shows them in a collage at the top.
migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    posts.fields.add(new BoolField({ name: 'featured' }));
    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    posts.fields.removeByName('featured');
    app.save(posts);
  },
);
