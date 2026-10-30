# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
(next) a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

The server binds to `127.0.0.1`; it is intended for local use only. CI uses Node 22 and pnpm
12.2.1. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and
`git diff --check` to reproduce the pull request checks.

Working on it with an agent: start at [AGENTS.md](AGENTS.md).

## Review copies

Export the digest, with the review marker from `.env`, to an ignored HTML file:

```sh
node --env-file=.env --import tsx src/export-preview.ts 2026-10-28 var/preview.html
```

After review, generate a replacement without loading `.env` or inheriting its marker:

```sh
env -u LANE_MARKER node --import tsx src/export-preview.ts 2026-10-28 var/preview.html
```

Upload only that HTML file to the approved public host. Replace it at the same URL after
review, and verify the banner reads `no marker set`. Never commit the HTML.

PR CI captures marker-free board and digest screenshots before and after the change, then
uploads them as the `before-after-screenshots` artifact. Reproduce with an installed system
Chrome or Chromium (no browser download is performed):

```sh
CHROME_BIN=/usr/bin/chromium bash scripts/pr-screenshots.sh origin/main
```

Images go to ignored `var/screenshots/`. The baseline digest screenshot is a 404 when that
route does not exist yet.
