#!/bin/bash
# Download + render the 34 new papers (batch 3). Renders at 120 dpi to manage repo size.
set +e
cd "$(dirname "$0")/content"

PAPERS=(
  # Computer Vision / Image Recognition
  "detr|https://arxiv.org/pdf/2005.12872"
  "mobilenetv3|https://arxiv.org/pdf/1905.02244"
  "resnet|https://arxiv.org/pdf/1512.03385"
  "adain|https://arxiv.org/pdf/1703.06868"
  "neural-style-transfer|https://www.cv-foundation.org/openaccess/content_cvpr_2016/papers/Gatys_Image_Style_Transfer_CVPR_2016_paper.pdf"
  "faster-rcnn|https://arxiv.org/pdf/1506.01497"
  # NLP
  "sha-rnn|https://arxiv.org/pdf/1911.11423"
  "nmt-align-translate|https://arxiv.org/pdf/1409.0473"
  "show-and-tell|https://arxiv.org/pdf/1411.4555"
  "seq2seq|https://arxiv.org/pdf/1409.3215"
  # Generative Models & Super Resolution
  "meta-transfer-sr|https://arxiv.org/pdf/2002.12213"
  "singan|https://arxiv.org/pdf/1905.01164"
  "stylegan|https://arxiv.org/pdf/1812.04948"
  "stargan|https://arxiv.org/pdf/1711.09020"
  "pix2pix|https://arxiv.org/pdf/1611.07004"
  # Modeling & Optimization
  "bag-of-tricks|https://arxiv.org/pdf/1812.01187"
  "deep-compression|https://arxiv.org/pdf/1510.00149"
  "batchnorm|https://arxiv.org/pdf/1502.03167"
  # Adversarial Examples & Backdoor Attacks
  "hopskipjump|https://arxiv.org/pdf/1904.02144"
  "breaking-certified-defenses|https://arxiv.org/pdf/2003.08937"
  "sign-opt|https://arxiv.org/pdf/1909.10773"
  "textfooler|https://arxiv.org/pdf/1907.11932"
  "query-efficient-hardlabel|https://arxiv.org/pdf/1807.04457"
  "momentum-attack|https://arxiv.org/pdf/1710.06081"
  "poison-frogs|https://arxiv.org/pdf/1804.00792"
  "decision-based-attack|https://arxiv.org/pdf/1712.04248"
  # Older Adversarial-Robustness
  "fgsm|https://arxiv.org/pdf/1412.6572"
  "carlini-wagner|https://arxiv.org/pdf/1608.04644"
  "pgd-madry|https://arxiv.org/pdf/1706.06083"
  "adv-features|https://arxiv.org/pdf/1905.02175"
  "cert-robust-dp|https://arxiv.org/pdf/1802.03471"
  "obfuscated-gradients|https://arxiv.org/pdf/1802.00420"
  "unrestricted-adv|https://arxiv.org/pdf/1805.07894"
  "adversarial-patch|https://arxiv.org/pdf/1712.09665"
)

ok=0; fail=0
for entry in "${PAPERS[@]}"; do
  slug="${entry%%|*}"
  url="${entry##*|}"
  mkdir -p "$slug/pdf-pages" "$slug/images"
  pdf="$slug/paper.pdf"
  if [ ! -s "$pdf" ]; then
    curl -sL --max-time 180 -A "Mozilla/5.0" -o "$pdf" "$url"
  fi
  if [ -s "$pdf" ] && [ ! -f "$slug/pdf-pages/page-01.png" ]; then
    pdftoppm -png -r 120 "$pdf" "$slug/pdf-pages/page" >/dev/null 2>&1
    cd "$slug/pdf-pages" 2>/dev/null && for f in page-?.png; do [ -f "$f" ] && mv "$f" "page-0${f#page-}"; done; cd ../..
  fi
  npages=$(ls "$slug/pdf-pages" 2>/dev/null | wc -l | tr -d ' ')
  size=$(stat -f%z "$pdf" 2>/dev/null || echo 0)
  if [ "$npages" -gt 0 ] && [ "$size" -gt 1000 ]; then
    echo "[OK]   $slug  pages=$npages  ${size}B"; ok=$((ok+1))
  else
    echo "[FAIL] $slug  pages=$npages  ${size}B  url=$url"; fail=$((fail+1))
  fi
done
echo "=== DONE  ok=$ok fail=$fail ==="
