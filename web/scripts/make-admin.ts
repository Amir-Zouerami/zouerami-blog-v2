/** Promote (or create) an admin user: `bun run make-admin you@example.com [password]` (needs PB_SUPERUSER_* in ../.env). */
import PocketBase from 'pocketbase';

const [email, password] = process.argv.slice(2);
if (!email) throw new Error('usage: bun run make-admin <email> [password-for-new-user]');
const pb = new PocketBase(process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090');
await pb
  .collection('_superusers')
  .authWithPassword(process.env.PB_SUPERUSER_EMAIL ?? '', process.env.PB_SUPERUSER_PASSWORD ?? '');
const existing = await pb
  .collection('users')
  .getFirstListItem(pb.filter('email = {:e}', { e: email }))
  .catch(() => null);
if (existing) {
  await pb.collection('users').update(existing.id, { role: 'admin', verified: true });
  console.log(`${email} is now an admin`);
} else {
  if (!password || password.length < 10)
    throw new Error('user does not exist: pass a password (min 10 chars) to create it');
  await pb.collection('users').create({
    email,
    password,
    passwordConfirm: password,
    name: 'Admin',
    verified: true,
    role: 'admin',
  });
  console.log(`created admin ${email}`);
}
