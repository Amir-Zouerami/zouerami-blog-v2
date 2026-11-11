// Loads the generated email templates (pb_hooks/emails/*.html|txt, built from web/scripts/emails/design.ts)
// and fills in the action link and site URL. Handlers are isolated, so hooks load this with require().

const SUBJECTS = {
  verify: 'Verify your email for zouerami.dev',
  reset: 'Reset your zouerami.dev password',
  subscribe: 'Confirm your subscription',
};

function read(kind, ext) {
  return toString($os.readFile(`${__hooks}/emails/${kind}.${ext}`));
}

function fill(template, url, siteURL) {
  return template.split('{{URL}}').join(url).split('{{SITE}}').join(siteURL);
}

module.exports = {
  subjectOf: (kind) => SUBJECTS[kind],
  html: (kind, url, siteURL) => fill(read(kind, 'html'), url, siteURL),
  text: (kind, url, siteURL) => fill(read(kind, 'txt'), url, siteURL),
};
