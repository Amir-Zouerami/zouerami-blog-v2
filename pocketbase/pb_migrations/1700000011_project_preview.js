/// <reference path="../pb_data/types.d.ts" />
// Projects get what posts have: uploaded images for the case study, and draft previews — a draft is readable by anyone who presents its
// preview_token as ?token=… (PocketBase enforces it).
migrate(
  (app) => {
    const ADMIN = '@request.auth.role = "admin"';
    const projects = app.findCollectionByNameOrId('projects');
    projects.fields.add(new TextField({ name: 'preview_token', max: 64 }));
    projects.fields.add(
      new FileField({
        name: 'images',
        maxSelect: 50,
        maxSize: 10485760,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
        thumbs: ['480x0', '960x0', '1600x0'],
      }),
    );
    projects.listRule = `status = "published" || (preview_token != "" && @request.query.token = preview_token) || ${ADMIN}`;
    projects.viewRule = projects.listRule;
    app.save(projects);

    const tr = app.findCollectionByNameOrId('project_translations');
    tr.listRule = `project.status = "published" || (project.preview_token != "" && @request.query.token = project.preview_token) || ${ADMIN}`;
    tr.viewRule = tr.listRule;
    app.save(tr);
  },
  (app) => {
    const ADMIN = '@request.auth.role = "admin"';
    const tr = app.findCollectionByNameOrId('project_translations');
    tr.listRule = `project.status = "published" || ${ADMIN}`;
    tr.viewRule = tr.listRule;
    app.save(tr);

    const projects = app.findCollectionByNameOrId('projects');
    projects.listRule = `status = "published" || ${ADMIN}`;
    projects.viewRule = projects.listRule;
    app.save(projects);
    projects.fields.removeByName('preview_token');
    projects.fields.removeByName('images');
    app.save(projects);
  },
);
