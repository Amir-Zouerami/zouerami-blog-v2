/// <reference path="../pb_data/types.d.ts" />
// Which posts the homepage ("Latest writing") and the blog page's featured collage show, and in what order.
// One record per place: key "home" or "featured", `posts` = the post ids in layout order. No record (or an empty
// list) means "automatic": the website then behaves as it did before this existed. Anyone may read, only admins write.
migrate(
  (app) => {
    const ADMIN = '@request.auth.role = "admin"';
    const layouts = new Collection({
      type: 'base',
      name: 'layouts',
      listRule: '',
      viewRule: '',
      createRule: ADMIN,
      updateRule: ADMIN,
      deleteRule: ADMIN,
      fields: [
        { type: 'text', name: 'key', required: true, max: 40 },
        { type: 'json', name: 'posts', maxSize: 8192 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_layouts_key ON layouts (key)'],
    });
    app.save(layouts);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('layouts'));
  },
);
