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
