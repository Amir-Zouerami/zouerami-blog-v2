/// <reference path="../pb_data/types.d.ts" />
// Content schema: posts, post_translations, projects, project_translations.
// Public reads are limited to published content; writes are superuser-only (rule = null).
migrate(
  (app) => {
    const stamps = [
      { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ];
    const imageThumbs = ['480x0', '960x0', '1600x0'];

    const posts = new Collection({
      type: 'base',
      name: 'posts',
      listRule: 'status = "published"',
      viewRule: 'status = "published"',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'text', name: 'slug', required: true, max: 120, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
        { type: 'file', name: 'cover', maxSelect: 1, maxSize: 10485760, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], thumbs: imageThumbs },
        { type: 'date', name: 'date', required: true },
        { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['draft', 'published'] },
        { type: 'json', name: 'tags', maxSize: 4096 },
        { type: 'file', name: 'images', maxSelect: 50, maxSize: 10485760, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'], thumbs: imageThumbs },
        ...stamps,
      ],
      indexes: ['CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)'],
    });
    app.save(posts);

    const postTr = new Collection({
      type: 'base',
      name: 'post_translations',
      listRule: 'post.status = "published"',
      viewRule: 'post.status = "published"',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'relation', name: 'post', required: true, collectionId: posts.id, cascadeDelete: true, maxSelect: 1 },
        { type: 'select', name: 'lang', required: true, maxSelect: 1, values: ['en', 'fa'] },
        { type: 'text', name: 'title', required: true, max: 300 },
        { type: 'text', name: 'summary', max: 1000 },
        { type: 'text', name: 'body_md', max: 500000 },
        ...stamps,
      ],
      indexes: ['CREATE UNIQUE INDEX idx_post_tr_unique ON post_translations (post, lang)'],
    });
    app.save(postTr);

    const projects = new Collection({
      type: 'base',
      name: 'projects',
      listRule: 'status = "published"',
      viewRule: 'status = "published"',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'text', name: 'slug', required: true, max: 120, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
        { type: 'text', name: 'name', required: true, max: 120 },
        { type: 'file', name: 'cover', maxSelect: 1, maxSize: 10485760, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], thumbs: imageThumbs },
        { type: 'number', name: 'year', required: true, onlyInt: true },
        { type: 'select', name: 'category', required: true, maxSelect: 1, values: ['Web App', 'Design System', 'Tool', 'Open Source'] },
        { type: 'json', name: 'stack', maxSize: 4096 },
        { type: 'url', name: 'link_live' },
        { type: 'url', name: 'link_repo' },
        { type: 'number', name: 'metric_value', onlyInt: true },
        { type: 'number', name: 'sort', onlyInt: true },
        { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['draft', 'published'] },
        ...stamps,
      ],
      indexes: ['CREATE UNIQUE INDEX idx_projects_slug ON projects (slug)'],
    });
    app.save(projects);

    const projectTr = new Collection({
      type: 'base',
      name: 'project_translations',
      listRule: 'project.status = "published"',
      viewRule: 'project.status = "published"',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'relation', name: 'project', required: true, collectionId: projects.id, cascadeDelete: true, maxSelect: 1 },
        { type: 'select', name: 'lang', required: true, maxSelect: 1, values: ['en', 'fa'] },
        { type: 'text', name: 'blurb', max: 1000 },
        { type: 'text', name: 'body_md', max: 500000 },
        { type: 'text', name: 'metric_label', max: 120 },
        ...stamps,
      ],
      indexes: ['CREATE UNIQUE INDEX idx_project_tr_unique ON project_translations (project, lang)'],
    });
    app.save(projectTr);
  },
  (app) => {
    for (const name of ['project_translations', 'projects', 'post_translations', 'posts']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
