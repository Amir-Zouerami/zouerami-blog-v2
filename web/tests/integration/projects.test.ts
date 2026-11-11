import { describe, expect, it } from 'vitest';
import { getProject, listProjects } from '../../src/lib/projects';
import { anonClient, pbIsUp } from './helpers';

const up = await pbIsUp();

describe.skipIf(!up)('projects data layer', () => {
  it('lists published projects in sort order with blurb and metric', async () => {
    const list = await listProjects({}, anonClient());
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0]).toMatchObject({ slug: 'lumen', name: 'Lumen', metricValue: 48 });
    expect(list[0]?.blurb).toBeTruthy();
  });
  it('honours limit', async () => {
    expect(await listProjects({ limit: 1 }, anonClient())).toHaveLength(1);
  });
  it('getProject returns null for unknown or malformed slugs', async () => {
    expect(await getProject('nope', 'en', anonClient())).toBeNull();
    expect(await getProject('x" || 1=1 || "', 'en', anonClient())).toBeNull();
  });
  it('getProject returns the en project', async () => {
    expect((await getProject('lumen', 'en', anonClient()))?.name).toBe('Lumen');
  });
});
