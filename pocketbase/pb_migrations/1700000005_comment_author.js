/// <reference path="../pb_data/types.d.ts" />
// Commenters' display names are public, but user records are private: denormalise the name onto the comment.
migrate(
  (app) => {
    const comments = app.findCollectionByNameOrId('comments');
    comments.fields.add(new TextField({ name: 'author_name', max: 80 }));
    app.save(comments);
  },
  (app) => {
    const comments = app.findCollectionByNameOrId('comments');
    comments.fields.removeByName('author_name');
    app.save(comments);
  },
);
