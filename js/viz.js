// Visualization registry. Each entry is a function (target) -> void
// that mounts an interactive demo into `target`.
window.VIZ = {};

// --- helpers --------------------------------------------------------------
function svgNS(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}
function lerpColor(t) {
  // viridis-ish: deep purple -> teal -> yellow
  const stops = [
    [0.00, [68, 1, 84]],
    [0.25, [59, 82, 139]],
    [0.50, [33, 145, 140]],
    [0.75, [94, 201, 98]],
    [1.00, [253, 231, 37]],
  ];
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, c1] = stops[i], [b, c2] = stops[i + 1];
    if (t >= a && t <= b) {
      const u = (t - a) / (b - a);
      const c = c1.map((v, j) => Math.round(v + u * (c2[j] - v)));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "#000";
}
function softmax(arr) {
  const m = Math.max(...arr);
  const ex = arr.map(v => Math.exp(v - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map(v => v / s);
}

// --- 1. Scaled Dot-Product Attention --------------------------------------
// User sets d_k. Random Q, K vectors are drawn for n tokens; we plot
// QKᵀ, QKᵀ / sqrt(d_k), and softmax of that. Lets the learner *see* why
// the scale factor matters.
VIZ["scaled-dot-product-attention"] = function (root) {
  const N = 6;
  let dk = 8;
  let seed = 1;

  const wrap = document.createElement("div");
  root.appendChild(wrap);
  wrap.innerHTML = `
    <div class="controls">
      <label>n tokens: <b id="sdp-n">${N}</b></label>
      <label>d<sub>k</sub>: <input type="range" id="sdp-dk" min="2" max="256" step="1" value="${dk}"> <b id="sdp-dkv">${dk}</b></label>
      <button id="sdp-reseed">Resample Q,K</button>
      <label><input type="checkbox" id="sdp-scale" checked> divide by √d<sub>k</sub></label>
    </div>
    <div id="sdp-mats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-family:var(--sans);font-size:12px;color:var(--ink-dim);text-align:center;"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      Without scaling, dot products grow like √d<sub>k</sub>. Softmax then saturates → gradients vanish. Try sliding d<sub>k</sub> up with scaling off.
    </div>
  `;

  function rand(seed) {
    // mulberry32
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {
    const u = Math.max(rng(), 1e-9), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function build() {
    const rng = rand(seed);
    const Q = [], K = [];
    for (let i = 0; i < N; i++) {
      Q.push(Array.from({ length: dk }, () => gauss(rng)));
      K.push(Array.from({ length: dk }, () => gauss(rng)));
    }
    const scale = document.getElementById("sdp-scale").checked;
    const raw = []; for (let i = 0; i < N; i++) { raw.push([]); for (let j = 0; j < N; j++) {
      let s = 0; for (let d = 0; d < dk; d++) s += Q[i][d] * K[j][d];
      raw[i].push(s);
    }}
    const scaled = raw.map(row => row.map(v => scale ? v / Math.sqrt(dk) : v));
    const sm = scaled.map(row => softmax(row));
    return { raw, scaled, sm };
  }
  function heat(matrix, title) {
    const flat = matrix.flat();
    const min = Math.min(...flat), max = Math.max(...flat);
    const cell = 32, pad = 6;
    const size = cell * N + pad * 2;
    const svg = svgNS("svg", { width: size, height: size + 18 });
    matrix.forEach((row, i) => row.forEach((v, j) => {
      const t = (v - min) / Math.max(1e-9, max - min);
      svg.appendChild(svgNS("rect", { x: pad + j * cell, y: pad + i * cell, width: cell - 1, height: cell - 1, fill: lerpColor(t) }));
      const txt = svgNS("text", { x: pad + j * cell + cell / 2, y: pad + i * cell + cell / 2 + 4,
        "text-anchor": "middle", "font-size": "9", fill: t > 0.55 ? "#111" : "#fff", "font-family": "var(--mono)" });
      txt.textContent = v.toFixed(1);
      svg.appendChild(txt);
    }));
    const lbl = svgNS("text", { x: size / 2, y: size + 14, "text-anchor": "middle", "font-size": "11", fill: "#9aa3b2" });
    lbl.textContent = title;
    svg.appendChild(lbl);
    const w = document.createElement("div");
    w.appendChild(svg);
    return w;
  }
  function redraw() {
    document.getElementById("sdp-dkv").textContent = dk;
    const { raw, scaled, sm } = build();
    const host = document.getElementById("sdp-mats");
    host.innerHTML = "";
    host.appendChild(heat(raw, "QKᵀ"));
    host.appendChild(heat(scaled, "QKᵀ / √dₖ"));
    host.appendChild(heat(sm, "softmax"));
  }
  document.getElementById("sdp-dk").addEventListener("input", e => { dk = +e.target.value; redraw(); });
  document.getElementById("sdp-reseed").addEventListener("click", () => { seed = (seed * 9301 + 49297) % 233280; redraw(); });
  document.getElementById("sdp-scale").addEventListener("change", redraw);
  redraw();
};

// --- 2. Multi-head attention diagram --------------------------------------
VIZ["multi-head-attention"] = function (root) {
  let h = 8;
  const dmodel = 512;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>heads h: <input type="range" id="mh" min="1" max="16" step="1" value="${h}"> <b id="mhv">${h}</b></label>
      <label>d<sub>model</sub>: <b>${dmodel}</b></label>
      <label>d<sub>k</sub> = d<sub>v</sub> = d<sub>model</sub>/h: <b id="dkv">${dmodel/h}</b></label>
    </div>
    <div id="mhviz"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      Splitting d<sub>model</sub> across h heads keeps total compute roughly constant while letting each head attend to a different subspace.
    </div>
  `;
  function redraw() {
    document.getElementById("mhv").textContent = h;
    document.getElementById("dkv").textContent = (dmodel / h).toFixed(1);
    const W = 640, H = 220, pad = 30;
    const svg = svgNS("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    // input bar
    svg.appendChild(svgNS("rect", { x: pad, y: 20, width: W - pad*2, height: 22, fill: "#1d2230", stroke: "#7aa2ff" }));
    const lab = svgNS("text", { x: W/2, y: 36, "text-anchor": "middle", "font-size": 12, fill: "#e6e8ee", "font-family": "var(--mono)" });
    lab.textContent = `input · d_model = ${dmodel}`;
    svg.appendChild(lab);
    // heads
    const headW = (W - pad*2) / h;
    for (let i = 0; i < h; i++) {
      const x = pad + i * headW;
      const colors = ["#7aa2ff","#b48cff","#6ad7a3","#f0b86e","#ff7b9c","#5bd0e0","#dcd271","#a3a8b8"];
      const c = colors[i % colors.length];
      svg.appendChild(svgNS("rect", { x: x+2, y: 80, width: headW-4, height: 50, fill: c, opacity: 0.75, rx: 6 }));
      const t = svgNS("text", { x: x + headW/2, y: 108, "text-anchor":"middle", "font-size": 11, fill: "#0f1115", "font-family":"var(--mono)" });
      t.textContent = `h${i+1}`;
      svg.appendChild(t);
      // connecting lines
      svg.appendChild(svgNS("line", { x1: x+headW/2, y1: 42, x2: x+headW/2, y2: 80, stroke: c, "stroke-width": 1.5 }));
      svg.appendChild(svgNS("line", { x1: x+headW/2, y1: 130, x2: x+headW/2, y2: 170, stroke: c, "stroke-width": 1.5 }));
    }
    // concat
    svg.appendChild(svgNS("rect", { x: pad, y: 170, width: W - pad*2, height: 22, fill: "#1d2230", stroke: "#b48cff" }));
    const lab2 = svgNS("text", { x: W/2, y: 186, "text-anchor": "middle", "font-size": 12, fill: "#e6e8ee", "font-family": "var(--mono)" });
    lab2.textContent = `concat → W^O → output · d_model = ${dmodel}`;
    svg.appendChild(lab2);
    const v = document.getElementById("mhviz");
    v.innerHTML = "";
    v.appendChild(svg);
  }
  document.getElementById("mh").addEventListener("input", e => { h = +e.target.value; redraw(); });
  redraw();
};

// --- 3. Positional encoding heatmap ---------------------------------------
VIZ["positional-encoding"] = function (root) {
  let pos = 50, dmodel = 64;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>max position: <input type="range" id="pe-pos" min="10" max="200" step="5" value="${pos}"> <b id="pe-posv">${pos}</b></label>
      <label>d<sub>model</sub>: <input type="range" id="pe-d" min="8" max="128" step="8" value="${dmodel}"> <b id="pe-dv">${dmodel}</b></label>
    </div>
    <div id="pe-canvas"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      PE(pos, 2i) = sin(pos / 10000^(2i/d)). PE(pos, 2i+1) = cos(pos / 10000^(2i/d)). Each column is one position; vertical stripes are dimensions oscillating at different frequencies.
    </div>
  `;
  function redraw() {
    document.getElementById("pe-posv").textContent = pos;
    document.getElementById("pe-dv").textContent = dmodel;
    const w = 6, hcell = 4;
    const W = w * pos + 30, H = hcell * dmodel + 20;
    const svg = svgNS("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    for (let p = 0; p < pos; p++) for (let i = 0; i < dmodel; i++) {
      const den = Math.pow(10000, (2 * Math.floor(i/2)) / dmodel);
      const val = (i % 2 === 0) ? Math.sin(p / den) : Math.cos(p / den);
      const t = (val + 1) / 2;
      svg.appendChild(svgNS("rect", { x: 20 + p*w, y: 10 + i*hcell, width: w, height: hcell, fill: lerpColor(t) }));
    }
    // axes
    const ay = svgNS("text", { x: 8, y: 20, "font-size": 10, fill: "#9aa3b2", transform: `rotate(-90 8 20)` });
    ay.textContent = "dim →";
    svg.appendChild(ay);
    const ax = svgNS("text", { x: W/2, y: H-4, "font-size": 10, fill: "#9aa3b2", "text-anchor":"middle" });
    ax.textContent = "position →";
    svg.appendChild(ax);
    const v = document.getElementById("pe-canvas");
    v.innerHTML = "";
    v.appendChild(svg);
  }
  document.getElementById("pe-pos").addEventListener("input", e => { pos = +e.target.value; redraw(); });
  document.getElementById("pe-d").addEventListener("input", e => { dmodel = +e.target.value; redraw(); });
  redraw();
};

// --- 4. Transformer architecture (encoder-decoder) ------------------------
VIZ["transformer-architecture"] = function (root) {
  const W = 720, H = 460;
  const svg = svgNS("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  function box(x, y, w, h, label, fill, stroke) {
    svg.appendChild(svgNS("rect", { x, y, width: w, height: h, rx: 6, fill, stroke, "stroke-width": 1.2 }));
    const t = svgNS("text", { x: x + w/2, y: y + h/2 + 4, "text-anchor": "middle", "font-size": 11, fill: "#e6e8ee", "font-family": "var(--sans)" });
    t.textContent = label;
    svg.appendChild(t);
  }
  function arrow(x1, y1, x2, y2, color) {
    svg.appendChild(svgNS("line", { x1, y1, x2, y2, stroke: color || "#9aa3b2", "stroke-width": 1.2, "marker-end": "url(#ah)" }));
  }
  // arrow marker
  const defs = svgNS("defs");
  const m = svgNS("marker", { id: "ah", viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" });
  m.appendChild(svgNS("path", { d: "M0,0 L10,5 L0,10 z", fill: "#9aa3b2" }));
  defs.appendChild(m); svg.appendChild(defs);

  // encoder stack
  const ex = 60, ew = 230;
  box(ex, 380, ew, 30, "Input Embedding + PE", "#1d2230", "#7aa2ff");
  box(ex, 290, ew, 70, "Encoder Layer × N\n(self-attn → FFN)", "#1d2230", "#7aa2ff");
  // decoder stack
  const dx = 430, dw = 230;
  box(dx, 380, dw, 30, "Output Embedding + PE", "#1d2230", "#b48cff");
  box(dx, 230, dw, 130, "Decoder Layer × N\n(masked self-attn → cross-attn → FFN)", "#1d2230", "#b48cff");
  box(dx, 170, dw, 30, "Linear", "#1d2230", "#6ad7a3");
  box(dx, 130, dw, 30, "Softmax → output probs", "#1d2230", "#6ad7a3");

  // arrows
  arrow(ex + ew/2, 380, ex + ew/2, 360);
  arrow(ex + ew/2, 290, ex + ew/2, 270);
  // cross-attn arrow
  svg.appendChild(svgNS("path", { d: `M ${ex+ew} 280 C ${(ex+ew+dx)/2} 280, ${(ex+ew+dx)/2} 280, ${dx} 280`,
    fill: "none", stroke: "#f0b86e", "stroke-width": 1.5, "marker-end": "url(#ah)" }));
  const cx = svgNS("text", { x: (ex + ew + dx)/2, y: 272, "text-anchor": "middle", "font-size": 11, fill: "#f0b86e", "font-family": "var(--sans)" });
  cx.textContent = "encoder K, V → cross-attn";
  svg.appendChild(cx);

  arrow(dx + dw/2, 380, dx + dw/2, 360);
  arrow(dx + dw/2, 230, dx + dw/2, 200);
  arrow(dx + dw/2, 170, dx + dw/2, 160);

  // labels
  const t1 = svgNS("text", { x: ex + ew/2, y: 430, "text-anchor": "middle", "font-size": 12, fill: "#7aa2ff", "font-family": "var(--sans)" });
  t1.textContent = "ENCODER · source tokens";
  svg.appendChild(t1);
  const t2 = svgNS("text", { x: dx + dw/2, y: 430, "text-anchor": "middle", "font-size": 12, fill: "#b48cff", "font-family": "var(--sans)" });
  t2.textContent = "DECODER · shifted-right targets";
  svg.appendChild(t2);
  const t3 = svgNS("text", { x: dx + dw/2, y: 115, "text-anchor": "middle", "font-size": 12, fill: "#6ad7a3", "font-family": "var(--sans)" });
  t3.textContent = "p(y_t | y_<t, x)";
  svg.appendChild(t3);

  root.appendChild(svg);
};

// --- 5. Attention heatmap on a toy sentence -------------------------------
VIZ["attention-heatmap"] = function (root) {
  const sentence = ["The","animal","didn't","cross","the","street","because","it","was","too","tired"];
  // Hand-crafted plausible self-attention from token "it" (and others)
  // rows = query token, cols = key token
  const N = sentence.length;
  const A = Array.from({length: N}, () => Array(N).fill(0.05));
  // strong "it" -> "animal", moderate "it" -> "tired"
  function set(q, k, v) { A[q][k] = v; }
  set(7, 1, 0.55); set(7, 9, 0.18); set(7, 7, 0.12);
  set(3, 5, 0.45); set(3, 0, 0.10); // cross -> street
  set(10, 1, 0.30); set(10, 7, 0.20); // tired -> animal, it
  // normalize rows
  for (let i = 0; i < N; i++) {
    const s = A[i].reduce((a,b)=>a+b, 0);
    A[i] = A[i].map(v => v / s);
  }
  let queryRow = 7;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>query token: <select id="ah-q">${sentence.map((w,i)=>`<option value="${i}" ${i===queryRow?"selected":""}>${w}</option>`).join("")}</select></label>
      <span style="color:var(--ink-dim)">Hover the matrix below to inspect a (query, key) pair.</span>
    </div>
    <div id="ah-row" style="display:flex;flex-wrap:wrap;gap:6px;font-family:var(--mono);font-size:13px;margin:8px 0;"></div>
    <div id="ah-mat"></div>
  `;
  function renderRow() {
    const row = A[queryRow];
    const host = document.getElementById("ah-row");
    host.innerHTML = sentence.map((w, i) => {
      const v = row[i];
      return `<span style="padding:4px 8px;border-radius:6px;background:${lerpColor(v*1.6)};color:${v>0.3?"#111":"#fff"};">${w}<span style="opacity:.6;font-size:11px;">·${v.toFixed(2)}</span></span>`;
    }).join("");
  }
  function renderMat() {
    const cell = 28, pad = 70;
    const size = pad + cell * N + 10;
    const svg = svgNS("svg", { width: size + 10, height: size + 20 });
    // col labels
    sentence.forEach((w, j) => {
      const t = svgNS("text", { x: pad + j*cell + cell/2, y: pad - 8, "text-anchor": "start", "font-size": 11, fill: "#9aa3b2", transform: `rotate(-50 ${pad + j*cell + cell/2} ${pad - 8})` });
      t.textContent = w;
      svg.appendChild(t);
    });
    sentence.forEach((w, i) => {
      const t = svgNS("text", { x: pad - 6, y: pad + i*cell + cell/2 + 4, "text-anchor": "end", "font-size": 11, fill: i===queryRow?"#7aa2ff":"#9aa3b2", "font-family": "var(--mono)" });
      t.textContent = w;
      svg.appendChild(t);
      for (let j = 0; j < N; j++) {
        const v = A[i][j];
        const r = svgNS("rect", { x: pad + j*cell, y: pad + i*cell, width: cell-1, height: cell-1, fill: lerpColor(v*1.6) });
        r.addEventListener("mouseenter", () => { queryRow = i; document.getElementById("ah-q").value = i; renderRow(); renderMat(); });
        svg.appendChild(r);
      }
    });
    const host = document.getElementById("ah-mat");
    host.innerHTML = "";
    host.appendChild(svg);
  }
  document.getElementById("ah-q").addEventListener("change", e => { queryRow = +e.target.value; renderRow(); renderMat(); });
  renderRow(); renderMat();
};

// --- 6. LoRA decomposition: W + BA -----------------------------------------
VIZ["lora-decomposition"] = function (root) {
  let r = 8;
  const d = 64;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>matrix dim d: <b>${d}</b></label>
      <label>rank r: <input type="range" id="lr-r" min="1" max="32" step="1" value="${r}"> <b id="lr-rv">${r}</b></label>
      <label>params: <b id="lr-params"></b></label>
    </div>
    <div id="lr-canvas"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      W (d×d) is frozen. We learn ΔW = BA where A is (r×d), B is (d×r). Trainable params: 2·d·r instead of d². For d=64, r=8: <b>1024 vs 4096</b> — 4× fewer.
    </div>
  `;
  function redraw() {
    document.getElementById("lr-rv").textContent = r;
    document.getElementById("lr-params").textContent = `${2*d*r} (LoRA) vs ${d*d} (full)`;
    const cell = 5, gap = 30;
    const W = (d*cell + gap) * 4 + 60;
    const svg = svgNS("svg", { width: W, height: d*cell + 60 });
    // W
    const groups = [
      { x: 20, w: d, h: d, label: "W (frozen)", color: "#3a4055" },
      { x: 20 + d*cell + gap, w: d, h: d, label: "+", color: null },
      { x: 20 + d*cell + gap + 30, w: r, h: d, label: "B", color: "#7aa2ff" },
      { x: 20 + d*cell + gap + 30 + r*cell + 10, w: d, h: r, label: "A", color: "#b48cff" }
    ];
    // W frozen
    svg.appendChild(svgNS("rect", { x: 20, y: 20, width: d*cell, height: d*cell, fill: "#3a4055", stroke: "#555" }));
    svg.appendChild(text(20 + d*cell/2, 20 + d*cell + 18, "W (d×d) frozen", "#9aa3b2"));
    // +
    svg.appendChild(text(20 + d*cell + 15, 20 + d*cell/2 + 5, "+", "#e6e8ee", 22));
    // B (d×r)
    const bx = 20 + d*cell + 30;
    svg.appendChild(svgNS("rect", { x: bx, y: 20, width: r*cell, height: d*cell, fill: "#7aa2ff", stroke: "#a4bdff" }));
    svg.appendChild(text(bx + r*cell/2, 20 + d*cell + 18, `B (d×r)`, "#7aa2ff"));
    // ·
    svg.appendChild(text(bx + r*cell + 10, 20 + d*cell/2 + 5, "·", "#e6e8ee", 22));
    // A (r×d)
    const ax = bx + r*cell + 26;
    svg.appendChild(svgNS("rect", { x: ax, y: 20, width: d*cell, height: r*cell, fill: "#b48cff", stroke: "#cfb6ff" }));
    svg.appendChild(text(ax + d*cell/2, 20 + r*cell + 18, `A (r×d)`, "#b48cff"));
    // = sign and result
    svg.appendChild(text(ax + d*cell + 16, 20 + d*cell/2 + 5, "=", "#e6e8ee", 22));
    const ex = ax + d*cell + 32;
    svg.appendChild(svgNS("rect", { x: ex, y: 20, width: d*cell, height: d*cell, fill: "#1d2230", stroke: "#6ad7a3", "stroke-dasharray": "3 3" }));
    svg.appendChild(text(ex + d*cell/2, 20 + d*cell + 18, "W + BA", "#6ad7a3"));
    function text(x, y, t, color, size) {
      const e = svgNS("text", { x, y, "text-anchor": "middle", "font-size": size || 11, fill: color, "font-family": "var(--sans)" });
      e.textContent = t;
      return e;
    }
    document.getElementById("lr-canvas").innerHTML = "";
    document.getElementById("lr-canvas").appendChild(svg);
  }
  document.getElementById("lr-r").addEventListener("input", e => { r = +e.target.value; redraw(); });
  redraw();
};

// --- 7. ViT patchify ------------------------------------------------------
VIZ["vit-patchify"] = function (root) {
  let P = 16;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>image: 224×224 (fixed)</label>
      <label>patch size P: <select id="vp">${[8,14,16,32].map(p=>`<option ${p===P?"selected":""}>${p}</option>`).join("")}</select></label>
      <label>tokens (N): <b id="vn"></b></label>
    </div>
    <div id="vit-canvas"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      Image is split into a grid of P×P patches. Each patch flattens to a (P²·3)-dim vector and is linearly projected to d_model. A [CLS] token is prepended. Result: a sequence of (224/P)² + 1 tokens fed to a standard Transformer encoder.
    </div>
  `;
  function redraw() {
    const I = 224, n = I/P, N = n*n + 1;
    document.getElementById("vn").textContent = `${n*n} + 1 [CLS] = ${N}`;
    const scale = 1.2, S = I*scale;
    const svg = svgNS("svg", { width: S + 240, height: S + 20 });
    // image gradient bg
    const grad = svgNS("linearGradient", { id: "vg", x1:"0", y1:"0", x2:"1", y2:"1" });
    [["0%","#5fa8ff"],["100%","#b48cff"]].forEach(([o,c]) => { const s = svgNS("stop", { offset: o, "stop-color": c }); grad.appendChild(s); });
    const defs = svgNS("defs"); defs.appendChild(grad); svg.appendChild(defs);
    svg.appendChild(svgNS("rect", { x: 10, y: 10, width: S, height: S, fill: "url(#vg)" }));
    // patches grid
    for (let i = 0; i <= n; i++) {
      svg.appendChild(svgNS("line", { x1: 10, y1: 10+i*P*scale, x2: 10+S, y2: 10+i*P*scale, stroke: "rgba(255,255,255,0.5)", "stroke-width": 1 }));
      svg.appendChild(svgNS("line", { x1: 10+i*P*scale, y1: 10, x2: 10+i*P*scale, y2: 10+S, stroke: "rgba(255,255,255,0.5)", "stroke-width": 1 }));
    }
    // arrow + token sequence
    const tx = S + 30;
    const tt = svgNS("text", { x: tx, y: 30, "font-size": 12, fill: "#e6e8ee", "font-family": "var(--sans)" });
    tt.textContent = `→ ${N} tokens`;
    svg.appendChild(tt);
    const cls = svgNS("rect", { x: tx, y: 50, width: 32, height: 20, fill: "#6ad7a3", rx: 4 });
    svg.appendChild(cls);
    const cls_t = svgNS("text", { x: tx+16, y: 64, "text-anchor": "middle", "font-size": 10, fill: "#111", "font-family": "var(--mono)" });
    cls_t.textContent = "[CLS]"; svg.appendChild(cls_t);
    const maxShow = Math.min(n*n, 36);
    for (let i = 0; i < maxShow; i++) {
      const x = tx + 38 + (i % 6) * 28;
      const y = 50 + Math.floor(i/6) * 24;
      svg.appendChild(svgNS("rect", { x, y, width: 24, height: 20, fill: "#7aa2ff", rx: 4 }));
      const tk = svgNS("text", { x: x+12, y: y+14, "text-anchor": "middle", "font-size": 9, fill: "#111", "font-family": "var(--mono)" });
      tk.textContent = `p${i+1}`; svg.appendChild(tk);
    }
    if (n*n > maxShow) {
      const more = svgNS("text", { x: tx + 38, y: 50 + Math.ceil(maxShow/6) * 24 + 14, "font-size": 10, fill: "#9aa3b2", "font-family": "var(--mono)" });
      more.textContent = `… +${n*n - maxShow} more`;
      svg.appendChild(more);
    }
    document.getElementById("vit-canvas").innerHTML = "";
    document.getElementById("vit-canvas").appendChild(svg);
  }
  document.getElementById("vp").addEventListener("change", e => { P = +e.target.value; redraw(); });
  redraw();
};

// --- 8. VAE reparameterization ---------------------------------------------
VIZ["vae-reparameterize"] = function (root) {
  let mu = 0, logvar = 0, samples = 200;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>μ: <input type="range" id="vmu" min="-3" max="3" step="0.1" value="0"> <b id="vmuv">0</b></label>
      <label>log σ²: <input type="range" id="vlv" min="-3" max="2" step="0.1" value="0"> <b id="vlvv">0</b></label>
      <button id="vresample">Resample ε</button>
    </div>
    <div id="vae-canvas"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      Encoder outputs μ, σ. Trick: z = μ + σ · ε, ε ~ N(0,1). Gradients flow through μ and σ; randomness lives in ε and doesn't need a gradient. Latent samples z are shown in the gradient region.
    </div>
  `;
  function gauss() {
    const u = Math.max(Math.random(), 1e-9), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  let eps = Array.from({length: samples}, gauss);
  function redraw() {
    document.getElementById("vmuv").textContent = mu.toFixed(2);
    document.getElementById("vlvv").textContent = logvar.toFixed(2);
    const sigma = Math.exp(logvar / 2);
    const W = 560, H = 160;
    const svg = svgNS("svg", { width: W, height: H });
    // axis
    svg.appendChild(svgNS("line", { x1: 20, y1: 80, x2: W-20, y2: 80, stroke: "#555" }));
    for (let v = -5; v <= 5; v++) {
      const x = 20 + ((v+5)/10) * (W-40);
      svg.appendChild(svgNS("line", { x1: x, y1: 75, x2: x, y2: 85, stroke: "#555" }));
      const t = svgNS("text", { x, y: 100, "text-anchor": "middle", "font-size": 10, fill: "#9aa3b2", "font-family": "var(--mono)" });
      t.textContent = v;
      svg.appendChild(t);
    }
    // samples
    eps.forEach(e => {
      const z = mu + sigma * e;
      const x = 20 + ((z+5)/10) * (W-40);
      svg.appendChild(svgNS("circle", { cx: x, cy: 80, r: 3, fill: "#7aa2ff", opacity: 0.55 }));
    });
    // μ marker
    const xmu = 20 + ((mu+5)/10) * (W-40);
    svg.appendChild(svgNS("line", { x1: xmu, y1: 30, x2: xmu, y2: 130, stroke: "#f0b86e", "stroke-width": 2 }));
    svg.appendChild(svgNS("text", { x: xmu+6, y: 35, "font-size": 12, fill: "#f0b86e", "font-family": "var(--sans)" })).textContent = `μ = ${mu.toFixed(2)}`;
    // sigma band
    const xL = 20 + ((mu - sigma + 5)/10) * (W-40);
    const xR = 20 + ((mu + sigma + 5)/10) * (W-40);
    svg.appendChild(svgNS("rect", { x: xL, y: 60, width: Math.max(0, xR-xL), height: 40, fill: "#f0b86e", opacity: 0.2 }));
    const lbl = svgNS("text", { x: (xL+xR)/2, y: 55, "text-anchor":"middle", "font-size": 11, fill: "#f0b86e", "font-family": "var(--sans)" });
    lbl.textContent = `σ = ${sigma.toFixed(2)}`;
    svg.appendChild(lbl);
    document.getElementById("vae-canvas").innerHTML = "";
    document.getElementById("vae-canvas").appendChild(svg);
  }
  document.getElementById("vmu").addEventListener("input", e => { mu = +e.target.value; redraw(); });
  document.getElementById("vlv").addEventListener("input", e => { logvar = +e.target.value; redraw(); });
  document.getElementById("vresample").addEventListener("click", () => { eps = Array.from({length: samples}, gauss); redraw(); });
  redraw();
};

// --- 9. Diffusion forward/reverse (1D) ------------------------------------
VIZ["diffusion-forward-reverse"] = function (root) {
  let T = 200, beta_start = 0.0001, beta_end = 0.02;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>steps T: <input type="range" id="dT" min="10" max="1000" step="10" value="${T}"> <b id="dTv">${T}</b></label>
      <label>β schedule: linear (β₁=${beta_start}, β_T=${beta_end})</label>
    </div>
    <div id="diff-canvas"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      Forward q(xₜ|x₀) = N(√ᾱₜ · x₀, (1−ᾱₜ)I) progressively adds Gaussian noise. ᾱₜ = ∏(1−βᵢ) is the cumulative signal coefficient. By t=T, the signal is fully drowned in noise; the reverse process learns to undo it step by step.
    </div>
  `;
  function gauss() {
    const u = Math.max(Math.random(), 1e-9), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function redraw() {
    document.getElementById("dTv").textContent = T;
    const W = 560, H = 200;
    const svg = svgNS("svg", { width: W, height: H });
    // β schedule
    const betas = Array.from({length: T}, (_, t) => beta_start + (beta_end - beta_start) * t / (T - 1));
    const alpha_bar = []; let cum = 1;
    for (const b of betas) { cum *= (1 - b); alpha_bar.push(cum); }
    // sample x0 as 200 points along sin
    const N = 200;
    const x0 = Array.from({length: N}, (_, i) => Math.sin(i / N * Math.PI * 4));
    // pick 6 timesteps to display
    const ts = [0, Math.floor(T*0.1), Math.floor(T*0.25), Math.floor(T*0.5), Math.floor(T*0.75), T-1];
    const rowH = H / ts.length;
    ts.forEach((t, row) => {
      const ab = alpha_bar[t];
      const sqrt_ab = Math.sqrt(ab);
      const sqrt_1mab = Math.sqrt(1 - ab);
      for (let i = 0; i < N; i++) {
        const x = sqrt_ab * x0[i] + sqrt_1mab * gauss();
        const cx = 60 + (i / N) * (W - 70);
        const cy = row * rowH + rowH/2 + (x * (rowH * 0.35));
        svg.appendChild(svgNS("circle", { cx, cy, r: 1.5, fill: "#7aa2ff", opacity: 0.7 }));
      }
      const lbl = svgNS("text", { x: 8, y: row * rowH + rowH/2 + 4, "font-size": 10, fill: "#9aa3b2", "font-family": "var(--mono)" });
      lbl.textContent = `t=${t}`;
      svg.appendChild(lbl);
    });
    document.getElementById("diff-canvas").innerHTML = "";
    document.getElementById("diff-canvas").appendChild(svg);
  }
  document.getElementById("dT").addEventListener("input", e => { T = +e.target.value; redraw(); });
  redraw();
};

// --- 10. RAG pipeline -----------------------------------------------------
VIZ["rag-pipeline"] = function (root) {
  const W = 720, H = 240;
  const svg = svgNS("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  function box(x, y, w, h, label, fill, stroke) {
    svg.appendChild(svgNS("rect", { x, y, width: w, height: h, rx: 8, fill, stroke, "stroke-width": 1.2 }));
    label.split("\n").forEach((line, i) => {
      const t = svgNS("text", { x: x + w/2, y: y + h/2 + 4 + i*14 - (label.split("\n").length-1)*7, "text-anchor": "middle", "font-size": 12, fill: "#e6e8ee", "font-family": "var(--sans)" });
      t.textContent = line;
      svg.appendChild(t);
    });
  }
  // defs
  const defs = svgNS("defs");
  const m = svgNS("marker", { id: "rah", viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" });
  m.appendChild(svgNS("path", { d: "M0,0 L10,5 L0,10 z", fill: "#9aa3b2" }));
  defs.appendChild(m); svg.appendChild(defs);
  function arrow(x1,y1,x2,y2,color) {
    const l = svgNS("line", { x1, y1, x2, y2, stroke: color || "#9aa3b2", "stroke-width": 1.4, "marker-end": "url(#rah)" });
    svg.appendChild(l);
  }
  // query
  box(20, 100, 110, 40, "query x", "#1d2230", "#7aa2ff");
  // retriever
  box(160, 100, 130, 40, "retriever\n(DPR / BM25)", "#1d2230", "#b48cff");
  arrow(130, 120, 158, 120);
  // doc store
  box(160, 30, 130, 50, "document\nindex (FAISS)", "#1d2230", "#6ad7a3");
  arrow(225, 80, 225, 100);
  // top-k docs
  box(320, 100, 120, 40, "top-k docs\nz₁ … z_k", "#1d2230", "#f0b86e");
  arrow(290, 120, 320, 120);
  // generator
  box(470, 100, 130, 40, "generator\n(BART / T5)", "#1d2230", "#b48cff");
  arrow(440, 120, 468, 120);
  arrow(75, 140, 75, 195);
  arrow(75, 195, 533, 195);
  arrow(533, 195, 533, 142);
  // output
  box(620, 100, 80, 40, "answer y", "#1d2230", "#7aa2ff");
  arrow(600, 120, 620, 120);
  // marginalization label
  const ml = svgNS("text", { x: W/2, y: 215, "text-anchor": "middle", "font-size": 11, fill: "#9aa3b2", "font-family": "var(--sans)" });
  ml.textContent = "p(y | x) = Σ_z p(z|x) · p(y | x, z)   — marginalize over retrieved docs";
  svg.appendChild(ml);
  root.appendChild(svg);
};

// --- 11. GAN minimax dynamics --------------------------------------------
VIZ["gan-game"] = function (root) {
  let step = 0;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <button id="gn-step">Train step</button>
      <button id="gn-reset">Reset</button>
      <label>step: <b id="gn-s">0</b></label>
    </div>
    <div id="gn-canvas"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      Real data ~ N(2, 0.5). Generator starts at N(-2, 1). Discriminator (orange curve) learns to separate them; generator nudges its mean toward the real distribution. At equilibrium they overlap and D outputs 0.5 everywhere.
    </div>
  `;
  let G = { mu: -2, sigma: 1 };
  const real = { mu: 2, sigma: 0.5 };
  function redraw() {
    document.getElementById("gn-s").textContent = step;
    const W = 560, H = 200;
    const svg = svgNS("svg", { width: W, height: H });
    // axes
    svg.appendChild(svgNS("line", { x1: 30, y1: H-30, x2: W-10, y2: H-30, stroke: "#555" }));
    function pdf(mu, sigma, x) { return Math.exp(-((x-mu)**2)/(2*sigma*sigma)) / (sigma*Math.sqrt(2*Math.PI)); }
    function plot(curveFn, color, fill) {
      let d = "";
      for (let i = 0; i <= 200; i++) {
        const x = -6 + (i/200)*12;
        const v = curveFn(x);
        const px = 30 + (i/200)*(W-40);
        const py = (H-30) - v * 80;
        d += (i === 0 ? "M" : "L") + px + "," + py;
      }
      const p = svgNS("path", { d, fill: fill || "none", stroke: color, "stroke-width": 1.8, opacity: fill ? 0.3 : 1 });
      svg.appendChild(p);
    }
    plot(x => pdf(real.mu, real.sigma, x), "#6ad7a3", "#6ad7a3");
    plot(x => pdf(G.mu, G.sigma, x), "#7aa2ff", "#7aa2ff");
    // discriminator (sigmoid pushing toward real / away from G)
    plot(x => {
      const pR = pdf(real.mu, real.sigma, x);
      const pG = pdf(G.mu, G.sigma, x);
      return pR / Math.max(1e-9, pR + pG) * 0.6;
    }, "#f0b86e");
    // labels
    const l1 = svgNS("text", { x: 35, y: 20, "font-size": 12, fill: "#6ad7a3", "font-family": "var(--sans)" });
    l1.textContent = "real data";
    svg.appendChild(l1);
    const l2 = svgNS("text", { x: 35, y: 38, "font-size": 12, fill: "#7aa2ff", "font-family": "var(--sans)" });
    l2.textContent = "G(z)";
    svg.appendChild(l2);
    const l3 = svgNS("text", { x: 35, y: 56, "font-size": 12, fill: "#f0b86e", "font-family": "var(--sans)" });
    l3.textContent = "D(x)";
    svg.appendChild(l3);
    document.getElementById("gn-canvas").innerHTML = "";
    document.getElementById("gn-canvas").appendChild(svg);
  }
  document.getElementById("gn-step").addEventListener("click", () => {
    step++;
    G.mu += (real.mu - G.mu) * 0.15;
    G.sigma += (real.sigma - G.sigma) * 0.1;
    redraw();
  });
  document.getElementById("gn-reset").addEventListener("click", () => {
    step = 0; G = { mu: -2, sigma: 1 }; redraw();
  });
  redraw();
};

// --- 12. BERT MLM/NSP -----------------------------------------------------
VIZ["bert-mlm"] = function (root) {
  const sentence = ["[CLS]","my","dog","is","cute","[SEP]","he","likes","play","##ing","[SEP]"];
  const masked = new Set([4, 8]); // mask "cute" and "play"
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div id="bm" style="display:flex;flex-wrap:wrap;gap:6px;font-family:var(--mono);font-size:14px;"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      BERT input: [CLS] + sentence A + [SEP] + sentence B + [SEP]. 15% of tokens are replaced: 80% with [MASK], 10% with a random word, 10% unchanged. The model predicts the original at each masked position (MLM) and whether B follows A (NSP).
    </div>
  `;
  const host = document.getElementById("bm");
  host.innerHTML = sentence.map((w, i) => {
    const isMask = masked.has(i);
    const bg = isMask ? "#f0b86e" : (w.startsWith("[") ? "#b48cff" : "#1d2230");
    const fg = isMask ? "#111" : (w.startsWith("[") ? "#111" : "#e6e8ee");
    return `<span style="padding:6px 10px;border-radius:6px;background:${bg};color:${fg};border:1px solid var(--rule);">${isMask?"[MASK]<br><span style='font-size:10px;opacity:.6'>("+w+")</span>":w}</span>`;
  }).join("");
};



// ============ Batch 3 visualizations ============
// --- residual-block (ResNet) ----------------------------------------------
VIZ["residual-block"] = function (root) {
  let depth = 34;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>plain vs residual: skip connection lets gradients flow directly</label>
    </div>
    <div id="rb"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      A residual block computes F(x) + x. The identity shortcut means the layer only has to learn the <i>residual</i> F(x)=H(x)−x. If the optimal map is close to identity, the block can drive F→0 easily. This is why 152-layer ResNets train where 34-layer plain nets degrade.
    </div>`;
  const W = 520, H = 240;
  const svg = svgNS("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  const defs = svgNS("defs");
  const m = svgNS("marker", { id: "rbar", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
  m.appendChild(svgNS("path", { d: "M0,0 L10,5 L0,10 z", fill: "#9aa3b2" })); defs.appendChild(m); svg.appendChild(defs);
  function box(x,y,w,h,t,c){ svg.appendChild(svgNS("rect",{x,y,width:w,height:h,rx:6,fill:"#1d2230",stroke:c,"stroke-width":1.3}));
    const e=svgNS("text",{x:x+w/2,y:y+h/2+4,"text-anchor":"middle","font-size":12,fill:"#e6e8ee","font-family":"var(--sans)"});e.textContent=t;svg.appendChild(e);}
  function arrow(x1,y1,x2,y2,c){ svg.appendChild(svgNS("line",{x1,y1,x2,y2,stroke:c||"#9aa3b2","stroke-width":1.4,"marker-end":"url(#rbar)"})); }
  box(200,20,120,30,"x","#7aa2ff");
  arrow(260,50,260,70);
  box(200,70,120,34,"weight layer","#b48cff");
  arrow(260,104,260,120);
  box(200,120,120,34,"ReLU · weight","#b48cff");
  arrow(260,154,260,180);
  svg.appendChild(svgNS("circle",{cx:260,cy:192,r:14,fill:"#1d2230",stroke:"#6ad7a3"}));
  const plus=svgNS("text",{x:260,y:197,"text-anchor":"middle","font-size":16,fill:"#6ad7a3"});plus.textContent="+";svg.appendChild(plus);
  // skip path
  svg.appendChild(svgNS("path",{d:"M320 35 C 410 35, 410 192, 276 192",fill:"none",stroke:"#6ad7a3","stroke-width":1.8,"marker-end":"url(#rbar)"}));
  const sl=svgNS("text",{x:420,y:115,"text-anchor":"middle","font-size":11,fill:"#6ad7a3","font-family":"var(--sans)",transform:"rotate(90 420 115)"});sl.textContent="identity shortcut (x)";svg.appendChild(sl);
  arrow(260,206,260,222);
  box(200,222,120,16,"F(x) + x","#6ad7a3");
  root.appendChild(svg);
};

// --- batchnorm-effect -----------------------------------------------------
VIZ["batchnorm-effect"] = function (root) {
  let gamma = 1, beta = 0;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>γ (scale): <input type="range" id="bn-g" min="0.2" max="2.5" step="0.1" value="1"> <b id="bn-gv">1.0</b></label>
      <label>β (shift): <input type="range" id="bn-b" min="-2" max="2" step="0.1" value="0"> <b id="bn-bv">0.0</b></label>
    </div>
    <div id="bn"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      BN normalizes each activation over the mini-batch to mean 0, variance 1, then rescales: y = γ·x̂ + β. Normalizing stabilizes the distribution each layer sees (reduces "internal covariate shift"), letting you use higher learning rates. γ, β are learned so the layer can undo normalization if needed.
    </div>`;
  function gauss(){const u=Math.max(Math.random(),1e-9),v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
  const raw = Array.from({length:300},()=>2.2+1.4*gauss());
  function redraw(){
    document.getElementById("bn-gv").textContent=gamma.toFixed(1);
    document.getElementById("bn-bv").textContent=beta.toFixed(1);
    const mean=raw.reduce((a,b)=>a+b,0)/raw.length;
    const vr=raw.reduce((a,b)=>a+(b-mean)**2,0)/raw.length;
    const norm=raw.map(x=>(x-mean)/Math.sqrt(vr+1e-5)).map(x=>gamma*x+beta);
    const W=520,H=170;const svg=svgNS("svg",{width:W,height:H});
    svg.appendChild(svgNS("line",{x1:20,y1:H/2,x2:W-20,y2:H/2,stroke:"#555"}));
    function band(arr,y,c,label){arr.forEach(x=>{const px=20+((x+6)/12)*(W-40);svg.appendChild(svgNS("circle",{cx:px,cy:y,r:2.5,fill:c,opacity:0.5}));});
      const t=svgNS("text",{x:24,y:y-20,"font-size":11,fill:c,"font-family":"var(--sans)"});t.textContent=label;svg.appendChild(t);}
    band(raw,52,"#f0b86e","raw activations (mean≈2.2)");
    band(norm,120,"#7aa2ff","after BN: y = γ·x̂ + β");
    document.getElementById("bn").innerHTML="";document.getElementById("bn").appendChild(svg);
  }
  document.getElementById("bn-g").addEventListener("input",e=>{gamma=+e.target.value;redraw();});
  document.getElementById("bn-b").addEventListener("input",e=>{beta=+e.target.value;redraw();});
  redraw();
};

// --- adversarial-perturbation (FGSM) --------------------------------------
VIZ["adversarial-perturbation"] = function (root) {
  let eps = 0.0;
  const ui = document.createElement("div");
  root.appendChild(ui);
  ui.innerHTML = `
    <div class="controls">
      <label>ε (perturbation budget): <input type="range" id="ap-e" min="0" max="0.3" step="0.01" value="0"> <b id="ap-ev">0.00</b></label>
    </div>
    <div id="ap"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      FGSM: x_adv = x + ε·sign(∇ₓ J(θ,x,y)). A tiny step in the gradient-sign direction — imperceptible to humans — can flip the classifier's prediction. As ε grows, the true-class confidence collapses and a wrong class takes over.
    </div>`;
  function redraw(){
    document.getElementById("ap-ev").textContent=eps.toFixed(2);
    // toy: true class confidence decays with eps, adversarial class rises
    const pTrue=Math.max(0.02, 0.97 - eps*3.4);
    const pAdv=Math.min(0.95, 0.01 + eps*3.2);
    const pOther=Math.max(0, 1-pTrue-pAdv);
    const W=520,H=150;const svg=svgNS("svg",{width:W,height:H});
    const bars=[["panda (true)",pTrue,"#6ad7a3"],["gibbon (adv)",pAdv,"#ff7b9c"],["other",pOther,"#9aa3b2"]];
    bars.forEach((b,i)=>{const y=20+i*40;
      svg.appendChild(svgNS("rect",{x:140,y,width:(W-180)*b[1],height:24,fill:b[2],rx:4}));
      const l=svgNS("text",{x:130,y:y+17,"text-anchor":"end","font-size":12,fill:"#e6e8ee","font-family":"var(--sans)"});l.textContent=b[0];svg.appendChild(l);
      const v=svgNS("text",{x:148+(W-180)*b[1],y:y+17,"font-size":11,fill:"#9aa3b2","font-family":"var(--mono)"});v.textContent=(b[1]*100).toFixed(0)+"%";svg.appendChild(v);});
    document.getElementById("ap").innerHTML="";document.getElementById("ap").appendChild(svg);
  }
  document.getElementById("ap-e").addEventListener("input",e=>{eps=+e.target.value;redraw();});
  redraw();
};

// --- seq2seq-align (attention alignment matrix) ---------------------------
VIZ["seq2seq-align"] = function (root) {
  const src=["The","agreement","on","the","European","Economic","Area","was","signed"];
  const tgt=["L'","accord","sur","la","zone","économique","européenne","a","été","signé"];
  // hand-crafted plausible soft alignment (rows=target, cols=source)
  const A=tgt.map(()=>src.map(()=>0.04));
  function set(t,s,v){A[t][s]=v;}
  set(0,0,.6);set(1,1,.7);set(2,2,.6);set(3,3,.5);set(4,6,.5);set(5,5,.6);set(6,4,.6);set(7,7,.6);set(8,7,.4);set(9,8,.7);
  A.forEach((r,i)=>{const sum=r.reduce((a,b)=>a+b,0);A[i]=r.map(v=>v/sum);});
  const ui=document.createElement("div");root.appendChild(ui);
  ui.innerHTML=`<div id="ssa"></div>
    <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;font-family:var(--sans);">
      Encoder–decoder attention learns a soft alignment between source and target words — without ever being told the alignment. Bright cells show which source word each generated word attends to. Note the reordering: French "zone économique européenne" maps back across the English order.
    </div>`;
  const cell=30,padL=110,padT=80;
  const W=padL+src.length*cell+20,H=padT+tgt.length*cell+10;
  const svg=svgNS("svg",{width:W,height:H});
  src.forEach((w,j)=>{const t=svgNS("text",{x:padL+j*cell+cell/2,y:padT-8,"font-size":11,fill:"#9aa3b2","font-family":"var(--sans)",transform:`rotate(-55 ${padL+j*cell+cell/2} ${padT-8})`});t.textContent=w;svg.appendChild(t);});
  tgt.forEach((w,i)=>{const t=svgNS("text",{x:padL-8,y:padT+i*cell+cell/2+4,"text-anchor":"end","font-size":11,fill:"#9aa3b2","font-family":"var(--sans)"});t.textContent=w;svg.appendChild(t);
    src.forEach((_,j)=>{svg.appendChild(svgNS("rect",{x:padL+j*cell,y:padT+i*cell,width:cell-1,height:cell-1,fill:lerpColor(A[i][j]*1.6)}));});});
  document.getElementById("ssa").appendChild(svg);
};

// --- image-translation (pix2pix / StarGAN / CycleGAN family) --------------
VIZ["image-translation"] = function (root) {
  const W=600,H=170;const svg=svgNS("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`});
  const defs=svgNS("defs");
  const m=svgNS("marker",{id:"itar",viewBox:"0 0 10 10",refX:8,refY:5,markerWidth:6,markerHeight:6,orient:"auto-start-reverse"});
  m.appendChild(svgNS("path",{d:"M0,0 L10,5 L0,10 z",fill:"#9aa3b2"}));defs.appendChild(m);svg.appendChild(defs);
  function box(x,y,w,h,t,c){svg.appendChild(svgNS("rect",{x,y,width:w,height:h,rx:8,fill:"#1d2230",stroke:c,"stroke-width":1.3}));
    t.split("\n").forEach((ln,i)=>{const e=svgNS("text",{x:x+w/2,y:y+h/2+4+i*13-(t.split("\n").length-1)*6,"text-anchor":"middle","font-size":11,fill:"#e6e8ee","font-family":"var(--sans)"});e.textContent=ln;svg.appendChild(e);});}
  function arrow(x1,y1,x2,y2){svg.appendChild(svgNS("line",{x1,y1,x2,y2,stroke:"#9aa3b2","stroke-width":1.4,"marker-end":"url(#itar)"}));}
  box(20,60,110,50,"input domain X\n(edges, label map)","#7aa2ff");
  arrow(130,85,175,85);
  box(175,60,120,50,"Generator G\n(U-Net)","#b48cff");
  arrow(295,85,340,85);
  box(340,60,110,50,"output domain Y\n(photo)","#6ad7a3");
  arrow(450,85,495,85);
  box(495,55,90,60,"Discriminator D\n(PatchGAN)\nreal? fake?","#f0b86e");
  const cl=svgNS("text",{x:W/2,y:150,"text-anchor":"middle","font-size":11,fill:"#9aa3b2","font-family":"var(--sans)"});
  cl.textContent="Conditional GAN: G learns X→Y; D judges (x,y) pairs. Loss = adversarial + L1 reconstruction.";
  svg.appendChild(cl);
  root.appendChild(svg);
};
