/// <reference path="../pb_data/types.d.ts" />
// The icon shown beside a project's highlight number (a name from web/src/lib/metricIcons.ts).
migrate(
  (app) => {
    const projects = app.findCollectionByNameOrId('projects');
    projects.fields.add(new TextField({ name: 'metric_icon', max: 40 }));
    app.save(projects);
  },
  (app) => {
    const projects = app.findCollectionByNameOrId('projects');
    projects.fields.removeByName('metric_icon');
    app.save(projects);
  },
);
