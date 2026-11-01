#!/usr/bin/env bash
# Submit Meshy image-to-3D jobs for the cozy room (one submission per asset, asynchronous).
# Usage: bash blender/meshy_batch.sh   (from the repository root, after `meshy auth login --device`)
# Writes blender/source/meshy/submissions.tsv: name, resource, task id.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=output/meshy-reference-assets-2026-10-31/v2
WS=blender/source/meshy
meshy() { npm exec --yes --package=meshy-cli@0.4.0 -- meshy "$@"; }
mkdir -p "$WS"; LOG="$WS/submissions.tsv"; touch "$LOG"

submit() { # name resource args...
  local name=$1 resource=$2; shift 2
  if grep -q "^$name	" "$LOG"; then echo "skip $name (already submitted)"; return; fi
  local out id
  # The Starter plan queues at most 5 tasks; a rejected submission costs nothing, so stop and rerun
  # this script after the current wave finishes (submitted names are skipped).
  out=$(meshy "$resource" create "$@" --target-formats glb --async --operation-id "cozy-$name-$(date +%s)" \
        --output-schema v1 --format json --no-update-check 2>/dev/null) || { echo "queue full at $name; rerun later"; exit 0; }
  id=$(printf '%s' "$out" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["submission"]["task_id"])')
  printf '%s\t%s\t%s\n' "$name" "$resource" "$id" >> "$LOG"; echo "submitted $name $id"
}
views() { local p=$1; shift; local IFS=,; local f=(); for v in "$@"; do f+=("$SRC/$p-$v.png"); done; echo "${f[*]}"; }
MATTE='soft matte clay-like stylised materials, no glossy highlights, true colours from the reference'
TEX=(--should-texture true --enable-pbr true --texture-resolution 4k)

# Characters and hero pieces: consistent turnaround views.
submit guy multi-image-to-3d --image-urls "$(views 01-guy front side back three-quarter)" "${TEX[@]}" --texture-prompt "$MATTE"
submit girl multi-image-to-3d --image-urls "$(views 02-girl front side back three-quarter)" "${TEX[@]}" --texture-prompt "$MATTE"
submit office-chair multi-image-to-3d --image-urls "$(views 04-office-chair front side back three-quarter)" "${TEX[@]}"
submit orange-cushion multi-image-to-3d --image-urls "$(views 29-orange-cushion front side three-quarter)" "${TEX[@]}"
submit gingham-cushion multi-image-to-3d --image-urls "$(views 30-gingham-cushion front side three-quarter)" "${TEX[@]}"
submit large-plant multi-image-to-3d --image-urls "$(views 15-large-plant front side back three-quarter)" "${TEX[@]}"
submit floor-plant multi-image-to-3d --image-urls "$(views 16-floor-plant front side back three-quarter)" "${TEX[@]}"
# Desk props: one clean three-quarter view each.
for p in 20-laptop 21-mug 22-book-stack 25-pencil-cup; do
  submit "${p#*-}" image-to-3d --image-url "$SRC/$p-three-quarter.png" --model-type standard "${TEX[@]}"
done
