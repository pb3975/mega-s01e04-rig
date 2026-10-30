export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  // Owner from the latest event; null is retained and displayed as an em dash.
  owner: string | null;
  // Every valid event counts as a run, including retries and failures.
  runs: number;
  retries: number;
  failures: number;
  lastStatus: RunStatus;
  // Most recent error supplied by an event, even if a later event succeeds.
  lastError: string | null;
  // Chronological endpoints, retaining the original strings and their offsets.
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  // One row per job, sorted by job in ascending code-point order.
  rows: DigestRow[];
  // Nonempty lines that are invalid JSON or fail the event schema.
  badLines: number;
  // Valid event counts, not counts of each job's final status.
  counts: Record<RunStatus, number>;
};

// Implement readNight in src/digest/reader.ts against this signature.
// A missing file or a night outside YYYY-MM-DD returns null. Other I/O errors
// propagate. An empty file returns empty rows, zero badLines and zero counts.
// Equal event times use file order, with the later line treated as latest.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
