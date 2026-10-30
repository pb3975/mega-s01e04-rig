#!/usr/bin/env bash
set -euo pipefail

repo=$(git rev-parse --show-toplevel)
base_ref=${1:-origin/main}
output="$repo/var/screenshots"
browser=${CHROME_BIN:-$(command -v google-chrome || command -v chromium)}
scratch=$(mktemp -d)
pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$scratch"
}
trap cleanup EXIT
mkdir -p "$output" "$scratch/baseline"
git archive "$base_ref" | tar -x -C "$scratch/baseline"
ln -s "$repo/node_modules" "$scratch/baseline/node_modules"

capture() {
  local source=$1 label=$2 port=$3
  (cd "$source" && exec env LANE_MARKER= PORT="$port" node --import tsx src/server.ts) >"$scratch/$label.log" 2>&1 &
  pids+=("$!")
  local ready=false
  for attempt in {1..100}; do
    if curl --fail --silent "http://127.0.0.1:$port/health" >/dev/null; then ready=true; break; fi
    sleep 0.1
  done
  if [[ $ready != true ]]; then cat "$scratch/$label.log" >&2; return 1; fi
  for page in status digest; do
    local path=/
    if [[ $page == digest ]]; then path=/digest/2026-10-28; fi
    "$browser" --headless --no-sandbox --disable-gpu --hide-scrollbars \
      --window-size=1440,1000 --screenshot="$output/$page-$label.png" \
      "http://127.0.0.1:$port$path"
  done
}

# No .env loading: CI screenshots must never carry the review marker.
capture "$scratch/baseline" before 18787
capture "$repo" after 18788
