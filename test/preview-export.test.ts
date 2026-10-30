import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('exports self-contained HTML with the selected marker or no marker', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-preview-'));
  try {
    for (const marker of ['SYNTHETIC-PREVIEW-MARKER', '']) {
      const output = join(dir, 'preview.html');
      execFileSync(process.execPath, ['--import', 'tsx', 'src/export-preview.ts', '2026-10-28', output], {
        env: { ...process.env, LANE_MARKER: marker },
      });
      const html = readFileSync(output, 'utf8');
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<style>');
      expect(html).toContain(marker || 'no marker set');
      expect(html).toContain('fixtures/refresh');
      expect(html).not.toMatch(/<script|<link[^>]+stylesheet/);
      if (!marker) expect(html).not.toContain('SYNTHETIC-PREVIEW-MARKER');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
