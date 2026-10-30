import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const dirs: string[] = [];
const night = '2026-10-28';
function runs(text = '') {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  dirs.push(dir);
  writeFileSync(join(dir, `${night}.jsonl`), text);
  return dir;
}

// Synthetic events: checked-in course nights remain read-only.
function event(overrides: Record<string, unknown> = {}) {
  return { at: '2026-10-29T01:00:00+01:00', job: 'job/a', status: 'ok', owner: 'test', ...overrides };
}
function jsonl(events: unknown[]) { return events.map((value) => JSON.stringify(value)).join('\n'); }

afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('night reader', () => {
  it('aggregates the supplied night without dropping recovered jobs or null owners', () => {
    const digest = readNight('runs', night)!;
    expect(digest.badLines).toBe(1);
    expect(digest.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(digest.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(digest.rows[0].owner).toBeNull();
    expect(digest.rows[1]).toMatchObject({ runs: 4, retries: 3, failures: 0, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(digest.rows[2]).toMatchObject({ runs: 8, retries: 1, lastError: 'lock held' });
    expect(digest.rows[3]).toMatchObject({ failures: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(digest.rows.reduce((sum, row) => sum + row.runs, 0)).toBe(15);
  });

  it('uses chronological instants, keeps offsets and uses later file order for ties', () => {
    const latest = '2026-10-29T00:30:00-02:00';
    const earliest = '2026-10-29T02:00:00+02:00';
    const dir = runs(jsonl([
      event({ at: latest, owner: 'first-at-latest' }),
      event({ at: earliest, status: 'fail', error: 'old failure' }),
      event({ at: '2026-10-29T01:00:00Z', status: 'retry', error: 'newer error' }),
      event({ at: '2026-10-29T02:30:00Z', owner: null }),
    ]));
    expect(readNight(dir, night)).toEqual({
      rows: [{ job: 'job/a', owner: null, runs: 4, retries: 1, failures: 1,
        lastStatus: 'ok', lastError: 'newer error', firstAt: earliest, lastAt: '2026-10-29T02:30:00Z' }],
      badLines: 0, counts: { ok: 2, retry: 1, fail: 1 },
    });
  });

  it('counts malformed JSON and event shapes while ignoring blank lines', () => {
    const dir = runs(jsonl([
      null, [], {}, event({ at: 'yesterday' }), event({ at: '2026-02-30T00:00:00Z' }),
      event({ job: '' }), event({ status: 'unknown' }), event({ owner: 1 }), event({ error: null }),
      event({ status: { toString: 'invalid', valueOf: 'invalid' } }),
      event({ at: '2026-10-29T01:00:00Z\n' }), event(),
    ]) + '\n{broken\n\n  \n');
    expect(readNight(dir, night)).toMatchObject({ badLines: 12, counts: { ok: 1, retry: 0, fail: 0 } });
  });

  it('returns a zero digest for an empty night and counts duplicate lines as runs', () => {
    expect(readNight(runs(), night)).toEqual({ rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
    expect(readNight(runs(jsonl([event(), event()])), night)?.rows[0].runs).toBe(2);
  });

  it('returns null for missing nights and rejects path input before accessing disk', () => {
    const dir = runs();
    expect(readNight(dir, '2026-10-27')).toBeNull();
    for (const invalid of ['../2026-10-28', '/2026-10-28', '2026-10-28.jsonl', '2026-10-28\n']) {
      expect(readNight(dir, invalid)).toBeNull();
    }
  });

  it('propagates filesystem errors other than missing files', () => {
    const dir = runs();
    rmSync(join(dir, `${night}.jsonl`));
    mkdirSync(join(dir, `${night}.jsonl`));
    expect(() => readNight(dir, night)).toThrow();
  });
});
