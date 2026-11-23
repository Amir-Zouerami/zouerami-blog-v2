/// <reference path="../pb_data/types.d.ts" />
// The social preview of a post is its cover, cropped to 1200x630 (the Open Graph card size).
migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    const cover = posts.fields.getByName('cover');
    cover.thumbs = [...new Set([...(cover.thumbs || []), '1200x630'])];
    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    const cover = posts.fields.getByName('cover');
    cover.thumbs = (cover.thumbs || []).filter((t) => t !== '1200x630');
    app.save(posts);
  },
);
