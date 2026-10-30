import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { HOST, type RigConfig } from '../src/config.js';

const directories: string[] = [];

function appFor(contents: string, night = '2026-10-28') {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  directories.push(runsDir);
  writeFileSync(join(runsDir, `${night}.jsonl`), contents);
  const config: RigConfig = {
    adapter: 'synthetic', installed: 'synthetic', beatEverySeconds: 60, runsDir,
  };
  return createApp(config);
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('serves the same sorted digest as HTML and JSON, including warnings and escaped values', async () => {
    const events = [
      { at: '2026-10-28T00:00:00Z', job: 'zeta', status: 'fail', owner: null, error: '<script>alert(1)</script>' },
      { at: '2026-10-28T00:01:00Z', job: 'beta', status: 'retry', owner: 'ops', error: 'still trying' },
      { at: '2026-10-28T00:02:00Z', job: 'beta', status: 'retry', owner: 'ops' },
      { at: '2026-10-28T00:03:00Z', job: 'beta', status: 'retry', owner: 'ops' },
      { at: '2026-10-28T00:04:00Z', job: 'beta', status: 'fail', owner: 'ops', error: 'historical failure' },
      { at: '2026-10-28T00:05:00Z', job: 'beta', status: 'ok', owner: 'ops' },
      { at: '2026-10-28T00:06:00Z', job: '<script>job</script>', status: 'ok', owner: '<img src=x>' },
    ];
    const app = appFor(`${events.map((event) => JSON.stringify(event)).join('\n')}\nnot json\n`);

    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-28'), app.request('/api/digest/2026-10-28'),
    ]);
    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json();

    expect(digest.rows.map((row: { job: string }) => row.job)).toEqual([
      '<script>job</script>', 'beta', 'zeta',
    ]);
    expect(digest.badLines).toBe(1);
    expect(digest.rows[1]).toMatchObject({ retries: 3, failures: 1, lastStatus: 'ok' });
    expect(html).toContain('1 malformed line skipped.');
    expect(html.indexOf('<td>beta</td>')).toBeLessThan(html.indexOf('<td>zeta</td>'));
    expect(html).toContain('class="warn">3</td>');
    expect(html).toContain('class="warn">1</td>');
    expect(html).toContain('historical failure');
    expect(html).toContain('&lt;script&gt;job&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x>');
  });

  it('returns 404 for missing and invalid nights from both routes', async () => {
    const app = appFor('{}\n');
    for (const path of ['/digest/2026-10-29', '/api/digest/2026-10-29', '/digest/not-a-night', '/api/digest/not-a-night']) {
      expect((await app.request(path)).status).toBe(404);
    }
  });

  it('renders an empty file as nothing ran and returns an empty JSON digest', async () => {
    const app = appFor('');
    const htmlResponse = await app.request('/digest/2026-10-28');
    const jsonResponse = await app.request('/api/digest/2026-10-28');
    expect(htmlResponse.status).toBe(200);
    expect(await htmlResponse.text()).toContain('nothing ran');
    expect(await jsonResponse.json()).toEqual({ rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('keeps the server host on IPv4 loopback', () => {
    expect(HOST).toBe('127.0.0.1');
  });
});
