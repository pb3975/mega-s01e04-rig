import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app.js';

const night = process.argv[2] ?? '2026-10-28';
const output = process.argv[3] ?? 'var/preview.html';
const response = await createApp().request(`/digest/${encodeURIComponent(night)}`);
if (!response.ok) throw new Error(`Cannot export digest: HTTP ${response.status}`);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, await response.text());
