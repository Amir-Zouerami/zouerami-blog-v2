import { z } from 'zod';
import type { SessionUser } from './session';

/** The fields of a PocketBase `users` record the web app relies on. */
export const UserRecordSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().optional(),
  role: z.string().optional(),
  verified: z.boolean().optional(),
});
export type UserRecord = z.infer<typeof UserRecordSchema>;

export function toSessionUser(record: unknown): SessionUser {
  const r = UserRecordSchema.parse(record);
  return {
    id: r.id,
    email: r.email,
    name: r.name || r.email,
    role: r.role === 'admin' ? 'admin' : 'user',
  };
}
