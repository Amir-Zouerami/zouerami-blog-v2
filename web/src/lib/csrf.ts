/** Methods that never change state; exempt from the origin check. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF guard for state-changing API calls. A browser always sends `Origin` on cross-site POST/PUT/DELETE;
 * it must match this site. Requests without `Origin` (curl, server-to-server) carry no cookies of a victim,
 * and cookies are SameSite=Lax anyway.
 */
export function isCrossSiteWrite(
  method: string,
  origin: string | null,
  allowedHosts: readonly string[],
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase()) || !origin) return false;
  try {
    return !allowedHosts.includes(new URL(origin).host);
  } catch {
    return true; // malformed Origin
  }
}
