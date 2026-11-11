/// <reference path="../pb_data/types.d.ts" />
// Applies SMTP + mail-template config from the environment on every boot (idempotent).
onBootstrap((e) => {
  e.next();
  try {
    const siteURL = ($os.getenv('SITE_URL') || '').replace(/\/$/, '');
    const settings = $app.settings();
    if (siteURL) settings.meta.appURL = siteURL;
    settings.meta.appName = 'zouerami';
    const from = $os.getenv('MAIL_FROM') || 'no-reply@zouerami.dev';
    settings.meta.senderAddress = from;
    settings.meta.senderName = 'zouerami';
    const host = $os.getenv('SMTP_HOST');
    if (host) {
      settings.smtp.enabled = true;
      settings.smtp.host = host;
      settings.smtp.port = parseInt($os.getenv('SMTP_PORT') || '587', 10);
      settings.smtp.username = $os.getenv('SMTP_USER') || '';
      settings.smtp.password = $os.getenv('SMTP_PASS') || '';
      settings.smtp.tls = $os.getenv('SMTP_TLS') === 'true';
    }
    // Off-site nightly backups (S3-compatible object storage) + local copies; skipped when S3_* is unset.
    settings.backups.cron = '0 3 * * *';
    settings.backups.cronMaxKeep = 7;
    const bucket = $os.getenv('S3_BACKUP_BUCKET');
    if (bucket) {
      settings.backups.s3.enabled = true;
      settings.backups.s3.bucket = bucket;
      settings.backups.s3.region = $os.getenv('S3_BACKUP_REGION') || 'auto';
      settings.backups.s3.endpoint = $os.getenv('S3_BACKUP_ENDPOINT') || '';
      settings.backups.s3.accessKey = $os.getenv('S3_BACKUP_KEY') || '';
      settings.backups.s3.secret = $os.getenv('S3_BACKUP_SECRET') || '';
      settings.backups.s3.forcePathStyle = $os.getenv('S3_BACKUP_PATH_STYLE') === 'true';
    }
    $app.save(settings);

    // Mail links point at the public site, not the admin UI.
    if (siteURL) {
      const users = $app.findCollectionByNameOrId('users');
      users.verificationTemplate.subject = 'Verify your email for zouerami.dev';
      users.verificationTemplate.body =
        '<p>Hello,</p><p>Confirm your email address to finish creating your account:</p><p><a class="btn" href="' + siteURL + '/verify?token={TOKEN}">Verify email</a></p><p>If you did not sign up, ignore this message.</p>';
      users.resetPasswordTemplate.subject = 'Reset your zouerami.dev password';
      users.resetPasswordTemplate.body =
        '<p>Hello,</p><p>Click below to choose a new password:</p><p><a class="btn" href="' + siteURL + '/reset?token={TOKEN}">Reset password</a></p><p>If you did not ask for this, ignore this message.</p>';
      $app.save(users);
    }
  } catch (err) {
    $app.logger().error('config hook failed', 'error', String(err));
  }
});
