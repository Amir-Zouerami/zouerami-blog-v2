/// <reference path="../pb_data/types.d.ts" />
// Accounts-related collections: comments (moderated), likes, bookmarks, subscribers.
migrate(
  (app) => {
    const stamps = [
      { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ];
    const users = app.findCollectionByNameOrId('users');
    const posts = app.findCollectionByNameOrId('posts');

    posts.fields.add(new NumberField({ name: 'likes', onlyInt: true, min: 0 }));
    app.save(posts);

    // users: anyone can sign up, but only the owner can read/update/delete their own record.
    users.createRule = '';
    users.listRule = 'id = @request.auth.id';
    users.viewRule = 'id = @request.auth.id';
    users.updateRule = 'id = @request.auth.id';
    users.deleteRule = 'id = @request.auth.id';
    app.save(users);

    const comments = new Collection({
      type: 'base',
      name: 'comments',
      // approved comments are public; authors also see their own held (pending) ones
      listRule: 'status = "approved" || user = @request.auth.id',
      viewRule: 'status = "approved" || user = @request.auth.id',
      // verified users only, as themselves, on published posts, and they cannot choose the status
      createRule:
        '@request.auth.id != "" && @request.auth.verified = true && @request.body.user = @request.auth.id && @request.body.status:isset = false && @request.body.post.status = "published"',
      updateRule: null,
      deleteRule: 'user = @request.auth.id',
      fields: [
        { type: 'relation', name: 'post', required: true, collectionId: posts.id, cascadeDelete: true, maxSelect: 1 },
        { type: 'relation', name: 'user', required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
        { type: 'text', name: 'body', required: true, min: 1, max: 2000 },
        { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['pending', 'approved', 'rejected'] },
        ...stamps,
      ],
      indexes: ['CREATE INDEX idx_comments_post ON comments (post, status)'],
    });
    app.save(comments);
    // threads (one level): reply → parent
    comments.fields.add(new RelationField({ name: 'parent', collectionId: comments.id, cascadeDelete: true, maxSelect: 1 }));
    app.save(comments);

    for (const name of ['likes', 'bookmarks']) {
      app.save(
        new Collection({
          type: 'base',
          name,
          listRule: 'user = @request.auth.id',
          viewRule: 'user = @request.auth.id',
          createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id && @request.body.post.status = "published"',
          updateRule: null,
          deleteRule: 'user = @request.auth.id',
          fields: [
            { type: 'relation', name: 'post', required: true, collectionId: posts.id, cascadeDelete: true, maxSelect: 1 },
            { type: 'relation', name: 'user', required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
            ...stamps,
          ],
          indexes: [`CREATE UNIQUE INDEX idx_${name}_unique ON ${name} (post, user)`],
        }),
      );
    }

    app.save(
      new Collection({
        type: 'base',
        name: 'subscribers',
        // write-only for the public: nobody can list addresses; double opt-in is enforced by hooks
        listRule: null,
        viewRule: null,
        createRule: '@request.body.confirmed:isset = false && @request.body.token:isset = false',
        updateRule: null,
        deleteRule: null,
        fields: [
          { type: 'email', name: 'email', required: true },
          { type: 'bool', name: 'confirmed' },
          { type: 'text', name: 'token', max: 64 },
          { type: 'select', name: 'locale', maxSelect: 1, values: ['en', 'fa'] },
          ...stamps,
        ],
        indexes: ['CREATE UNIQUE INDEX idx_subscribers_email ON subscribers (email)', 'CREATE INDEX idx_subscribers_token ON subscribers (token)'],
      }),
    );
  },
  (app) => {
    for (const name of ['subscribers', 'bookmarks', 'likes', 'comments']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
    const posts = app.findCollectionByNameOrId('posts');
    posts.fields.removeByName('likes');
    app.save(posts);
  },
);
