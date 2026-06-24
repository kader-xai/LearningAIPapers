#!/bin/bash
# Download + render ~58 top AI/ML papers from the last ~3 years (2023-2026).
# Over-provisioned; the OK/FAIL report lets us prune dead arXiv IDs.
set +e
cd "$(dirname "$0")/content"

PAPERS=(
  # --- Modern LLMs ---
  "llama2|2307.09288"
  "llama3|2407.21783"
  "mistral7b|2310.06825"
  "mixtral|2401.04088"
  "gpt4-report|2303.08774"
  "gemini15|2403.05530"
  "deepseek-v3|2412.19437"
  "deepseek-r1|2501.12948"
  "qwen2|2407.10671"
  "gemma|2403.08295"
  "gemma2|2408.00118"
  "phi1|2306.11644"
  "phi3|2404.14219"
  "olmo|2402.00838"
  "tulu3|2411.15124"
  # --- Efficient attention / long context / architecture ---
  "mamba|2312.00752"
  "flashattention2|2307.08691"
  "gqa|2305.13245"
  "rwkv|2305.13048"
  "retnet|2307.08621"
  "jamba|2403.19887"
  "mamba2|2405.21060"
  "bitnet158|2402.17764"
  "ring-attention|2310.01889"
  "streamingllm|2309.17453"
  "vllm|2309.06180"
  "mixture-of-depths|2404.02258"
  "differential-transformer|2410.05258"
  "native-sparse-attention|2502.11089"
  "medusa|2401.10774"
  "yarn|2309.00071"
  # --- Reasoning / agents / RAG ---
  "tree-of-thoughts|2305.10601"
  "toolformer|2302.04761"
  "reflexion|2303.11366"
  "voyager|2305.16291"
  "generative-agents|2304.03442"
  "self-rag|2310.11511"
  "graphrag|2404.16130"
  "raptor|2401.18059"
  "chain-of-verification|2309.11495"
  "deepseek-math-grpo|2402.03300"
  "s1-test-time|2501.19393"
  "self-rewarding|2401.10020"
  # --- Alignment / preference optimization ---
  "dpo|2305.18290"
  "rlaif|2309.00267"
  "orpo|2403.07691"
  "kto|2402.01306"
  # --- Vision / multimodal / generative ---
  "sam|2304.02643"
  "llava|2304.08485"
  "sdxl|2307.01952"
  "consistency-models|2303.01469"
  "controlnet|2302.05543"
  "sd3-rectified-flow|2403.03206"
  "depth-anything|2401.10891"
  "qwen2-vl|2409.12191"
  # --- Scaling / training ---
  "chinchilla|2203.15556"
  "flashattention1|2205.14135"
)

ok=0; fail=0; oklist=""; faillist=""
for entry in "${PAPERS[@]}"; do
  slug="${entry%%|*}"; id="${entry##*|}"
  mkdir -p "$slug/pdf-pages" "$slug/images"
  pdf="$slug/paper.pdf"
  [ -s "$pdf" ] || curl -sL --max-time 180 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" -o "$pdf" "https://arxiv.org/pdf/$id"
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
    rm -rf "$slug"   # remove dead dir so it never reaches the index
  fi
done
echo "=== DONE ok=$ok fail=$fail ==="
echo "OK:$oklist"
echo "FAIL:$faillist"
