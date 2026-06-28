// store.js — reactive store with hybrid persistence:
//   • desktop: editable JSON files in /data_storage via the local server API
//   • mobile/no-server: persistent private app storage (localStorage)
// The synchronous `db` API stays the same for modules; only loading/saving changed.
import { uid, todayISO } from './ui.js';

const KEY = 'lifehub:data:v1';
const SETTINGS_KEY = 'lifehub:settings:v1';
const IRCC_KEY = 'lifehub:ircc:v1';
const COLLECTIONS = ['credits', 'notes', 'recipes', 'expenses', 'savings'];

// IRCC quarterly reference values. Loaded from data_storage/ircc.json on desktop;
// this list is the fallback when there's no server (mobile). Edit ircc.json to update.
const FALLBACK_IRCC = [
  { value: 1.17, trimestru: '2021T3' }, { value: 1.86, trimestru: '2021T4' },
  { value: 2.65, trimestru: '2022T1' }, { value: 4.06, trimestru: '2022T2' },
  { value: 5.71, trimestru: '2022T3' }, { value: 5.98, trimestru: '2022T4' },
  { value: 5.94, trimestru: '2023T1' }, { value: 5.96, trimestru: '2023T2' },
  { value: 5.97, trimestru: '2023T3' }, { value: 5.90, trimestru: '2023T4' },
  { value: 5.86, trimestru: '2024T1' }, { value: 5.99, trimestru: '2024T2' },
  { value: 5.66, trimestru: '2024T3' }, { value: 5.55, trimestru: '2024T4' },
  { value: 5.55, trimestru: '2025T1' }, { value: 6.06, trimestru: '2025T2' },
  { value: 5.68, trimestru: '2025T3' }, { value: 5.58, trimestru: '2025T4' },
];
let irccList = FALLBACK_IRCC.slice();

const listeners = new Set();
function emit() { listeners.forEach((fn) => fn()); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ---------- defaults / seed ---------- */
function seed() {
  const now = todayISO();
  const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };
  return {
    credits: [
      { id: uid(), name: 'Apartament', lender: 'BCR', type: 'imobiliar', principal: 320000, rateType: 'variable', margin: 2.0, rate: 0, termMonths: 360, startDate: monthsAgo(20), paymentDay: 15, extraMonthly: 0,
        prepayments: [{ id: uid(), amount: 15000, date: monthsAgo(6), mode: 'term' }] },
      { id: uid(), name: 'Credit auto', lender: 'ING', type: 'auto', principal: 45000, rateType: 'fixed', rate: 8.49, margin: 0, termMonths: 60, startDate: monthsAgo(14), paymentDay: 5, extraMonthly: 0, prepayments: [] },
      { id: uid(), name: 'Nevoi personale', lender: 'Raiffeisen', type: 'nevoi', principal: 20000, rateType: 'fixed', rate: 11.9, margin: 0, termMonths: 36, startDate: monthsAgo(8), paymentDay: 28, extraMonthly: 0, prepayments: [] },
    ],
    notes: [
      { id: uid(), title: 'Listă cumpărături weekend', body: 'Pentru masa de duminică.', pinned: true, color: 0, todos: [
        { id: uid(), text: 'Legume pentru ciorbă', done: true }, { id: uid(), text: 'Pâine de casă', done: false }, { id: uid(), text: 'Cafea', done: false },
      ], updatedAt: now },
      { id: uid(), title: 'Idei cadou', body: 'Aniversare mama — luna viitoare.', pinned: false, color: 2, todos: [], updatedAt: now },
    ],
    recipes: [
      { id: uid(), name: 'Ciorbă de legume', category: 'Supe', emoji: '🥣', servings: 4, minutes: 45, favorite: true,
        ingredients: ['2 morcovi', '1 ceapă', '1 ardei', '100g orez', 'Pătrunjel', 'Borș'],
        steps: ['Călește ceapa și morcovii.', 'Adaugă apă și legumele tăiate.', 'Pune orezul, fierbe 20 min.', 'Acrește cu borș, presară pătrunjel.'] },
      { id: uid(), name: 'Paste cu pesto', category: 'Principal', emoji: '🍝', servings: 2, minutes: 20, favorite: false,
        ingredients: ['200g paste', '4 linguri pesto', 'Parmezan', 'Busuioc'],
        steps: ['Fierbe pastele al dente.', 'Amestecă cu pesto.', 'Presară parmezan și busuioc.'] },
      { id: uid(), name: 'Clătite', category: 'Desert', emoji: '🥞', servings: 4, minutes: 30, favorite: true,
        ingredients: ['2 ouă', '250ml lapte', '150g făină', 'Zahăr', 'Sare'],
        steps: ['Amestecă ingredientele.', 'Lasă aluatul 10 min.', 'Prăjește în tigaie.'] },
    ],
    expenses: [
      ...mkExpenses(),
    ],
    savings: [
      { id: uid(), name: 'Fond de urgență', target: 15000, color: 0, deadline: '', contributions: [
        { id: uid(), amount: 4000, date: monthsAgo(3) }, { id: uid(), amount: 2500, date: monthsAgo(1) }, { id: uid(), amount: 2000, date: now },
      ] },
      { id: uid(), name: 'Vacanță vară', target: 6000, color: 3, deadline: monthsAgoFuture(2), contributions: [
        { id: uid(), amount: 1500, date: monthsAgo(2) }, { id: uid(), amount: 1200, date: now },
      ] },
    ],
  };
}
function monthsAgoFuture(n) { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); }
function mkExpenses() {
  const cats = [
    ['Mâncare', [120, 85, 60, 200, 45, 150]], ['Transport', [50, 80, 120]], ['Utilități', [300, 180]],
    ['Distracție', [90, 140, 60]], ['Sănătate', [70, 110]], ['Cumpărături', [250, 95]],
  ];
  const out = [];
  for (let m = 0; m < 4; m++) {
    const d = new Date(); d.setMonth(d.getMonth() - m);
    cats.forEach(([cat, amts]) => amts.forEach((a, i) => {
      const day = 1 + ((i * 5 + m * 3) % 26);
      const dd = new Date(d.getFullYear(), d.getMonth(), day);
      out.push({ id: uid(), category: cat, amount: Math.round(a * (0.85 + Math.random() * 0.4)), date: dd.toISOString().slice(0, 10), note: '' });
    }));
  }
  return out;
}

/* ---------- persistence ---------- */
let state = blank();
let backend = false;          // true when the file-storage API is reachable (desktop)
let saveTimer = null;
let lastErrors = null;

function blank() { const o = {}; for (const c of COLLECTIONS) o[c] = []; return o; }
function pick(s) { const o = {}; for (const c of COLLECTIONS) o[c] = s[c] || []; return o; }
function fill(data) { const o = {}; for (const c of COLLECTIONS) o[c] = Array.isArray(data[c]) ? data[c] : []; return o; }
function hasAnyData(data) { return COLLECTIONS.some((c) => Array.isArray(data[c]) && data[c].length); }

function localLoad() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function localSave() { try { localStorage.setItem(KEY, JSON.stringify(pick(state))); } catch { /* quota */ } }
function localLoadIRCC() { try { const r = localStorage.getItem(IRCC_KEY); const a = r ? JSON.parse(r) : null; return Array.isArray(a) && a.length ? a : null; } catch { return null; } }
function localSaveIRCC() { try { localStorage.setItem(IRCC_KEY, JSON.stringify(irccList)); } catch { /* quota */ } }

// Boot: choose a backend, load existing data (seeding the store on first run).
export async function init() {
  try {
    const res = await fetch('api/data', { cache: 'no-store' });
    if (res.ok) {
      backend = true;
      const data = await res.json();
      lastErrors = data.__errors || null;
      if (Array.isArray(data.ircc) && data.ircc.length) { irccList = data.ircc; localSaveIRCC(); }
      if (hasAnyData(data)) {
        state = fill(data);
      } else {
        state = seed();          // first run → write demo data to the files
        await saveNow();
      }
      localSave();
      return { backend: true, errors: lastErrors };
    }
  } catch (e) { /* no server → fall through */ }

  backend = false;
  const ls = localLoad();
  state = ls ? fill(ls) : seed();
  if (!ls) localSave();
  const li = localLoadIRCC();
  if (li) irccList = li;
  return { backend: false };
}

// Re-read the files from disk (to pick up manual edits) and refresh the UI.
export async function reload() {
  if (backend) {
    try {
      const res = await fetch('api/data', { cache: 'no-store' });
      if (res.ok) { const data = await res.json(); lastErrors = data.__errors || null; if (Array.isArray(data.ircc) && data.ircc.length) { irccList = data.ircc; localSaveIRCC(); } if (hasAnyData(data)) state = fill(data); localSave(); }
    } catch { /* ignore */ }
  } else {
    const ls = localLoad(); if (ls) state = fill(ls);
  }
  emit();
  return { backend, errors: lastErrors };
}

export function storageInfo() { return { mode: backend ? 'files' : 'local', errors: lastErrors }; }

function persist() {
  localSave();              // always keep a local cache/fallback
  emit();
  if (backend) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 350); }
}
async function saveNow() {
  if (!backend) return;
  try {
    await fetch('api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pick(state)) });
  } catch (e) { /* keep the localStorage copy; will retry on next change */ }
}

/* ---------- generic collection API ---------- */
export const db = {
  all(coll) { return state[coll] || []; },
  get(coll, id) { return (state[coll] || []).find((x) => x.id === id); },
  add(coll, obj) { const item = { id: uid(), ...obj }; state[coll].unshift(item); persist(); return item; },
  update(coll, id, patch) {
    const i = state[coll].findIndex((x) => x.id === id);
    if (i >= 0) { state[coll][i] = { ...state[coll][i], ...patch }; persist(); return state[coll][i]; }
  },
  remove(coll, id) { state[coll] = state[coll].filter((x) => x.id !== id); persist(); },
  raw() { return state; },
  replaceAll(data) { state = fill(data); persist(); },
  reset() { state = seed(); persist(); },
};

/* ---------- settings ---------- */
export const settings = {
  get(k, d) { try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return k in s ? s[k] : d; } catch { return d; } },
  set(k, v) { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); s[k] = v; localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); },
};

/* ---------- backup ---------- */
export function exportData() {
  return JSON.stringify({ app: 'LifeHub', version: 1, exportedAt: new Date().toISOString(), data: state, ircc: irccList }, null, 2);
}
export function importData(json) {
  const parsed = JSON.parse(json);
  const data = parsed.data || parsed;
  if (!data.credits && !data.notes && !data.expenses) throw new Error('Fișier necunoscut');
  // ensure all collections exist
  const def = seed();
  for (const k of Object.keys(def)) if (!Array.isArray(data[k])) data[k] = [];
  db.replaceAll(data);
  // IRCC values travel with the backup too (top-level, or nested under data)
  const ircc = Array.isArray(parsed.ircc) ? parsed.ircc : Array.isArray(data.ircc) ? data.ircc : null;
  if (ircc) replaceIRCC(ircc);
}

/* ---------- IRCC helpers ---------- */
export function getIRCC() { return irccList; }
function parseQ(s) { const [y, t] = String(s).split('T'); return { y: +y, q: +t }; }
function qIndexOf(y, q) { return y * 4 + (q - 1); }
function quarterOfDate(d) { return { y: d.getFullYear(), q: Math.floor(d.getMonth() / 3) + 1 }; }
export function qLabel(y, q) { return `T${q} ${y}`; }

// IRCC applicable in a quarter = the value from two quarters earlier (e.g. Q2 2026 → 2025T4).
export function applicableIRCC(date = new Date()) {
  const { y, q } = quarterOfDate(date);
  const targetIdx = qIndexOf(y, q) - 2;
  const sorted = irccList.map((e) => { const p = parseQ(e.trimestru); return { value: e.value, y: p.y, q: p.q, idx: qIndexOf(p.y, p.q) }; }).sort((a, b) => a.idx - b.idx);
  if (!sorted.length) return { value: 0, source: '', applies: qLabel(y, q) };
  let pick = sorted.find((e) => e.idx === targetIdx);
  if (!pick) pick = targetIdx < sorted[0].idx ? sorted[0] : sorted[sorted.length - 1];
  return { value: pick.value, source: qLabel(pick.y, pick.q), sourceCode: `${pick.y}T${pick.q}`, applies: qLabel(y, q) };
}

/* ---------- IRCC editing (persists to data_storage/ircc.json via the server; localStorage fallback) ---------- */
function sortIRCC() { irccList.sort((a, b) => { const pa = parseQ(a.trimestru), pb = parseQ(b.trimestru); return qIndexOf(pa.y, pa.q) - qIndexOf(pb.y, pb.q); }); }
export function normTrim(s) {
  const str = String(s || '').toUpperCase().replace(/\s+/g, '');
  let m = str.match(/^(\d{4})T?([1-4])$/); if (m) return `${m[1]}T${m[2]}`;
  m = str.match(/^T?([1-4])(\d{4})$/); if (m) return `${m[2]}T${m[1]}`;
  return null;
}
function persistIRCC() {
  localSaveIRCC();
  if (backend) fetch('api/ircc', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(irccList) }).catch(() => {});
  emit();
}
// Add or update one quarter's value. Returns the normalized trimester code, or null if invalid.
export function upsertIRCC(trimestru, value) {
  const t = normTrim(trimestru); if (!t) return null;
  const v = +value; if (!isFinite(v)) return null;
  const i = irccList.findIndex((e) => e.trimestru === t);
  if (i >= 0) irccList[i] = { ...irccList[i], value: round2(v) };
  else irccList = [...irccList, { trimestru: t, value: round2(v) }];
  sortIRCC(); persistIRCC();
  return t;
}
export function removeIRCC(trimestru) {
  const before = irccList.length;
  irccList = irccList.filter((e) => e.trimestru !== trimestru);
  if (irccList.length !== before) persistIRCC();
}
// Replace the whole IRCC list (used by backup import). Sanitises and persists.
export function replaceIRCC(list) {
  if (!Array.isArray(list)) return;
  const clean = [];
  for (const e of list) {
    const t = normTrim(e && e.trimestru);
    const v = e ? +e.value : NaN;
    if (t && isFinite(v)) clean.push({ trimestru: t, value: round2(v) });
  }
  if (!clean.length) return;
  irccList = clean; sortIRCC(); persistIRCC();
}
// The quarter right after the latest one on record (e.g. last 2025T4 → "2026T1").
export function nextIRCCQuarter() {
  if (!irccList.length) { const q = quarterOfDate(new Date()); return `${q.y}T${q.q}`; }
  const last = irccList.map((e) => parseQ(e.trimestru)).sort((a, b) => qIndexOf(a.y, a.q) - qIndexOf(b.y, b.q)).pop();
  const idx = qIndexOf(last.y, last.q) + 1;
  return `${Math.floor(idx / 4)}T${(idx % 4) + 1}`;
}

/* ---------- finance helpers ---------- */
export function monthlyPayment(principal, annualRatePct, months) {
  const r = annualRatePct / 100 / 12;
  if (months <= 0) return principal;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}
function round2(n) { return Math.round(n * 100) / 100; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
// Number of remaining payments needed to amortize balance B at monthly rate r with payment `pay`.
function npers(B, r, pay) {
  if (B <= 0) return 0;
  if (pay <= 0) return Infinity;
  if (r <= 0) return B / pay;
  const denom = pay - B * r;
  if (denom <= 0) return Infinity; // payment doesn't even cover the interest
  return Math.log(pay / denom) / Math.log(1 + r);
}

// Effective annual rate of a credit at a date: fixed → c.rate; variable → IRCC(applicable) + margin;
// mixed → fixed c.rate for the first c.fixedYears years, then variable (IRCC + margin).
export function effectiveRate(c, date = new Date()) {
  if (c.rateType === 'variable') return round2(applicableIRCC(date).value + (+c.margin || 0));
  if (c.rateType === 'mixed') {
    const start = new Date((c.startDate || '') + 'T00:00:00');
    const monthsIn = isNaN(start) ? 0 : (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
    if (monthsIn < (+c.fixedYears || 0) * 12) return +c.rate || 0;
    return round2(applicableIRCC(date).value + (+c.margin || 0));
  }
  return +c.rate || 0;
}

// Month-by-month simulation: variable rate (IRCC+margin, recomputed on change),
// recurring monthly extra, and lump-sum prepayments (mode 'term' shortens duration, 'rate' lowers installment).
export function amortization(c) {
  const principal = +c.principal || 0;
  const term = Math.max(1, +c.termMonths || 1);
  // Installments are scheduled from the first payment date (e.g. loan taken in January
  // but the first rate is due in February). Falls back to the disbursement date.
  const parsed = new Date((c.firstPaymentDate || c.startDate || '') + 'T00:00:00');
  const base = isNaN(parsed) ? new Date() : parsed;
  const now = new Date();
  const payDay = Math.min(28, Math.max(1, +c.paymentDay || base.getDate() || 1));
  const extraMonthly = +c.extraMonthly || +c.extra || 0;
  // The recurring extra applies only from `extraFrom` onward (e.g. "starting from the selected
  // date I pay X extra every month on the payment day"). If unset, it applies for the whole
  // schedule (back-compat). Past months never get the extra — that would overstate the savings.
  const extraFromD = c.extraFrom ? new Date(c.extraFrom + 'T00:00:00') : null;
  const extraFromIdx = (extraFromD && !isNaN(extraFromD)) ? extraFromD.getFullYear() * 12 + extraFromD.getMonth() : -Infinity;
  const prepays = (c.prepayments || []).map((p) => { const d = new Date(p.date + 'T00:00:00'); return { amount: +p.amount || 0, mode: p.mode || 'term', t: d.getTime(), y: d.getFullYear(), m: d.getMonth() }; });
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  const startIdx = base.getFullYear() * 12 + base.getMonth();
  // Number of installments already due: full past months + the current month once its payment day has passed.
  const elapsed = Math.max(0, Math.min(term, nowIdx - startIdx + (now.getDate() >= payDay ? 1 : 0)));

  let balance = principal;
  const schedule = [balance];
  const breakdown = []; // per installment: { date, total, interest, principal } — for the rata chart
  let lastAnnual = null, pmt = 0, remForPmt = term;
  let paidMonths = 0, interestPaid = 0, interestTotal = 0, prepaidTotal = 0, currentPmt = 0, payoffIndex = term;
  let remaining = principal; // principal still owed as of "now"

  for (let m = 0; m < term && balance > 0.005; m++) {
    const md = addMonths(base, m);
    const mdIdx = startIdx + m;
    const eM = mdIdx >= extraFromIdx ? extraMonthly : 0; // recurring extra only from extraFrom onward
    const annual = effectiveRate(c, md);
    const r = annual / 100 / 12;
    if (annual !== lastAnnual) { pmt = monthlyPayment(balance, annual, Math.max(1, remForPmt)); lastAnnual = annual; }
    const interest = balance * r;
    let principalPart = pmt + eM - interest;
    if (principalPart < 0) principalPart = 0;
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
    breakdown.push({ date: md, total: round2(interest + principalPart), interest: round2(interest), principal: round2(principalPart) });
    let monthPrepay = 0, rateAmt = 0, termPrepay = false;
    for (const p of prepays) {
      if (p.y === md.getFullYear() && p.m === md.getMonth() && balance > 0) {
        const amt = Math.min(p.amount, balance);
        balance -= amt; monthPrepay += amt;
        if (p.mode === 'rate') rateAmt += amt; else termPrepay = true;
      }
    }
    let horizonReset = false;
    if (rateAmt > 0) {
      // "reduce rata": lower the installment by exactly the prepaid amount's amortized share,
      // which keeps the payoff date identical and yields a real interest saving.
      pmt = Math.max(0, pmt - monthlyPayment(rateAmt, annual, Math.max(1, Math.round(remForPmt))));
      lastAnnual = annual;
    }
    if (termPrepay) {
      // "reduce durata": keep the installment, shorten the horizon so later recomputes stay accurate
      const hz = npers(balance, r, pmt + eM);
      if (isFinite(hz) && hz > 0) { remForPmt = Math.ceil(hz); horizonReset = true; }
    }
    schedule.push(balance);
    interestTotal += interest;
    if (m < elapsed) {
      // a fully-due month: installment + this month's prepayments are already paid
      paidMonths++; interestPaid += interest; prepaidTotal += monthPrepay; remaining = balance;
    } else if (mdIdx === nowIdx) {
      // current month, installment not yet due — but prepayments already made (date ≤ today) still count
      let snap = remaining;
      for (const p of prepays) if (p.y === md.getFullYear() && p.m === md.getMonth() && p.t <= now.getTime()) { const amt = Math.min(p.amount, snap); snap -= amt; prepaidTotal += amt; }
      remaining = Math.max(0, snap);
      currentPmt = pmt + eM;
    } else if (m === elapsed) {
      currentPmt = pmt + eM;
    }
    if (!horizonReset) remForPmt -= 1;
    if (remForPmt < 1) remForPmt = 1;
    if (balance <= 0.005) { payoffIndex = m + 1; break; }
  }

  if (paidMonths >= payoffIndex) currentPmt = 0;
  else if (!currentPmt) currentPmt = pmt + extraMonthly;
  const monthsLeft = Math.max(0, payoffIndex - paidMonths);
  let nextDueDate = null;
  if (monthsLeft > 0) { const dueIdx = nowIdx + (now.getDate() >= payDay ? 1 : 0); nextDueDate = new Date(Math.floor(dueIdx / 12), dueIdx % 12, payDay); }
  return {
    pmt: currentPmt, remaining, paidMonths, totalInterest: interestPaid, interestTotal,
    schedule, breakdown, paidPrincipal: principal - remaining,
    monthsLeft, payoffDate: addMonths(base, Math.max(0, payoffIndex - 1)), // month of the LAST installment
    prepaidTotal, currentRate: effectiveRate(c, now), termUsed: payoffIndex,
    paymentDay: payDay, nextDueDate,
  };
}

// Interest and months saved purely from prepayments + monthly extra vs. the plain credit.
export function prepaymentSavings(c) {
  const withPre = amortization(c);
  const without = amortization({ ...c, prepayments: [], extraMonthly: 0, extra: 0 });
  return {
    interestSaved: Math.max(0, without.interestTotal - withPre.interestTotal),
    monthsSaved: Math.max(0, without.termUsed - withPre.termUsed),
  };
}

// "What-if" simulator: compare the credit as-is (baseline) against a hypothetical
// scenario (one extra lump-sum prepayment and/or a different recurring monthly extra)
// WITHOUT touching the saved data. Returns both projections plus the deltas.
export function simulate(c, opts = {}) {
  const baseline = amortization(c);
  const sc = { ...c, prepayments: [...(c.prepayments || [])] };
  if (opts.extraMonthly != null) sc.extraMonthly = +opts.extraMonthly || 0;
  // the recurring extra is paid each month from this date onward (defaults to the lump's date)
  if (opts.extraFrom) sc.extraFrom = opts.extraFrom;
  if (opts.prepay && +opts.prepay.amount > 0 && opts.prepay.date) {
    sc.prepayments.push({ id: 'sim', amount: +opts.prepay.amount, date: opts.prepay.date, mode: opts.prepay.mode || 'term' });
  }
  const scenario = amortization(sc);
  return {
    baseline, scenario,
    interestSaved: round2(baseline.interestTotal - scenario.interestTotal),
    monthsSaved: baseline.termUsed - scenario.termUsed,
    pmtDelta: round2(scenario.pmt - baseline.pmt),
  };
}

/* ---------- IRCC quarter-rollover alert ---------- */
// Detects when the applicable IRCC has rolled over to a new quarter (with a different
// value) since the user last acknowledged it — only relevant if they hold variable credits.
export function irccAlert(credits) {
  const ir = applicableIRCC();
  const hasVar = (credits || []).some((c) => c.rateType === 'variable');
  const seen = settings.get('irccSeen', null);
  if (!hasVar) { settings.set('irccSeen', { applies: ir.applies, value: ir.value }); return null; }
  if (!seen) { settings.set('irccSeen', { applies: ir.applies, value: ir.value }); return null; }
  if (seen.applies !== ir.applies && seen.value !== ir.value) {
    return { prevValue: seen.value, prevApplies: seen.applies, value: ir.value, applies: ir.applies, source: ir.source, diff: round2(ir.value - seen.value) };
  }
  if (seen.applies !== ir.applies) settings.set('irccSeen', { applies: ir.applies, value: ir.value }); // value unchanged → quiet ack
  return null;
}
export function ackIRCC() { const ir = applicableIRCC(); settings.set('irccSeen', { applies: ir.applies, value: ir.value }); }
