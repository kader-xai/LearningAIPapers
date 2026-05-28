#!/bin/bash
set +e
cd "$(dirname "$0")/content"

PAPERS=(
  "gpt-3|https://arxiv.org/pdf/2005.14165"
  "instructgpt|https://arxiv.org/pdf/2203.02155"
  "agents-survey|https://arxiv.org/pdf/2309.07864"
  "switch-transformers|https://arxiv.org/pdf/2101.03961"
  "distilbert|https://arxiv.org/pdf/1910.01108"
  "llm-int8|https://arxiv.org/pdf/2208.07339"
)

for entry in "${PAPERS[@]}"; do
  slug="${entry%%|*}"
  url="${entry##*|}"
  pdf="$slug/paper.pdf"
  if [ ! -s "$pdf" ]; then
    echo "[$slug] downloading $url"
    curl -sL --max-time 180 -o "$pdf" "$url"
  fi
  if [ -s "$pdf" ] && [ ! -f "$slug/pdf-pages/page-01.png" ]; then
    echo "[$slug] rendering"
    pdftoppm -png -r 140 "$pdf" "$slug/pdf-pages/page" 2>&1 | tail -2
    # zero-pad single-digit filenames if any
    cd "$slug/pdf-pages" 2>/dev/null && for f in page-?.png; do [ -f "$f" ] && mv "$f" "page-0${f#page-}"; done; cd ../..
  fi
  npages=$(ls "$slug/pdf-pages" 2>/dev/null | wc -l | tr -d ' ')
  size=$(stat -f%z "$pdf" 2>/dev/null || echo 0)
  echo "[$slug] pdf=${size}B pages=${npages}"
done
echo "All done."
