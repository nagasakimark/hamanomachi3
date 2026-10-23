#!/bin/bash
# Usage: scripts/fal-gen.sh <out.jpg> "<prompt>" [image_size] [model]   (needs FAL_KEY; curl so the proxy is used)
out="$1"; prompt="$2"; size="${3:-square_hd}"; model="${4:-fal-ai/flux/schnell}"
body=$(python3 -c 'import json,sys;print(json.dumps({"prompt":sys.argv[1],"image_size":sys.argv[2],"num_inference_steps":4}))' "$prompt" "$size")
url=$(curl -sS -m 90 "https://fal.run/$model" -H "Authorization: Key $FAL_KEY" -H 'Content-Type: application/json' -d "$body" | python3 -c 'import json,sys;print(json.load(sys.stdin)["images"][0]["url"])') || exit 1
curl -sS -m 60 -o "$out" "$url" && echo "$(date -u +%FT%TZ) $model $size $out" >> "$(dirname "$0")/.fal-spend.log" && echo saved "$out"
