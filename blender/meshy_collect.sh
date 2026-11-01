#!/usr/bin/env bash
# Wait for every submitted Meshy job, then save <name>.glb and <name>-preview.png in blender/source/meshy/.
# Usage: bash blender/meshy_collect.sh   (safe to rerun; finished assets are skipped)
set -uo pipefail
cd "$(dirname "$0")/.."
WS=blender/source/meshy
meshy() { npm exec --yes --package=meshy-cli@0.4.0 -- meshy "$@"; }
J='--output-schema v1 --format json --no-update-check'

while IFS=$'\t' read -r name resource id; do
  [ -f "$WS/$name.glb" ] && { echo "have $name"; continue; }
  project="$WS/$name"
  if [ ! -d "$project" ]; then
    meshy project init --root "$WS" --name "$name" --task-id "$id" --task-type "$resource" --workspace "$WS" $J >/dev/null 2>&1
    project=$(ls -d "$WS"/*/ 2>/dev/null | while read -r d; do grep -l "$id" "$d"metadata.json >/dev/null 2>&1 && echo "${d%/}"; done | head -1)
  fi
  echo "waiting $name ($id)"
  meshy "$resource" wait "$id" --timeout 1200 --project "$project" --stage generate --workspace "$WS" $J > "$WS/$name-wait.json" 2>/dev/null
  status=$(python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); print(r.get("ok"), (r.get("result") or {}).get("task",{}).get("status"), (r.get("result") or {}).get("task",{}).get("consumed_credits"))' "$WS/$name-wait.json" 2>/dev/null)
  echo "done $name: $status"
  meshy download --task-json "$project/task_$id.json" --model-format glb --output "$WS/$name.glb" --project "$project" --stage delivered --workspace "$WS" $J >/dev/null 2>&1
  meshy download --task-json "$project/task_$id.json" --asset thumbnail.primary --output "$WS/$name-preview.png" --project "$project" --stage preview --workspace "$WS" $J >/dev/null 2>&1
  ls -la "$WS/$name.glb" "$WS/$name-preview.png" 2>/dev/null
done < "$WS/submissions.tsv"
