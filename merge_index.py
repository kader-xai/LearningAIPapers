#!/usr/bin/env python3
# Merge the 57 new recent papers into content/index.json, only those whose
# paper.json actually exists and is valid. Adds new category groups after the
# existing ones. Idempotent: re-running won't duplicate entries.
import json, os, glob, sys

BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)

idx = json.load(open("content/index.json"))
have = {p["slug"] for p in idx["papers"]}
meta = json.load(open("recent_meta.json"))["papers"]

# new category order (appended after existing)
new_cat_order = ["Modern LLMs (2023-2026)", "Efficient Attention & Architectures",
                 "Reasoning, Agents & RAG", "Alignment & Preference Optimization",
                 "Vision, Multimodal & Diffusion"]

added = []
for m in meta:
    slug = m["slug"]
    pj = f"content/{slug}/paper.json"
    if slug in have:
        continue
    if not os.path.exists(pj):
        print("SKIP (no paper.json):", slug); continue
    try:
        json.load(open(pj))
    except Exception as e:
        print("SKIP (bad json):", slug, e); continue
    idx["papers"].append({
        "slug": slug, "title": m["title"], "authors": m["authors"],
        "year": m["year"], "venue": m["venue"], "category": m["category"],
    })
    added.append(slug)

json.dump(idx, open("content/index.json", "w"), indent=2, ensure_ascii=False)
print(f"Added {len(added)} papers. Total now {len(idx['papers'])}.")
# category counts
from collections import Counter
c = Counter(p["category"] for p in idx["papers"])
for cat in list(dict.fromkeys(p["category"] for p in idx["papers"])):
    print(f"  {c[cat]:3d}  {cat}")
