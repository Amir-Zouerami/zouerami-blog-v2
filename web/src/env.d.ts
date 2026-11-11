/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    user: import('./lib/auth/session').SessionUser | null;
    /** UUIDv7 identifying this request; echoed in `x-trace-id`, response bodies and every log line. */
    traceId: string;
    /** Logger bound to `traceId`. */
    log: import('./lib/log').Logger;
  }
}
