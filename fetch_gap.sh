#!/bin/bash
# Fetch the papers missing from the user's 37-item list. id can be an arXiv id
# or a full URL (GPT-2 has no arXiv). Prunes any dead download so it never
# reaches the index.
set +e
cd "$(dirname "$0")/content"

PAPERS=(
  "gpt-2|https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf"
  "scaling-laws|2001.08361"
  "the-pile|2101.00027"
  "palm|2204.02311"
  "opt|2205.01068"
  "bloom|2211.05100"
  "llama1|2302.13971"
  "constitutional-ai|2212.08073"
  "self-instruct|2212.10560"
  "rope|2104.09864"
  "alibi|2108.12409"
  "mqa|1911.02150"
  "speculative-decoding|2211.17192"
  "chain-of-thought|2201.11903"
  "react|2210.03629"
  "deepseekmoe|2401.06066"
  "kv-cache-h2o|2306.14048"
  "muon|2502.16982"
)

ok=0; fail=0; oklist=""; faillist=""
for entry in "${PAPERS[@]}"; do
  slug="${entry%%|*}"; id="${entry##*|}"
  case "$id" in http*) url="$id";; *) url="https://arxiv.org/pdf/$id";; esac
  mkdir -p "$slug/pdf-pages" "$slug/images"
  pdf="$slug/paper.pdf"
  [ -s "$pdf" ] || curl -sL --max-time 180 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" -o "$pdf" "$url"
  if [ -s "$pdf" ] && [ ! -f "$slug/pdf-pages/page-01.png" ]; then
    pdftoppm -png -r 120 "$pdf" "$slug/pdf-pages/page" >/dev/null 2>&1
    cd "$slug/pdf-pages" && for f in page-?.png; do [ -f "$f" ] && mv "$f" "page-0${f#page-}"; done; cd ../..
  fi
  n=$(ls "$slug/pdf-pages"/*.png 2>/dev/null | wc -l | tr -d ' ')
  sz=$(stat -f%z "$pdf" 2>/dev/null || echo 0)
  if [ "$n" -gt 0 ] && [ "$sz" -gt 20000 ]; then
    echo "[OK]   $slug ($id) pages=$n ${sz}B"; ok=$((ok+1)); oklist="$oklist $slug"
  else
    echo "[FAIL] $slug ($id) pages=$n ${sz}B"; fail=$((fail+1)); faillist="$faillist $slug"
    rm -rf "$slug"
  fi
done
echo "=== DONE ok=$ok fail=$fail ==="
echo "OK:$oklist"
echo "FAIL:$faillist"
