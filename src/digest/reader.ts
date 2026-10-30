import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (
    typeof event.at !== 'string' ||
    event.at.trim() !== event.at ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(event.at) ||
    !Number.isFinite(Date.parse(event.at)) ||
    new Date(`${event.at.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== event.at.slice(0, 10) ||
    typeof event.job !== 'string' || event.job.trim() === '' ||
    (event.status !== 'ok' && event.status !== 'retry' && event.status !== 'fail') ||
    (event.owner !== null && typeof event.owner !== 'string') ||
    ('error' in event && typeof event.error !== 'string')
  ) return null;
  return event as RunEvent;
}

export const readNight: ReadNight = (runsDir, night) => {
  if (night.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const events: RunEvent[] = [];
  let badLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const event = parseEvent(line);
    if (event) events.push(event);
    else badLines++;
  }
  // Stable sorting keeps file order for events at the same instant.
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const jobs = new Map<string, DigestRow>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  for (const event of events) {
    counts[event.status]++;
    const row = jobs.get(event.job) ?? {
      job: event.job, owner: event.owner, runs: 0, retries: 0, failures: 0,
      lastStatus: event.status, lastError: null, firstAt: event.at, lastAt: event.at,
    };
    row.runs++;
    if (event.status === 'retry') row.retries++;
    if (event.status === 'fail') row.failures++;
    row.owner = event.owner;
    row.lastStatus = event.status;
    if (event.error !== undefined) row.lastError = event.error;
    row.lastAt = event.at;
    jobs.set(event.job, row);
  }
  const rows = [...jobs.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return { rows, badLines, counts };
};
