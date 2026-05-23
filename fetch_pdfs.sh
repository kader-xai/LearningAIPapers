#!/bin/bash
# Download all 10 new paper PDFs and render pages to PNG.
set +e
cd "$(dirname "$0")/content"

PAPERS=(
  "lora|https://arxiv.org/pdf/2106.09685"
  "qlora|https://arxiv.org/pdf/2305.14314"
  "vit|https://arxiv.org/pdf/2010.11929"
  "vae|https://arxiv.org/pdf/1312.6114"
  "gan|https://arxiv.org/pdf/1406.2661"
  "bert|https://arxiv.org/pdf/1810.04805"
  "ddpm|https://arxiv.org/pdf/2006.11239"
  "rag|https://arxiv.org/pdf/2005.11401"
  "gpt-1|https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf"
  "cybertron|https://arxiv.org/pdf/2502.11191"
)

for entry in "${PAPERS[@]}"; do
  slug="${entry%%|*}"
  url="${entry##*|}"
  pdf="$slug/paper.pdf"
  if [ ! -s "$pdf" ]; then
    echo "[$slug] downloading $url ..."
    curl -sL --max-time 120 -o "$pdf" "$url"
  fi
  if [ -s "$pdf" ] && [ ! -f "$slug/pdf-pages/page-01.png" ]; then
    echo "[$slug] rendering pages..."
    pdftoppm -png -r 140 "$pdf" "$slug/pdf-pages/page"
  fi
  npages=$(ls "$slug/pdf-pages" 2>/dev/null | wc -l | tr -d ' ')
  size=$(stat -f%z "$pdf" 2>/dev/null || echo 0)
  echo "[$slug] pdf=${size}B pages=${npages}"
done
echo "All done."
