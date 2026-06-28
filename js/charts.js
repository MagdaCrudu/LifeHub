// charts.js — lightweight animated canvas charts (high-DPI aware).

export const PALETTE = ['#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#f472b6', '#a3e635'];

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function setup(canvas, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 320;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssW, h: cssH };
}

function readVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function textColor() { return readVar('--text', '#fff'); }
function mutedColor() { return readVar('--muted', '#999'); }
function gridColor() { return readVar('--border', 'rgba(255,255,255,.1)'); }

function animate(draw, dur = 850) {
  const start = performance.now();
  let raf;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    draw(easeOut(p));
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/* ---------- Donut ---------- */
export function donut(canvas, data, { size = 240, thickness = 26, centerTop = '', centerSub = '' } = {}) {
  const { ctx, w, h } = setup(canvas, size);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 8, r = R - thickness;
  return animate((p) => {
    ctx.clearRect(0, 0, w, h);
    // track
    ctx.beginPath(); ctx.arc(cx, cy, (R + r) / 2, 0, Math.PI * 2);
    ctx.lineWidth = thickness; ctx.strokeStyle = gridColor(); ctx.stroke();
    let a0 = -Math.PI / 2;
    data.forEach((d, i) => {
      const frac = (d.value / total) * p;
      const a1 = a0 + frac * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx, cy, (R + r) / 2, a0, a1);
      ctx.lineWidth = thickness; ctx.lineCap = 'round';
      ctx.strokeStyle = d.color || PALETTE[i % PALETTE.length];
      ctx.stroke();
      a0 = a1;
    });
    if (centerTop) {
      ctx.fillStyle = textColor(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 24px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(centerTop, cx, cy - (centerSub ? 9 : 0));
      if (centerSub) { ctx.fillStyle = mutedColor(); ctx.font = '600 12px "Segoe UI", system-ui, sans-serif'; ctx.fillText(centerSub, cx, cy + 14); }
    }
  });
}

/* ---------- Bars (vertical) ---------- */
export function bars(canvas, data, { height = 220, format = (v) => v, color } = {}) {
  const { ctx, w, h } = setup(canvas, height);
  const padL = 8, padR = 8, padT = 16, padB = 28;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length || 1;
  const gap = 14;
  const bw = Math.max(8, (w - padL - padR - gap * (n - 1)) / n);
  return animate((p) => {
    ctx.clearRect(0, 0, w, h);
    const chartH = h - padT - padB;
    // baseline
    ctx.strokeStyle = gridColor(); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, h - padB); ctx.lineTo(w - padR, h - padB); ctx.stroke();
    data.forEach((d, i) => {
      const x = padL + i * (bw + gap);
      const bh = (d.value / max) * chartH * p;
      const y = h - padB - bh;
      const g = ctx.createLinearGradient(0, y, 0, h - padB);
      const c = color || d.color || PALETTE[0];
      g.addColorStop(0, c); g.addColorStop(1, c + '55');
      ctx.fillStyle = g;
      roundRect(ctx, x, y, bw, bh, Math.min(8, bw / 2)); ctx.fill();
      // label
      ctx.fillStyle = mutedColor(); ctx.textAlign = 'center'; ctx.font = '600 11px "Segoe UI", sans-serif';
      ctx.fillText(d.label, x + bw / 2, h - padB + 16);
      if (p > 0.98 && d.value > 0) {
        ctx.fillStyle = textColor(); ctx.font = '700 11px "Segoe UI", sans-serif';
        ctx.fillText(format(d.value), x + bw / 2, y - 6);
      }
    });
  });
}

/* ---------- Line / area ---------- */
export function line(canvas, points, { height = 220, format = (v) => v, color = PALETTE[0], fill = true, labels } = {}) {
  const { ctx, w, h } = setup(canvas, height);
  const padL = 10, padR = 14, padT = 18, padB = labels ? 26 : 12;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const n = points.length;
  const X = (i) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
  const Y = (v) => h - padB - ((v - min) / (max - min || 1)) * (h - padT - padB);
  return animate((p) => {
    ctx.clearRect(0, 0, w, h);
    // grid lines
    ctx.strokeStyle = gridColor(); ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
      const yy = padT + (g / 3) * (h - padT - padB);
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
    }
    const count = Math.max(1, Math.floor((n - 1) * p) + 1);
    const visible = points.slice(0, count);
    if (fill) {
      const g = ctx.createLinearGradient(0, padT, 0, h - padB);
      g.addColorStop(0, color + '40'); g.addColorStop(1, color + '02');
      ctx.beginPath(); ctx.moveTo(X(0), Y(visible[0]));
      visible.forEach((v, i) => smoothTo(ctx, X, Y, visible, i));
      ctx.lineTo(X(count - 1), h - padB); ctx.lineTo(X(0), h - padB); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(X(0), Y(visible[0]));
    visible.forEach((v, i) => smoothTo(ctx, X, Y, visible, i));
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    // last point dot
    if (p > 0.98 && n) {
      ctx.beginPath(); ctx.arc(X(n - 1), Y(points[n - 1]), 4, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = readVar('--bg', '#000'); ctx.lineWidth = 2; ctx.stroke();
    }
    if (labels && p > 0.98) {
      ctx.fillStyle = mutedColor(); ctx.font = '600 10.5px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
      labels.forEach((lb, i) => { if (i % Math.ceil(n / 6) === 0 || i === n - 1) ctx.fillText(lb, X(i), h - 8); });
    }
  });
}
function smoothTo(ctx, X, Y, pts, i) {
  if (i === 0) return;
  const x0 = X(i - 1), y0 = Y(pts[i - 1]), x1 = X(i), y1 = Y(pts[i]);
  const xc = (x0 + x1) / 2;
  ctx.bezierCurveTo(xc, y0, xc, y1, x1, y1);
}

function hexA(hex, a) {
  const n = Math.max(0, Math.min(1, a));
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${n.toFixed(3)})`;
}

/* ---------- Installment evolution — refined stacked bars, pannable + zoomable (M/Q/H/Y) ----------
 * `months` = per-month [{ date:Date, total, interest, principal }]. Buckets are aggregated by the
 * chosen level (average installment within the bucket). Drag to pan in time; setLevel() to zoom.
 * Returns a controller { setLevel, getLevel, destroy }. */
export function rataChart(canvas, months, { height = 230, fmt = (v) => Math.round(v), conv = (v) => v, now = new Date() } = {}) {
  if (!months || !months.length) return { setLevel() {}, getLevel: () => 'M', destroy() {} };
  const { ctx, w, h } = setup(canvas, height);
  const padL = 44, padR = 12, padT = 16, padB = 30;
  const LEVELS = ['M', 'Q', 'H', 'Y'];
  const NOMINAL = { M: 14, Q: 16, H: 14, Y: 12 };
  const MO = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.'];
  const yy = (d) => String(d.getFullYear()).slice(2);
  const nowYM = now.getFullYear() * 12 + now.getMonth();
  const cPrin = PALETTE[2], cInt = PALETTE[4];

  const keyOf = (d, lv) => { const y = d.getFullYear(), m = d.getMonth();
    return lv === 'M' ? y * 12 + m : lv === 'Q' ? y * 4 + (m / 3 | 0) : lv === 'H' ? y * 2 + (m / 6 | 0) : y; };
  const labelOf = (d, lv) => { const m = d.getMonth();
    return lv === 'M' ? `${MO[m]} ${yy(d)}` : lv === 'Q' ? `T${(m / 3 | 0) + 1} ${yy(d)}` : lv === 'H' ? `S${(m / 6 | 0) + 1} ${yy(d)}` : `${d.getFullYear()}`; };

  function aggregate(lv) {
    const arr = []; const by = new Map();
    for (const mo of months) {
      const k = keyOf(mo.date, lv);
      let b = by.get(k);
      if (!b) { b = { label: labelOf(mo.date, lv), startDate: mo.date, total: 0, interest: 0, principal: 0, n: 0, lastYM: -1, hasNow: false }; by.set(k, b); arr.push(b); }
      b.total += mo.total; b.interest += mo.interest; b.principal += mo.principal; b.n++;
      const ym = mo.date.getFullYear() * 12 + mo.date.getMonth();
      if (ym > b.lastYM) b.lastYM = ym;
      if (ym === nowYM) b.hasNow = true;
    }
    let mx = 1;
    for (const b of arr) { b.total /= b.n; b.interest /= b.n; b.principal /= b.n; b.isPast = b.lastYM < nowYM; if (b.total > mx) mx = b.total; }
    arr._max = mx;
    return arr;
  }
  const idxForYM = (bks, ym) => {
    for (let i = 0; i < bks.length; i++) { const b = bks[i]; const s = b.startDate.getFullYear() * 12 + b.startDate.getMonth(); if (ym < s) return Math.max(0, i - 1); if (ym <= b.lastYM) return i; }
    return bks.length - 1;
  };

  let level = 'M';
  let buckets = aggregate(level);
  let count = Math.min(buckets.length, NOMINAL[level]);
  let start = 0;
  const clampStart = (s) => Math.max(0, Math.min(s, Math.max(0, buckets.length - count)));
  // place the current period in the left third → the chart starts further to the right,
  // showing mostly upcoming installments (where the rate actually changes)
  const centerNow = () => clampStart(idxForYM(buckets, nowYM) - Math.floor(count / 3));
  start = centerNow();

  // y-axis numbers are shown in the active display currency
  const compact = (raw) => { const v = conv(raw); return v >= 1000 ? (v / 1000).toFixed(v >= 9500 ? 0 : 1).replace('.', ',') + 'k' : String(Math.round(v)); };
  const bwOf = () => (w - padL - padR) / count;
  const Yv = (v, max) => (h - padB) - (v / max) * (h - padT - padB);

  let hover = null, anim = null;

  function draw(p) {
    ctx.clearRect(0, 0, w, h);
    const max = buckets._max;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let g = 0; g <= 2; g++) {
      const v = max * (1 - g / 2), gy = padT + (g / 2) * (h - padT - padB);
      ctx.strokeStyle = gridColor(); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
      ctx.fillStyle = mutedColor(); ctx.font = '600 10px "Segoe UI", sans-serif';
      ctx.fillText(compact(v), padL - 6, gy);
    }
    const bw = bwOf();
    const barW = Math.min(bw * 0.66, 30);
    const end = Math.min(buckets.length, start + count);
    // space labels by available pixel width so they never overlap
    ctx.font = '600 10px "Segoe UI", sans-serif';
    let maxLW = 0;
    for (let i = start; i < end; i++) { const lw = ctx.measureText(buckets[i].label).width; if (lw > maxLW) maxLW = lw; }
    const labelEvery = Math.max(1, Math.ceil((maxLW + 14) / bw));
    const nowAbs = idxForYM(buckets, nowYM); // anchor the label grid to the current bucket so it's always shown & evenly spaced
    const yBase = h - padB;
    ctx.textBaseline = 'alphabetic';
    for (let i = start; i < end; i++) {
      const b = buckets[i], vi = i - start;
      const xc = padL + (vi + 0.5) * bw, x = xc - barW / 2;
      const isHover = hover === i;
      const dim = hover != null && !isHover ? 0.45 : 1;
      const yTot = Yv(b.total * p, max), yPrin = Yv(b.principal * p, max);
      const r = Math.min(6, barW / 2), intH = yPrin - yTot;
      const gp = ctx.createLinearGradient(0, yPrin, 0, yBase);
      gp.addColorStop(0, hexA(cPrin, 0.95 * dim)); gp.addColorStop(1, hexA(cPrin, 0.5 * dim));
      if (intH < 2.5) {
        ctx.fillStyle = gp; roundRect(ctx, x, yPrin, barW, yBase - yPrin, r); ctx.fill();
      } else {
        ctx.fillStyle = gp; ctx.beginPath(); ctx.rect(x, yPrin, barW, yBase - yPrin); ctx.fill();
        const gi = ctx.createLinearGradient(0, yTot, 0, yPrin);
        gi.addColorStop(0, hexA(cInt, 0.95 * dim)); gi.addColorStop(1, hexA(cInt, 0.6 * dim));
        ctx.fillStyle = gi; roundRect(ctx, x, yTot, barW, intH, r); ctx.fill();
      }
      if (isHover) { ctx.strokeStyle = readVar('--accent', '#8b5cf6'); ctx.lineWidth = 1.4; roundRect(ctx, x, yTot, barW, yBase - yTot, r); ctx.stroke(); }
      if (b.hasNow) { ctx.fillStyle = readVar('--accent', '#8b5cf6'); ctx.beginPath(); ctx.arc(xc, yBase + 6, 2.4, 0, Math.PI * 2); ctx.fill(); }
      if (p > 0.98 && ((((i - nowAbs) % labelEvery) + labelEvery) % labelEvery === 0 || isHover)) {
        ctx.fillStyle = b.hasNow ? readVar('--accent', '#8b5cf6') : mutedColor();
        ctx.font = (b.hasNow ? '700 ' : '600 ') + '10px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(b.label, xc, h - 11);
      }
    }
    if (hover != null && hover >= start && hover < end && p > 0.98) drawTip(hover, bw);
  }

  function drawTip(i, bw) {
    const b = buckets[i], vi = i - start, xc = padL + (vi + 0.5) * bw;
    const lines = [b.label, `Total: ${fmt(b.total)}`, `Dobândă: ${fmt(b.interest)}`, `Principal: ${fmt(b.principal)}`];
    if (level !== 'M') lines.push('medie lunară');
    ctx.font = '600 11px "Segoe UI", sans-serif';
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
    const th = lines.length * 16 + 6;
    let tx = xc + 12; if (tx + tw > w - 4) tx = xc - tw - 12; if (tx < 4) tx = 4;
    const ty = padT + 2;
    ctx.fillStyle = readVar('--surface', '#222'); roundRect(ctx, tx, ty, tw, th, 8); ctx.fill();
    ctx.strokeStyle = gridColor(); ctx.lineWidth = 1; roundRect(ctx, tx, ty, tw, th, 8); ctx.stroke();
    ctx.textAlign = 'left';
    lines.forEach((l, k) => {
      const note = k === lines.length - 1 && level !== 'M';
      ctx.font = (k === 0 ? '700 ' : '600 ') + (note ? '10px' : '11px') + ' "Segoe UI", sans-serif';
      ctx.fillStyle = note ? mutedColor() : k === 0 ? textColor() : k === 2 ? cInt : k === 3 ? cPrin : textColor();
      ctx.fillText(l, tx + 9, ty + 15 + k * 16);
    });
  }

  const render = () => draw(1);
  const stopAnim = () => { if (anim) { anim(); anim = null; } };
  anim = animate((p) => draw(p));

  // ----- interaction: drag to pan, hover for tooltip, wheel/touch to scroll -----
  const xToIdx = (clientX) => { const rc = canvas.getBoundingClientRect(); const vi = Math.floor((clientX - rc.left - padL) / bwOf()); return start + Math.max(0, Math.min(count - 1, vi)); };
  let drag = null;
  const onDrag = (e) => { if (!drag) return; stopAnim(); start = clampStart(drag.start + Math.round((drag.x - e.clientX) / bwOf())); hover = null; render(); };
  const onUp = () => { drag = null; canvas.style.cursor = 'grab'; document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', onUp); };
  const onDown = (e) => { drag = { x: e.clientX, start }; canvas.style.cursor = 'grabbing'; document.addEventListener('mousemove', onDrag); document.addEventListener('mouseup', onUp); };
  const onHover = (e) => { if (drag) return; stopAnim(); hover = xToIdx(e.clientX); render(); };
  const onLeave = () => { if (drag) return; hover = null; render(); };
  // pan only on HORIZONTAL wheel/trackpad; vertical scroll passes through to the page
  const onWheel = (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault(); stopAnim();
    const step = Math.max(1, Math.round(count / 6));
    start = clampStart(start + (e.deltaX > 0 ? step : -step)); render();
  };
  let tdrag = null;
  const onTStart = (e) => { const t = e.touches[0]; tdrag = { x: t.clientX, start, moved: false }; stopAnim(); hover = xToIdx(t.clientX); render(); };
  const onTMove = (e) => { const t = e.touches[0]; if (Math.abs(t.clientX - tdrag.x) > 6) tdrag.moved = true; if (tdrag.moved) { start = clampStart(tdrag.start + Math.round((tdrag.x - t.clientX) / bwOf())); hover = null; } else hover = xToIdx(t.clientX); render(); };

  canvas.style.cursor = 'grab';
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onHover);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTStart, { passive: true });
  canvas.addEventListener('touchmove', onTMove, { passive: true });

  if (canvas._rataCleanup) canvas._rataCleanup();
  canvas._rataCleanup = () => {
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onHover);
    canvas.removeEventListener('mouseleave', onLeave);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('touchstart', onTStart);
    canvas.removeEventListener('touchmove', onTMove);
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onUp);
  };

  return {
    getLevel: () => level,
    destroy: canvas._rataCleanup,
    setLevel(lv) {
      if (!LEVELS.includes(lv) || lv === level) return;
      level = lv; buckets = aggregate(lv);
      count = Math.min(buckets.length, NOMINAL[lv]);
      start = centerNow();
      stopAnim(); hover = null; anim = animate((p) => draw(p));
    },
  };
}

/* ---------- IRCC line — interactive (zoom in/out, pan, hover) ----------
 * `series` = [{ label, fullLabel, value, applicable }]. Returns { zoom(dir), destroy }. */
export function irccChart(canvas, series, { height = 150, fmt = (v) => v.toFixed(2) + '%' } = {}) {
  if (!series || !series.length) return { zoom() {}, destroy() {} };
  const { ctx, w, h } = setup(canvas, height);
  const padL = 46, padR = 14, padT = 16, padB = 24;
  const N = series.length;
  const color = PALETTE[1];
  let count = Math.min(N, 12);
  let start = N - count;
  let hover = null, anim = null;

  const clampCount = (c) => Math.max(4, Math.min(N, c));
  const clampStart = (s) => Math.max(0, Math.min(s, N - count));
  const stepX = () => (w - padL - padR) / Math.max(1, count - 1);

  function draw(p) {
    ctx.clearRect(0, 0, w, h);
    const view = series.slice(start, start + count);
    const vals = view.map((d) => d.value);
    const mx = Math.max(...vals), mn = Math.min(...vals);
    const pad = (mx - mn) * 0.18 || 0.5;
    const lo = Math.max(0, mn - pad), hi = mx + pad;
    const X = (i) => padL + i * stepX();
    const Y = (v) => (h - padB) - ((v - lo) / ((hi - lo) || 1)) * (h - padT - padB);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let g = 0; g <= 2; g++) {
      const v = hi - (g / 2) * (hi - lo), gy = padT + (g / 2) * (h - padT - padB);
      ctx.strokeStyle = gridColor(); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
      ctx.fillStyle = mutedColor(); ctx.font = '600 9.5px "Segoe UI", sans-serif'; ctx.fillText(v.toFixed(1), padL - 6, gy);
    }
    const vis = Math.max(1, Math.floor((count - 1) * p) + 1);
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, hexA(color, .3)); grad.addColorStop(1, hexA(color, .02));
    ctx.beginPath(); ctx.moveTo(X(0), Y(vals[0]));
    for (let i = 1; i < vis; i++) ctx.lineTo(X(i), Y(vals[i]));
    ctx.lineTo(X(vis - 1), h - padB); ctx.lineTo(X(0), h - padB); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(X(0), Y(vals[0]));
    for (let i = 1; i < vis; i++) ctx.lineTo(X(i), Y(vals[i]));
    ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
    for (let i = 0; i < vis; i++) if (view[i].applicable) {
      ctx.beginPath(); ctx.arc(X(i), Y(vals[i]), 4.5, 0, Math.PI * 2); ctx.fillStyle = readVar('--accent', '#8b5cf6'); ctx.fill();
      ctx.strokeStyle = readVar('--bg', '#fff'); ctx.lineWidth = 2; ctx.stroke();
    }
    if (p > 0.98) {
      ctx.fillStyle = mutedColor(); ctx.font = '600 9.5px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const every = Math.max(1, Math.ceil(count / 6));
      view.forEach((d, i) => { if (i % every === 0 || i === count - 1) ctx.fillText(d.label, X(i), h - 8); });
    }
    if (hover != null && hover >= 0 && hover < vis && p > 0.98) {
      const d = view[hover], x = X(hover), y = Y(vals[hover]);
      ctx.strokeStyle = mutedColor(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = readVar('--bg', '#fff'); ctx.lineWidth = 2; ctx.stroke();
      const lines = [d.fullLabel || d.label, fmt(d.value)]; if (d.applicable) lines.push('aplicabil acum');
      ctx.font = '600 11px "Segoe UI", sans-serif';
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16, th = lines.length * 15 + 8;
      let tx = x + 10; if (tx + tw > w - 4) tx = x - tw - 10; if (tx < 4) tx = 4; const ty = padT;
      ctx.fillStyle = readVar('--surface', '#222'); roundRect(ctx, tx, ty, tw, th, 8); ctx.fill();
      ctx.strokeStyle = gridColor(); ctx.lineWidth = 1; roundRect(ctx, tx, ty, tw, th, 8); ctx.stroke();
      ctx.textAlign = 'left';
      lines.forEach((l, k) => { const note = k === lines.length - 1 && d.applicable; ctx.font = (k === 0 ? '700 ' : '600 ') + (note ? '9.5px' : '11px') + ' "Segoe UI", sans-serif'; ctx.fillStyle = note ? readVar('--accent', '#8b5cf6') : k === 0 ? textColor() : color; ctx.fillText(l, tx + 8, ty + 14 + k * 15); });
    }
  }

  const render = () => draw(1);
  const stopAnim = () => { if (anim) { anim(); anim = null; } };
  anim = animate((p) => draw(p));

  const xToIdx = (clientX) => { const rc = canvas.getBoundingClientRect(); return Math.max(0, Math.min(count - 1, Math.round((clientX - rc.left - padL) / stepX()))); };
  let drag = null;
  const onHover = (e) => { if (drag) return; stopAnim(); hover = xToIdx(e.clientX); render(); };
  const onLeave = () => { if (drag) return; hover = null; render(); };
  const onDrag = (e) => { if (!drag) return; stopAnim(); start = clampStart(drag.start + Math.round((drag.x - e.clientX) / stepX())); hover = null; render(); };
  const onUp = () => { drag = null; canvas.style.cursor = 'grab'; document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', onUp); };
  const onDown = (e) => { drag = { x: e.clientX, start }; canvas.style.cursor = 'grabbing'; document.addEventListener('mousemove', onDrag); document.addEventListener('mouseup', onUp); };
  const zoom = (dir) => { const center = start + count / 2; count = clampCount(count + (dir > 0 ? 4 : -4)); start = clampStart(Math.round(center - count / 2)); stopAnim(); hover = null; anim = animate((p) => draw(p)); };
  const onWheel = (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1 : -1); };
  // touch: one finger pans, two fingers pinch-zoom (spread = zoom in, pinch = zoom out)
  let tdrag = null, pinch = null;
  const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTStart = (e) => {
    if (e.touches.length >= 2) { tdrag = null; pinch = { d: touchDist(e.touches) || 1, count, center: start + count / 2 }; hover = null; stopAnim(); render(); return; }
    pinch = null; const t = e.touches[0]; tdrag = { x: t.clientX, start, moved: false }; stopAnim(); hover = xToIdx(t.clientX); render();
  };
  const onTMove = (e) => {
    if (pinch && e.touches.length >= 2) {
      e.preventDefault(); // stop the page from zooming
      const ratio = touchDist(e.touches) / pinch.d; // >1 fingers spread apart
      const nc = clampCount(Math.round(pinch.count / ratio)); // spread → fewer buckets → zoom in
      if (nc !== count) { count = nc; start = clampStart(Math.round(pinch.center - count / 2)); stopAnim(); hover = null; render(); }
      return;
    }
    if (!tdrag) return;
    const t = e.touches[0]; if (Math.abs(t.clientX - tdrag.x) > 6) tdrag.moved = true;
    if (tdrag.moved) { start = clampStart(tdrag.start + Math.round((tdrag.x - t.clientX) / stepX())); hover = null; } else hover = xToIdx(t.clientX);
    render();
  };
  const onTEnd = (e) => { if (!e.touches || e.touches.length < 2) pinch = null; if (!e.touches || e.touches.length === 0) tdrag = null; };

  canvas.style.cursor = 'grab';
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onHover);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTStart, { passive: true });
  canvas.addEventListener('touchmove', onTMove, { passive: false });
  canvas.addEventListener('touchend', onTEnd, { passive: true });
  canvas.addEventListener('touchcancel', onTEnd, { passive: true });
  if (canvas._irccCleanup) canvas._irccCleanup();
  canvas._irccCleanup = () => {
    canvas.removeEventListener('mousedown', onDown); canvas.removeEventListener('mousemove', onHover); canvas.removeEventListener('mouseleave', onLeave);
    canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('touchstart', onTStart); canvas.removeEventListener('touchmove', onTMove);
    canvas.removeEventListener('touchend', onTEnd); canvas.removeEventListener('touchcancel', onTEnd);
    document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', onUp);
  };
  return { zoom, destroy: canvas._irccCleanup };
}

/* ---------- Progress ring ---------- */
export function ring(canvas, pct, { size = 160, thickness = 14, color = PALETTE[0], label } = {}) {
  const { ctx, w, h } = setup(canvas, size);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - thickness / 2 - 4;
  const target = Math.max(0, Math.min(1, pct));
  return animate((p) => {
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.lineWidth = thickness; ctx.strokeStyle = gridColor(); ctx.stroke();
    const a = target * p;
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + a * Math.PI * 2);
    ctx.lineWidth = thickness; ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.stroke();
    ctx.fillStyle = textColor(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 26px "Segoe UI", sans-serif';
    ctx.fillText(Math.round(a * 100) + '%', cx, cy - (label ? 9 : 0));
    if (label) { ctx.fillStyle = mutedColor(); ctx.font = '600 11px "Segoe UI", sans-serif'; ctx.fillText(label, cx, cy + 15); }
  }, 900);
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  if (h <= 0) { ctx.beginPath(); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, 0);
  ctx.arcTo(x, y + h, x, y, 0);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* responsive: re-run a draw fn on resize (debounced) */
export function responsive(drawFn) {
  let t;
  const handler = () => { clearTimeout(t); t = setTimeout(drawFn, 150); };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}
