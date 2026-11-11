/// <reference path="../pb_data/types.d.ts" />
// Back office: users with role = "admin" may manage content through the web app.
// The web app never holds superuser credentials; PocketBase enforces this role on every request.
migrate(
  (app) => {
    const ADMIN = '@request.auth.role = "admin"';

    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new SelectField({ name: 'role', maxSelect: 1, values: ['user', 'admin'] }));
    // nobody can promote themselves: role is not writable through the API by non-superusers
    users.listRule = `id = @request.auth.id || ${ADMIN}`;
    users.viewRule = `id = @request.auth.id || ${ADMIN}`;
    users.updateRule = 'id = @request.auth.id && @request.body.role:isset = false';
    users.deleteRule = `id = @request.auth.id || ${ADMIN}`;
    users.createRule = '@request.body.role:isset = false && @request.body.verified:isset = false';
    app.save(users);

    const posts = app.findCollectionByNameOrId('posts');
    const token = 'preview_token != "" && @request.query.token = preview_token';
    posts.listRule = `status = "published" || (${token}) || ${ADMIN}`;
    posts.viewRule = posts.listRule;
    posts.createRule = ADMIN;
    posts.updateRule = ADMIN;
    posts.deleteRule = ADMIN;
    app.save(posts);

    const trToken = 'post.preview_token != "" && @request.query.token = post.preview_token';
    const tr = app.findCollectionByNameOrId('post_translations');
    tr.listRule = `post.status = "published" || (${trToken}) || ${ADMIN}`;
    tr.viewRule = tr.listRule;
    tr.createRule = ADMIN;
    tr.updateRule = ADMIN;
    tr.deleteRule = ADMIN;
    app.save(tr);

    const projects = app.findCollectionByNameOrId('projects');
    projects.listRule = `status = "published" || ${ADMIN}`;
    projects.viewRule = projects.listRule;
    projects.createRule = ADMIN;
    projects.updateRule = ADMIN;
    projects.deleteRule = ADMIN;
    app.save(projects);

    const ptr = app.findCollectionByNameOrId('project_translations');
    ptr.listRule = `project.status = "published" || ${ADMIN}`;
    ptr.viewRule = ptr.listRule;
    ptr.createRule = ADMIN;
    ptr.updateRule = ADMIN;
    ptr.deleteRule = ADMIN;
    app.save(ptr);

    const comments = app.findCollectionByNameOrId('comments');
    comments.listRule = `status = "approved" || user = @request.auth.id || ${ADMIN}`;
    comments.viewRule = comments.listRule;
    comments.updateRule = ADMIN;
    comments.deleteRule = `user = @request.auth.id || ${ADMIN}`;
    app.save(comments);

    const subs = app.findCollectionByNameOrId('subscribers');
    subs.listRule = ADMIN;
    subs.viewRule = ADMIN;
    subs.updateRule = ADMIN;
    subs.deleteRule = ADMIN;
    app.save(subs);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('role');
    users.listRule = 'id = @request.auth.id';
    users.viewRule = 'id = @request.auth.id';
    users.deleteRule = 'id = @request.auth.id';
    users.createRule = '';
    app.save(users);
  },
);
