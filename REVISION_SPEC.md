# Revision spec — deep, intuitive, example-rich paper pages

GOAL: Each page must teach a reader who is smart but NOT an expert. Math-heavy
papers must be made genuinely understandable — without dumbing down the
academic content. Every page should stand on its own as a mini-lesson.

## The 5-layer structure for EVERY page's blocks

Write each page so it moves through these layers (not every layer needs a
header, but the content must be there):

1. **The problem / intuition first.** Open by saying — in plain language — what
   question this page answers and WHY it matters. A reader should know the point
   before any math appears.
2. **A concrete example or analogy.** Make it tangible: a worked mini-example, a
   real sentence, a physical analogy, specific numbers. E.g. for NSP: show two
   actual sentence pairs (one real "next sentence", one random) and what label
   the model must predict, and explain why a QA or NLI system needs this skill.
3. **The full technical detail.** Give the equations as `math` blocks. After
   EVERY equation, add a `p` block that reads it term by term: define every
   symbol, its shape/dimensions, and what each piece does. No undefined notation.
4. **Why it works / design rationale.** Explain the reasoning behind the choice,
   trade-offs, what would break without it, what alternatives were tried.
5. **Context & trivia.** Historical note, how it connects to other papers in the
   collection, what it later influenced, common misconceptions.

## Length & granularity
- Aim for 4–8 substantial blocks per page (mix of `p`, `math`, `list`, `table`,
  `quote`). A page that currently has 2 thin paragraphs should become a full
  lesson.
- If a page is trying to cover too much, SPLIT it into 2 pages (keep pdfPages
  accurate for each).
- Prefer concrete over vague. "BLEU rose from 33.3 to 34.8" beats "scores
  improved". Name datasets, sizes, hyperparameters, author names.
- Define jargon inline the first time: "<b>ablation</b> (removing one component
  to measure its contribution)".

## Block types (schema — unchanged)
- {"type":"p","html":"... inline <b> <i> <code>, inline math $...$ ..."}
- {"type":"quote","html":"verbatim quote from the paper"}
- {"type":"h2","text":"subheading inside a page"}
- {"type":"math","tex":"display equation, NO surrounding $$"}
- {"type":"list","items":["...", "..."]}
- {"type":"table","headers":["A","B"],"rows":[["1","2"]]}

## HARD RULES
- Keep the existing top-level fields: title, authors, year, venue.
- Keep each page's `pdfPages` (verify against the rendered PNGs; fix if wrong).
- Keep each page's `viz` field EXACTLY as-is (only use already-registered viz
  slugs — never invent new ones).
- Output STRICTLY VALID JSON. In JSON, every LaTeX backslash MUST be doubled:
  `\\frac`, `\\sqrt`, `\\sum`, `\\text{...}`, `\\mathbb{R}`, `\\nabla`, `\\mu`,
  `\\sigma`, `\\,`. A single backslash breaks parsing.
- Use straight quotes in HTML attributes; use HTML entities if you need a literal
  quote inside text. Do not put raw newlines inside a JSON string.
- After writing each file, validate:
  `python3 -c "import json; json.load(open('content/<slug>/paper.json'))"`
  and fix until it exits cleanly.

## Reading the source
For each paper, the original pages are rendered at
`content/<slug>/pdf-pages/page-NN.png` (zero-padded). READ the pages a section
maps to (via its pdfPages) before rewriting it, so your explanation is faithful
and you can cite real numbers, equations, and figure references.
