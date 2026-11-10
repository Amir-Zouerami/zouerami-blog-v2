import PocketBase from 'pocketbase';

export const PB_TEST_URL = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090';

/** True when PocketBase answers /api/health. With REQUIRE_PB=1 an unreachable PocketBase is a hard failure. */
export async function pbIsUp(): Promise<boolean> {
  const up = await fetch(`${PB_TEST_URL}/api/health`)
    .then((r) => r.ok)
    .catch(() => false);
  if (!up && process.env.REQUIRE_PB) throw new Error(`PocketBase unreachable at ${PB_TEST_URL}`);
  return up;
}

export function anonClient(): PocketBase {
  const pb = new PocketBase(PB_TEST_URL);
  pb.autoCancellation(false);
  return pb;
}

export async function adminClient(): Promise<PocketBase | null> {
  const email = process.env.PB_SUPERUSER_EMAIL;
  const password = process.env.PB_SUPERUSER_PASSWORD;
  if (!email || !password) return null;
  const pb = anonClient();
  await pb.collection('_superusers').authWithPassword(email, password);
  return pb;
}
