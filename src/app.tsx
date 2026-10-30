import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/reader.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));
    return digest ? c.json(digest) : c.notFound();
  });

  app.get('/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));
    if (!digest) return c.notFound();
    return c.html(
      <Layout title={`digest ${c.req.param('night')}`} lane={lane()}>
        <DigestPage night={c.req.param('night')} digest={digest} />
      </Layout>,
    );
  });

  app.get('/', (c) => {
    const status = readStatus(config);
    const digests = status.nights.flatMap((night) => {
      const digest = readNight(config.runsDir, night);
      return digest ? [{ night, counts: digest.counts }] : [];
    });
    return c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={status} digests={digests} />
      </Layout>,
    );
  });

  return app;
}
