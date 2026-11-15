/// <reference path="../pb_data/types.d.ts" />
// The CV PDFs (one per language), uploaded from the back office and shown on /cv.
migrate(
  (app) => {
    const ADMIN = '@request.auth.role = "admin"';
    app.save(
      new Collection({
        type: 'base',
        name: 'cv_files',
        listRule: '',
        viewRule: '',
        createRule: ADMIN,
        updateRule: ADMIN,
        deleteRule: ADMIN,
        fields: [
          { type: 'select', name: 'lang', required: true, maxSelect: 1, values: ['en', 'fa'] },
          {
            type: 'file',
            name: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 20 * 1024 * 1024,
            mimeTypes: ['application/pdf'],
          },
          { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
          { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_cv_files_lang ON cv_files (lang)'],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('cv_files'));
  },
);
