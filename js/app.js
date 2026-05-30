// Tiny SPA router + content renderer for the Learning Papers template.
// Route forms:
//   #/                          -> library (list of papers)
//   #/upload                    -> upload instructions
//   #/p/<slug>                  -> first page of paper
//   #/p/<slug>/<sectionIdx>/<pageIdx>

const CONTENT = "content/";
let LIB = null;       // index.json
let PAPER = null;     // currently loaded paper
let PAPER_SLUG = null;

async function fetchJSON(url) {
  const r = await fetch(url + "?_=" + Date.now());
  if (!r.ok) throw new Error("fetch " + url + " -> " + r.status);
  return r.json();
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

function flatPages(paper) {
  const out = [];
  paper.sections.forEach((sec, si) => {
    sec.pages.forEach((pg, pi) => out.push({ sec, si, pg, pi }));
  });
  return out;
}

function renderTOC() {
  const toc = document.getElementById("toc");
  const titleMini = document.getElementById("paper-title-mini");
  if (!PAPER) {
    toc.innerHTML = "";
    titleMini.textContent = "";
    return;
  }
  titleMini.textContent = PAPER.title;
  const hash = location.hash || "";
  const m = hash.match(/^#\/p\/[^/]+\/(\d+)\/(\d+)/);
  const curSi = m ? +m[1] : 0;
  const curPi = m ? +m[2] : 0;
  toc.innerHTML = PAPER.sections.map((sec, si) => {
    const pages = sec.pages.map((pg, pi) => {
      const active = (si === curSi && pi === curPi) ? "active" : "";
      return `<a class="toc-page ${active}" href="#/p/${PAPER_SLUG}/${si}/${pi}">${escapeHTML(pg.title || ("p" + (pi+1)))}</a>`;
    }).join("");
    return `<div class="toc-section">${escapeHTML(sec.title)}</div>${pages}`;
  }).join("");
}

function renderBlock(b) {
  switch (b.type) {
    case "p": return `<p>${b.html || escapeHTML(b.text || "")}</p>`;
    case "quote": return `<blockquote>${b.html || escapeHTML(b.text || "")}</blockquote>`;
    case "h2": return `<h2>${escapeHTML(b.text)}</h2>`;
    case "math": return `<p style="text-align:center; font-size: 18px;">$$${b.tex}$$</p>`;
    case "figure":
      return `<div class="figure">
        ${b.src ? `<img src="${escapeHTML(b.src)}" alt="${escapeHTML(b.alt || "")}" />` : ""}
        ${b.cap ? `<div class="cap">${b.cap}</div>` : ""}
      </div>`;
    case "table":
      return `<table class="tbl">
        <thead><tr>${b.headers.map(h=>`<th>${escapeHTML(h)}</th>`).join("")}</tr></thead>
        <tbody>${b.rows.map(r => `<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
    case "list":
      return `<ul>${b.items.map(i=>`<li>${i}</li>`).join("")}</ul>`;
    default: return "";
  }
}

function renderPage(si, pi) {
  const sec = PAPER.sections[si];
  const pg = sec.pages[pi];
  if (!pg) return renderNotFound();
  const c = document.getElementById("content");
  const pdfPages = pg.pdfPages || (pg.pdfPage ? [pg.pdfPage] : null);
  const pdfBlock = pdfPages ? `
    <div class="pdf-shot-wrap">
      <div class="pdf-shot-head">
        <span class="left"><span class="dot"></span><span class="ttl">paper.pdf — ${escapeHTML(PAPER.title)}</span></span>
        <span>arXiv:1706.03762</span>
      </div>
      <div class="pdf-shot-grid" style="grid-template-columns: repeat(${Math.min(pdfPages.length, 2)}, 1fr);">
        ${pdfPages.map(n => {
          const nn = String(n).padStart(2, "0");
          return `<div class="pdf-shot">
            <img loading="lazy" src="content/${PAPER_SLUG}/pdf-pages/page-${nn}.png" alt="Page ${n} of the paper" />
            <div class="cap">From the original paper · page ${n}</div>
          </div>`;
        }).join("")}
      </div>
    </div>
  ` : "";
  c.innerHTML = `
    <div class="pill">${escapeHTML(sec.title)}</div>
    <h1>${escapeHTML(pg.title || "Untitled")}</h1>
    ${pg.subtitle ? `<h3>${escapeHTML(pg.subtitle)}</h3>` : ""}
    ${pdfBlock}
    ${(pg.blocks || []).map(renderBlock).join("")}
  `;
  // visualizations
  const v = document.getElementById("viz");
  v.innerHTML = "";
  if (pg.viz) {
    const ids = Array.isArray(pg.viz) ? pg.viz : [pg.viz];
    ids.forEach(id => {
      const fn = (window.VIZ || {})[id];
      const box = document.createElement("div");
      v.appendChild(box);
      if (fn) {
        const h = document.createElement("h4");
        h.textContent = "Interactive: " + id.replace(/-/g, " ");
        box.appendChild(h);
        const target = document.createElement("div");
        box.appendChild(target);
        try { fn(target); } catch (e) { target.textContent = "viz error: " + e.message; }
      } else {
        box.innerHTML = `<h4>Viz "${escapeHTML(id)}" not registered</h4>`;
      }
    });
  }
  // pager
  const all = flatPages(PAPER);
  const linearIdx = all.findIndex(x => x.si === si && x.pi === pi);
  const prev = all[linearIdx - 1];
  const next = all[linearIdx + 1];
  const pager = document.getElementById("pager");
  pager.innerHTML = `
    ${prev
      ? `<a href="#/p/${PAPER_SLUG}/${prev.si}/${prev.pi}"><span class="dir">← Previous</span><span class="ttl">${escapeHTML(prev.pg.title)}</span></a>`
      : `<span></span>`}
    <span class="spacer"></span>
    ${next
      ? `<a href="#/p/${PAPER_SLUG}/${next.si}/${next.pi}" style="text-align:right;"><span class="dir">Next →</span><span class="ttl">${escapeHTML(next.pg.title)}</span></a>`
      : `<span></span>`}
  `;
  renderTOC();
  if (window.renderMathInElement) {
    window.renderMathInElement(c, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false
    });
  }
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderNotFound() {
  document.getElementById("content").innerHTML = `<h1>Not found</h1><p>That page doesn't exist.</p>`;
  document.getElementById("viz").innerHTML = "";
  document.getElementById("pager").innerHTML = "";
}

async function renderLibrary() {
  PAPER = null; PAPER_SLUG = null;
  renderTOC();
  document.getElementById("viz").innerHTML = "";
  document.getElementById("pager").innerHTML = "";
  const c = document.getElementById("content");
  if (!LIB) LIB = await fetchJSON(CONTENT + "index.json");
  // group by category, preserving first-seen order
  const groups = [];
  const byCat = {};
  LIB.papers.forEach(p => {
    const cat = p.category || "Other";
    if (!byCat[cat]) { byCat[cat] = []; groups.push(cat); }
    byCat[cat].push(p);
  });
  const card = p => `
    <a class="lib-card" href="#/p/${p.slug}">
      <div class="t">${escapeHTML(p.title)}</div>
      <div class="a">${escapeHTML(p.authors || "")}</div>
      <div class="meta">${escapeHTML(p.year || "")} · ${escapeHTML(p.venue || "")}</div>
    </a>`;
  c.innerHTML = `
    <h1>Learning Papers</h1>
    <h3>A paragraph-by-paragraph reader for ${LIB.papers.length} landmark AI papers — with the original PDF page beside every explanation and interactive visualizations.</h3>
    <p>Pick a paper to start, or <a href="#/upload">add a new one</a>. <span class="pill">${groups.length} topics · ${LIB.papers.length} papers</span></p>
    ${groups.map(cat => `
      <h2 class="lib-cat">${escapeHTML(cat)} <span class="lib-cat-n">${byCat[cat].length}</span></h2>
      <div class="lib-grid">${byCat[cat].map(card).join("")}</div>
    `).join("")}
  `;
}

function renderUpload() {
  PAPER = null; PAPER_SLUG = null;
  renderTOC();
  document.getElementById("viz").innerHTML = "";
  document.getElementById("pager").innerHTML = "";
  document.getElementById("content").innerHTML = `
    <h1>Add a paper</h1>
    <h3>This site is a template. To add a new paper:</h3>
    <ol style="font-family: var(--sans); font-size: 15px; line-height: 1.8;">
      <li>Drop the PDF and any figures into <code>uploads/&lt;your-slug&gt;/</code>.</li>
      <li>Ask Claude in this directory: <em>"Build the learning page for &lt;paper&gt; from uploads/&lt;your-slug&gt;"</em>.</li>
      <li>Claude will generate <code>content/&lt;slug&gt;/paper.json</code> and add the slug to <code>content/index.json</code>.</li>
      <li>Reload — the new paper appears in the library.</li>
    </ol>
    <div class="upload-box" id="drop">
      Drag &amp; drop a PDF here to copy the filename into your clipboard, then ask Claude to ingest it.
      <input type="file" id="file" style="display:block;margin:14px auto;" />
      <div id="dropmsg" style="margin-top:8px;color:var(--ink-dim);font-size:13px"></div>
    </div>
    <h2>paper.json schema</h2>
    <p>Each paper has sections; each section has pages (one per paragraph or key idea). Pages can reference figures via <code>figure</code> blocks and named visualizations via the <code>viz</code> field.</p>
    <pre style="background:var(--panel);padding:14px;border-radius:8px;overflow:auto;font-family:var(--mono);font-size:13px;color:var(--ink-dim);">{
  "title": "...", "authors": "...", "year": "...", "venue": "...",
  "sections": [
    { "title": "1. Introduction",
      "pages": [
        { "title": "Motivation",
          "subtitle": "optional",
          "viz": ["scaled-dot-product-attention"],
          "blocks": [
            { "type": "p", "html": "..." },
            { "type": "math", "tex": "y = Wx + b" },
            { "type": "figure", "src": "content/&lt;slug&gt;/images/fig1.png", "cap": "Figure 1." },
            { "type": "quote", "text": "..." },
            { "type": "list", "items": ["a","b"] },
            { "type": "table", "headers": ["A","B"], "rows": [["1","2"]] }
          ]
        }
      ]
    }
  ]
}</pre>
  `;
  const drop = document.getElementById("drop");
  const file = document.getElementById("file");
  const msg = document.getElementById("dropmsg");
  ["dragenter","dragover"].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add("drag"); }));
  ["dragleave","drop"].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove("drag"); }));
  drop.addEventListener("drop", ev => {
    const f = ev.dataTransfer.files[0];
    if (f) { file.files = ev.dataTransfer.files; msg.textContent = `Selected: ${f.name} — move it into uploads/ then ask Claude.`; }
  });
  file.addEventListener("change", () => { if (file.files[0]) msg.textContent = `Selected: ${file.files[0].name} — move it into uploads/ then ask Claude.`; });
}

async function route() {
  const h = location.hash || "#/";
  if (h === "#/" || h === "#") return renderLibrary();
  if (h === "#/upload") return renderUpload();
  const m = h.match(/^#\/p\/([^/]+)(?:\/(\d+)\/(\d+))?/);
  if (!m) return renderNotFound();
  const slug = m[1];
  if (PAPER_SLUG !== slug) {
    try {
      PAPER = await fetchJSON(CONTENT + slug + "/paper.json");
      PAPER_SLUG = slug;
    } catch (e) {
      return renderNotFound();
    }
  }
  const si = m[2] ? +m[2] : 0;
  const pi = m[3] ? +m[3] : 0;
  renderPage(si, pi);
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);
