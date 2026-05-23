# Learning AI Papers

A local + GitHub Pages site that walks through landmark AI papers paragraph
by paragraph, with the actual PDF page screenshots next to each explanation,
and interactive visualizations for the core ideas.

🌐 **Live**: <https://LearningAIPapers.github.io>

## Papers included

| # | Paper | arXiv |
|---|---|---|
| 1 | Attention Is All You Need (Transformers) | [1706.03762](https://arxiv.org/abs/1706.03762) |
| 2 | BERT | [1810.04805](https://arxiv.org/abs/1810.04805) |
| 3 | GPT-1 (Improving Language Understanding by Generative Pre-Training) | [OpenAI report](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) |
| 4 | Vision Transformer (ViT) | [2010.11929](https://arxiv.org/abs/2010.11929) |
| 5 | Variational Autoencoder (VAE) | [1312.6114](https://arxiv.org/abs/1312.6114) |
| 6 | Generative Adversarial Networks (GANs) | [1406.2661](https://arxiv.org/abs/1406.2661) |
| 7 | Denoising Diffusion Probabilistic Models (DDPM) | [2006.11239](https://arxiv.org/abs/2006.11239) |
| 8 | LoRA | [2106.09685](https://arxiv.org/abs/2106.09685) |
| 9 | QLoRA | [2305.14314](https://arxiv.org/abs/2305.14314) |
| 10 | RAG (Retrieval-Augmented Generation) | [2005.11401](https://arxiv.org/abs/2005.11401) |
| 11 | PRIMUS (Trend Micro — Cybersecurity LLM datasets) | [2502.11191](https://arxiv.org/abs/2502.11191) |

## Run locally

```bash
python3 serve.py
# → http://localhost:8765/
```

## Add a new paper

1. Drop the PDF in `uploads/<your-slug>/` (or anywhere accessible).
2. In this directory, ask Claude:
   > "Build the learning page for `<paper>` from `uploads/<your-slug>`."
3. Or do it by hand:
   - `mkdir -p content/<slug>/pdf-pages content/<slug>/images`
   - `pdftoppm -png -r 140 paper.pdf content/<slug>/pdf-pages/page`
   - Copy `content/_template/paper.json` and edit it.
   - Add an entry to `content/index.json`.

## paper.json schema

```jsonc
{
  "title": "...", "authors": "...", "year": "...", "venue": "...",
  "sections": [
    {
      "title": "1. Introduction",
      "pages": [
        {
          "title": "Motivation",
          "subtitle": "optional",
          "pdfPages": [1, 2],
          "viz": ["scaled-dot-product-attention"],
          "blocks": [
            { "type": "p", "html": "..." },
            { "type": "math", "tex": "y = Wx + b" },
            { "type": "quote", "html": "..." },
            { "type": "list", "items": ["a", "b"] },
            { "type": "table", "headers": ["A","B"], "rows": [["1","2"]] }
          ]
        }
      ]
    }
  ]
}
```

### Available visualizations

- `scaled-dot-product-attention`, `multi-head-attention`, `positional-encoding`,
  `transformer-architecture`, `attention-heatmap` (Attention paper)
- `lora-decomposition` (LoRA / QLoRA)
- `vit-patchify` (ViT)
- `vae-reparameterize` (VAE)
- `diffusion-forward-reverse` (DDPM)
- `rag-pipeline` (RAG)
- `gan-game` (GAN)
- `bert-mlm` (BERT)

Add new visualizations by appending to `window.VIZ` in `js/viz.js` — each
entry is a `(targetEl) => void` function.

## Layout

```
index.html              # SPA shell
css/style.css
js/app.js               # router + content renderer
js/viz.js               # visualization registry
content/
  index.json            # paper registry
  <slug>/
    paper.json          # paragraph-by-paragraph content
    paper.pdf           # original PDF
    pdf-pages/          # rendered page-NN.png
    images/             # extra figures (optional)
.nojekyll               # required for GitHub Pages with `_` dirs etc.
serve.py                # local static server
fetch_pdfs.sh           # one-shot PDF download + render script
```
