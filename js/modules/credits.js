// Module: Monitorizare credite (tipuri predefinite, IRCC, plăți în avans)
import { db, amortization, effectiveRate, applicableIRCC, getIRCC, prepaymentSavings, simulate, irccAlert, ackIRCC, upsertIRCC, removeIRCC, nextIRCCQuarter } from '../store.js';
import { icon, el, money, numMoney, fmtDate, esc, modal, toast, confirmDialog, hydrateIcons, todayISO, uid, $, $$, getDisplayCurrency, fromDisplayAmount, toDisplayAmount } from '../ui.js';
import { rataChart, irccChart, donut, PALETTE } from '../charts.js';

/* ---------- predefined credit types ---------- */
const TYPES = [
  { id: 'imobiliar', label: 'Imobiliar', emoji: '🏠', d: { rateType: 'variable', margin: 2.0, termMonths: 360, principal: 300000 } },
  { id: 'nevoi', label: 'Nevoi personale', emoji: '💸', d: { rateType: 'fixed', rate: 9.99, termMonths: 60, principal: 30000 } },
  { id: 'auto', label: 'Auto', emoji: '🚗', d: { rateType: 'fixed', rate: 8.49, termMonths: 84, principal: 60000 } },
  { id: 'refinantare', label: 'Refinanțare', emoji: '🔄', d: { rateType: 'variable', margin: 1.9, termMonths: 120, principal: 80000 } },
  { id: 'card', label: 'Card de credit', emoji: '💳', d: { rateType: 'fixed', rate: 24.0, termMonths: 24, principal: 10000 } },
  { id: 'altul', label: 'Altul', emoji: '📄', d: { rateType: 'fixed', rate: 9.0, termMonths: 48, principal: 20000 } },
];
const typeOf = (id) => TYPES.find((t) => t.id === id) || TYPES[TYPES.length - 1];
const MONTHS_RO = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.'];
const monthYear = (d) => `${MONTHS_RO[d.getMonth()]} ${d.getFullYear()}`;
// "30 ani", "2 ani 6 luni", "8 luni" — a months count expressed in years
const moYears = (m) => { m = +m || 0; const y = Math.floor(m / 12), mo = m % 12; return [y ? `${y} ${y === 1 ? 'an' : 'ani'}` : '', mo ? `${mo} ${mo === 1 ? 'lună' : 'luni'}` : ''].filter(Boolean).join(' ') || '0 luni'; };
// the months-in-years value, rendered as a soft parenthetical (e.g. " (30 ani)")
const yrsPar = (m) => ` <span style="color:var(--faint);font-weight:500"> (${moYears(m)})</span>`;

// up/down trend pill — `diff` = change vs the previous period (positive = went up).
// withVal=false shows only the arrow (for tight spots like table rows).
const trendArrow = (diff, withVal = true) => {
  const d = Math.round((+diff || 0) * 100) / 100;
  if (!d) return '';
  const up = d > 0;
  return `<span class="trend trend--${up ? 'up' : 'down'}" title="${up ? '+' : ''}${d.toFixed(2)} p.p. față de trimestrul precedent">${icon(up ? 'arrowUp' : 'arrowDown')}${withVal ? Math.abs(d).toFixed(2) : ''}</span>`;
};
// Applicable-IRCC change vs the previous quarter (i.e. 3 months earlier).
function irccTrend(date = new Date()) {
  const cur = applicableIRCC(date).value;
  const prev = applicableIRCC(new Date(date.getFullYear(), date.getMonth() - 3, 1)).value;
  return Math.round((cur - prev) * 100) / 100;
}

/* ---------- add / edit form ---------- */
function openForm(existing) {
  const c = existing || { name: '', lender: '', type: 'imobiliar', principal: 300000, rate: 9, rateType: 'variable', margin: 2.0, termMonths: 360, startDate: todayISO(), firstPaymentDate: todayISO(), paymentDay: 1, prepayments: [] };
  let rateType = c.rateType || 'fixed';

  const form = el(`<form>
    <div class="field"><label>Tip credit</label><div class="chip-row" id="types"></div></div>
    <div class="field"><label>Denumire</label><input class="input" name="name" required value="${esc(c.name)}" placeholder="ex. Apartament"></div>
    <div class="field"><label>Creditor / bancă</label><input class="input" name="lender" value="${esc(c.lender)}" placeholder="ex. BCR"></div>
    <div class="field-row">
      <div class="field"><label>Sumă împrumutată (RON)</label><input class="input" name="principal" type="number" min="0" step="any" required value="${c.principal}"></div>
      <div class="field"><label class="row row--between" style="gap:8px"><span>Durată (luni)</span><span class="field__hint" id="termYears"></span></label><input class="input" name="termMonths" type="number" min="1" step="1" required value="${c.termMonths}"></div>
    </div>
    <div class="field"><label>Tip dobândă</label>
      <div class="chip-row"><button type="button" class="chip" data-rt="fixed">Fixă</button><button type="button" class="chip" data-rt="variable">Variabilă (IRCC)</button><button type="button" class="chip" data-rt="mixed">Fixă, apoi variabilă</button></div>
    </div>
    <div class="field" id="grpFixed"><label id="lblFixed">Dobândă anuală (%)</label><input class="input" name="rate" type="number" min="0" step="any" value="${c.rate || 9}"></div>
    <div class="field" id="grpMixed"><label>Ani cu dobândă fixă la început</label><input class="input" name="fixedYears" type="number" min="0" step="1" value="${c.fixedYears || 5}"></div>
    <div id="grpVar">
      <div class="field"><label>Marjă fixă a băncii (%)</label><input class="input" name="margin" type="number" min="0" step="any" value="${c.margin || 0}"></div>
      <div class="card" id="irccBox" style="padding:12px 14px;margin-bottom:14px"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Data acordării</label><input class="input" name="startDate" type="date" required value="${c.startDate}"></div>
      <div class="field"><label class="row row--between" style="gap:8px"><span>Prima rată</span><span class="field__hint" id="fpdHint">prima lună de plată</span></label><input class="input" name="firstPaymentDate" type="date" value="${c.firstPaymentDate || c.startDate}"></div>
    </div>
    <div class="field"><label>Ziua plății ratei (din lună)</label><input class="input" name="paymentDay" type="number" min="1" max="28" step="1" required value="${c.paymentDay || 1}"></div>
  </form>`);

  // type chips
  const typesRow = $('#types', form);
  TYPES.forEach((t) => {
    const b = el(`<button type="button" class="chip ${c.type === t.id ? 'is-active' : ''}" data-type="${t.id}">${t.emoji} ${t.label}</button>`);
    b.onclick = () => {
      $$('#types .chip', form).forEach((x) => x.classList.toggle('is-active', x === b));
      const d = t.d;
      form.principal.value = d.principal; form.termMonths.value = d.termMonths;
      rateType = d.rateType || 'fixed';
      if (d.rate != null) form.rate.value = d.rate;
      if (d.margin != null) form.margin.value = d.margin;
      if (!form.name.value) form.name.value = t.label;
      form.dataset.type = t.id;
      applyRateType();
      updYears();
    };
    typesRow.appendChild(b);
  });
  form.dataset.type = c.type || 'imobiliar';

  // Live hint under "Prima rată": days between disbursement and the first rate, and the daily
  // interest (Actual/365) that accrues over them — mirrors the amortization engine's stub period.
  function updStub() {
    const s = new Date(form.startDate.value + 'T00:00:00'), f = new Date(form.firstPaymentDate.value + 'T00:00:00');
    const days = (!isNaN(s) && !isNaN(f)) ? Math.round((f - s) / 86400000) : 0;
    if (days <= 0) { $('#fpdHint', form).textContent = 'prima lună de plată'; return; }
    const annual = rateType === 'variable' ? applicableIRCC().value + (+form.margin.value || 0) : (+form.rate.value || 0);
    const est = (+form.principal.value || 0) * (annual / 100 / 365) * days;
    $('#fpdHint', form).textContent = `${days} zile · dobândă ≈ ${money(est, true)}`;
  }
  ['startDate', 'firstPaymentDate', 'principal', 'rate'].forEach((n) => form[n].addEventListener('input', updStub));

  function applyRateType() {
    $$('[data-rt]', form).forEach((b) => b.classList.toggle('is-active', b.dataset.rt === rateType));
    const isFixed = rateType === 'fixed', isVar = rateType === 'variable', isMixed = rateType === 'mixed';
    $('#grpFixed', form).style.display = (isFixed || isMixed) ? '' : 'none';
    $('#grpMixed', form).style.display = isMixed ? '' : 'none';
    $('#grpVar', form).style.display = (isVar || isMixed) ? '' : 'none';
    $('#lblFixed', form).textContent = isMixed ? 'Dobândă fixă inițială (%)' : 'Dobândă anuală (%)';
    if (isVar || isMixed) {
      const ir = applicableIRCC();
      const margin = +form.margin.value || 0;
      const note = isMixed ? `<div class="faint" style="font-size:11.5px;margin-top:6px">După perioada fixă, rata devine IRCC + marjă (trimestrul ${esc(ir.source)}).</div>`
        : `<div class="faint" style="font-size:11.5px;margin-top:6px">Sursă: trimestrul ${esc(ir.source)} (decalaj de 2 trimestre)</div>`;
      $('#irccBox', form).innerHTML = `<div class="row row--between"><span class="muted" style="font-size:13px">IRCC aplicabil (${esc(ir.applies)})</span><strong>${ir.value.toFixed(2)}%</strong></div>
        <div class="row row--between" style="margin-top:4px"><span class="muted" style="font-size:13px">+ marjă</span><strong>${margin.toFixed(2)}%</strong></div>
        <hr class="divider" style="margin:8px 0"><div class="row row--between"><span style="font-size:13px">Dobândă ${isMixed ? 'după perioada fixă' : 'curentă'}</span><strong style="color:var(--accent)">${(ir.value + margin).toFixed(2)}%</strong></div>
        ${note}`;
    }
    updStub();
  }
  $$('[data-rt]', form).forEach((b) => b.onclick = () => { rateType = b.dataset.rt; applyRateType(); });
  form.margin.addEventListener('input', () => applyRateType());
  applyRateType();

  // live "Durată (luni)" → years hint
  const termYears = $('#termYears', form);
  const updYears = () => { const m = +form.termMonths.value || 0; const y = Math.floor(m / 12), mo = m % 12; termYears.textContent = m ? `≈ ${y ? `${y} ${y === 1 ? 'an' : 'ani'}` : ''}${mo ? ` ${mo} l` : ''}`.trim() : ''; };
  form.termMonths.addEventListener('input', updYears);
  updYears();

  modal({
    title: existing ? 'Editează credit' : 'Adaugă credit', size: 580, body: form,
    footer: el(`<div class="row" style="width:100%;gap:10px;align-items:center;flex-wrap:nowrap">${existing ? `<button class="icon-btn icon-btn--danger" data-delete title="Șterge creditul" style="flex:none">${icon('trash')}</button>` : ''}<span class="spacer"></span><button class="btn btn--ghost" data-cancel style="white-space:nowrap">Anulează</button><button class="btn" data-save style="white-space:nowrap">${icon('check')}Salvează</button></div>`),
    onMount: ({ root, close }) => {
      $('[data-cancel]', root).onclick = close;
      const delBtn = $('[data-delete]', root);
      if (delBtn) delBtn.onclick = async () => {
        const ok = await confirmDialog(`Ștergi creditul „${existing.name}”?`);
        if (ok) { db.remove('credits', existing.id); toast('Credit șters', 'ok'); }
        else openForm(existing); // confirm replaced this modal — reopen the edit form
      };
      $('[data-save]', root).onclick = () => {
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        const data = {
          name: fd.get('name').trim(), lender: fd.get('lender').trim(), type: form.dataset.type,
          principal: +fd.get('principal'), termMonths: +fd.get('termMonths'),
          rateType, rate: +fd.get('rate') || 0, margin: +fd.get('margin') || 0, fixedYears: +fd.get('fixedYears') || 0,
          startDate: fd.get('startDate'),
          firstPaymentDate: fd.get('firstPaymentDate') || fd.get('startDate'),
          paymentDay: Math.min(28, Math.max(1, +fd.get('paymentDay') || 1)),
          extraMonthly: 0, // recurring extra is no longer stored on the credit (simulate-only)
          prepayments: existing ? (existing.prepayments || []) : [],
        };
        if (existing) db.update('credits', existing.id, data); else db.add('credits', data);
        close(); toast(existing ? 'Credit actualizat' : 'Credit adăugat', 'ok');
      };
    },
  });
}

/* ---------- prepayment tool: simulate live, then add (inline within detail) ----------
 * All money inputs/outputs are in the active display currency (RON or EUR); they are
 * converted to RON for the engine. The recurring "plată lunară suplimentară" is
 * simulation-only — it is never saved on the credit. */
// Smallest extra lump (RON, on top of `baseAmount`) needed to shave one more month off the term.
function amountForOneMoreMonth(cur, baseAmount, date, extra, baseTermUsed) {
  const remaining = amortization(cur).remaining;
  if (!(remaining > 1) || baseTermUsed <= 1) return null;
  const target = baseTermUsed - 1;
  const tu = (amt) => simulate(cur, { prepay: { amount: amt, date, mode: 'term' }, extraMonthly: extra, extraFrom: date }).scenario.termUsed;
  let lo = baseAmount, hi = baseAmount + remaining;
  if (tu(hi) > target) return null; // even paying off the whole balance won't drop another month
  for (let i = 0; i < 24 && hi - lo > 1; i++) { const mid = (lo + hi) / 2; if (tu(mid) <= target) hi = mid; else lo = mid; }
  return Math.ceil(hi - baseAmount);
}

function prepaymentTool(creditId, onApply, onClose) {
  const unit = getDisplayCurrency();
  const wrap = el(`<div class="card" style="padding:14px;margin-top:10px;border-color:color-mix(in srgb,var(--accent) 28%,var(--border))">
    <div class="row" style="gap:9px;margin-bottom:8px"><button type="button" class="stat__chip" id="simClose" title="Închide secțiunea" style="color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);border:0;cursor:pointer">${icon('arrowUp')}</button><strong style="font-size:14.5px">Adaugă o plată în avans</strong></div>
    <p class="muted" style="font-size:12.5px;margin:0 0 12px">Vezi pe loc cât economisești, apoi apasă „Adaugă” ca s-o salvezi pe credit.</p>
    <div class="field-row field-row--keep" style="margin-bottom:8px">
      <div class="field" style="margin:0"><label>Plată în avans (${unit})</label><input class="input" id="simAmount" type="number" min="0" step="any" placeholder="0"></div>
      <div class="field" style="margin:0"><label>Data</label><input class="input" id="simDate" type="date" value="${todayISO()}"></div>
    </div>
    <div class="field" style="margin-bottom:12px"><label>Efect</label>
      <div class="seg seg--block" id="simMode" role="group">
        <button type="button" class="seg__btn is-active" data-v="term">Reduce durata</button>
        <button type="button" class="seg__btn" data-v="rate">Reduce rata</button>
      </div>
    </div>
    <div class="field" style="margin-bottom:12px"><label class="row row--between" style="gap:8px"><span>Plată lunară supl. (${unit})</span><span class="field__hint">doar simulare</span></label><input class="input" id="simExtra" type="number" min="0" step="any" placeholder="0"></div>
    <div id="simResult"></div>
    <button class="btn btn--block btn--sm" id="simApply" style="margin-top:12px">${icon('plus')}Adaugă plata în avans</button>
  </div>`);
  hydrateIcons(wrap);
  const out = $('#simResult', wrap);
  const applyBtn = $('#simApply', wrap);
  const seg = $('#simMode', wrap);
  const getMode = () => { const b = $('.seg__btn.is-active', seg); return b ? b.dataset.v : 'term'; };
  // The recurring extra is simulation-only → the Add button is for the lump prepayment only,
  // and is disabled while the extra field holds a value (nothing to save) or there's no lump.
  function setApplyState(amount, extra) {
    const off = !(amount > 0) || extra > 0;
    applyBtn.disabled = off;
    applyBtn.style.opacity = off ? '.5' : '';
    applyBtn.style.cursor = off ? 'not-allowed' : 'pointer';
    applyBtn.title = extra > 0 ? 'Plata lunară suplimentară e doar pentru simulare — nu se salvează' : (amount > 0 ? '' : 'Introdu o sumă în avans');
  }
  function run() {
    const cur = db.get('credits', creditId);
    const amount = fromDisplayAmount(+$('#simAmount', wrap).value || 0);
    const date = $('#simDate', wrap).value;
    const extra = fromDisplayAmount(+$('#simExtra', wrap).value || 0);
    const mode = getMode();
    setApplyState(amount, extra);
    if (!(amount > 0 || extra > 0)) { out.innerHTML = `<p class="faint" style="font-size:12.5px;text-align:center;margin:2px 0">Introdu o sumă sau o plată lunară ca să vezi impactul.</p>`; return; }
    const baseline = amortization(cur);
    // savings + payoff use the full what-if: the lump at `date`, plus the recurring extra paid
    // every month FROM `date` onward (on the payment day) — never retroactively in past months.
    const r = simulate(cur, { prepay: amount > 0 ? { amount, date, mode } : null, extraMonthly: extra, extraFrom: date });
    // intuitive "new monthly payment": only a 'rate' lump changes the contractual installment;
    // a 'term' lump keeps it; the recurring extra is simply added on top.
    let contractual = baseline.pmt;
    if (mode === 'rate' && amount > 0) contractual = simulate(cur, { prepay: { amount, date, mode: 'rate' }, extraMonthly: 0 }).scenario.pmt;
    const newRate = contractual + extra;
    const delta = newRate - baseline.pmt;
    const m = Math.max(0, r.monthsSaved || 0), yrs = Math.floor(m / 12), mo = m % 12;
    const timeStr = m <= 0 ? '—' : [yrs ? `${yrs} ${yrs === 1 ? 'an' : 'ani'}` : '', mo ? `${mo} ${mo === 1 ? 'lună' : 'luni'}` : ''].filter(Boolean).join(' ');
    // how much MORE lump (alone, ignoring the recurring extra) shaves one additional month —
    // only meaningful when there is a lump in 'term' mode; shown under "Timp economisit"
    let hintSub = '';
    if (mode === 'term' && amount > 0 && date) {
      const lumpTerm = simulate(cur, { prepay: { amount, date, mode: 'term' } }).scenario.termUsed;
      const need = amountForOneMoreMonth(cur, amount, date, 0, lumpTerm);
      if (need != null && need > 0) hintSub = `Încă ${money(need)} ca să scazi încă o lună`;
    }
    out.innerHTML = `<div class="grid grid--2" style="gap:10px;align-items:stretch">
      <div class="stat"><div class="stat__label">${icon('trending')}Economie dobândă</div><div class="stat__value" style="font-size:19px;color:var(--ok)">${money(r.interestSaved)}</div></div>
      <div class="stat"><div class="stat__label">${icon('clock')}Timp economisit</div><div class="stat__value" style="font-size:19px">${timeStr}</div>${hintSub ? `<div class="stat__sub muted" style="margin-top:5px;font-size:11px;line-height:1.35">${hintSub}</div>` : ''}</div>
    </div>
    <div class="row row--between" style="margin-top:11px;font-size:13px"><span class="muted">Rată lunară nouă</span><strong>${newRate > 0 ? money(newRate, true) : '—'}${Math.abs(delta) >= 0.01 ? ` <span class="muted" style="font-weight:400">(${delta > 0 ? '+' : ''}${money(delta, true)})</span>` : ''}</strong></div>
    <div class="row row--between" style="margin-top:4px;font-size:13px"><span class="muted">Achitare estimată</span><strong>${monthYear(r.scenario.payoffDate)}</strong></div>`;
    hydrateIcons(out);
  }
  ['#simAmount', '#simDate', '#simExtra'].forEach((s) => { const e = $(s, wrap); e.addEventListener('input', run); e.addEventListener('change', run); });
  $$('.seg__btn', seg).forEach((b) => b.onclick = () => { $$('.seg__btn', seg).forEach((x) => x.classList.toggle('is-active', x === b)); run(); });
  run();
  applyBtn.onclick = () => {
    if (applyBtn.disabled) return;
    const cur = db.get('credits', creditId);
    const amount = fromDisplayAmount(+$('#simAmount', wrap).value || 0);
    const date = $('#simDate', wrap).value;
    if (amount <= 0 || !date) { toast('Introdu o sumă și o dată', 'bad'); return; }
    const prepayments = [...(cur.prepayments || []), { id: uid(), amount: Math.round(amount * 100) / 100, date, mode: getMode() }];
    db.update('credits', creditId, { prepayments });
    toast('Plată în avans adăugată', 'ok');
    onApply();
  };
  const closeBtn = $('#simClose', wrap);
  if (closeBtn) closeBtn.onclick = () => onClose && onClose();
  return wrap;
}

/* ---------- detail ---------- */
function openDetail(creditId, restoreScroll) {
  const c = db.get('credits', creditId);
  if (!c) return;
  const a = amortization(c);
  const sav = prepaymentSavings(c);
  const now = new Date();
  const isVar = c.rateType === 'variable';
  const isMixed = c.rateType === 'mixed';
  const showIrcc = isVar || isMixed;
  const ir = showIrcc ? applicableIRCC() : null;
  // is the current effective rate IRCC-driven right now? (variable always; mixed only after the fixed period)
  const startD = new Date((c.startDate || '') + 'T00:00:00');
  const monthsIn = isNaN(startD) ? 0 : (now.getFullYear() - startD.getFullYear()) * 12 + (now.getMonth() - startD.getMonth());
  const varNow = isVar || (isMixed && monthsIn >= (+c.fixedYears || 0) * 12);
  const prepays = c.prepayments || [];
  // current installment split → mini pie + percentages
  const cb = a.breakdown[Math.min(a.paidMonths, a.breakdown.length - 1)] || { principal: 0, interest: 0 };
  const cbTot = (cb.principal || 0) + (cb.interest || 0);
  const pPct = cbTot ? Math.round(cb.principal / cbTot * 100) : 0;
  const iPct = cbTot ? 100 - pPct : 0;
  const repaidPct = Math.max(0, Math.min(100, Math.round(a.paidPrincipal / c.principal * 100)));

  const body = el(`<div class="modal__inner">
    <div class="row" style="gap:6px;margin-bottom:14px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      <span class="badge badge--accent" style="flex:none">${typeOf(c.type).emoji} ${esc(typeOf(c.type).label)}</span>
      <span class="badge" style="flex:none">${isMixed ? 'Fixă → variabilă' : isVar ? 'Variabilă' : 'Fixă'}</span>
      <span class="badge" style="flex:none">${a.currentRate.toFixed(2)}%${varNow ? ` ${trendArrow(irccTrend())}` : ''}</span>
      ${c.extraMonthly ? `<span class="badge badge--ok" style="flex:none">+${money(c.extraMonthly)}/lună</span>` : ''}
    </div>
    <div class="grid grid--stat" style="margin-bottom:16px">
      <div class="stat">
        <div class="stat__label">Rată lunară</div>
        <div class="stat__value" style="font-size:22px">${a.pmt > 0 ? money(a.pmt, true) : '—'}</div>
        <div class="row" style="gap:12px;margin-top:10px;align-items:center">
          <canvas id="pmtPie" class="stat__pie" style="width:52px;height:52px;flex:none"></canvas>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;font-size:12.5px">
            <span class="row" style="gap:7px"><span style="width:10px;height:10px;border-radius:3px;background:${PALETTE[2]};flex:none"></span><span class="muted">Principal</span><strong style="margin-left:auto">${pPct}%</strong></span>
            <span class="row" style="gap:7px"><span style="width:10px;height:10px;border-radius:3px;background:${PALETTE[4]};flex:none"></span><span class="muted">Dobândă</span><strong style="margin-left:auto">${iPct}%</strong></span>
          </div>
        </div>
      </div>
      <div class="stat">
        <div class="stat__label">Sold rămas</div>
        <div class="stat__value" style="font-size:22px">${money(a.remaining)}</div>
        <div class="stat__sub muted">din ${money(c.principal)} inițial</div>
        <div class="row row--between" style="margin-top:10px;font-size:12px"><span class="muted">Rambursat</span><strong>${repaidPct}%</strong></div>
        <div class="bar" style="margin-top:5px"><div class="bar__fill" style="width:${repaidPct}%"></div></div>
      </div>
    </div>

    ${showIrcc ? `<div class="card" style="padding:14px;margin-top:16px">
      <div class="row row--between"><span class="muted" style="font-size:13px">IRCC aplicabil (${esc(ir.applies)})</span><strong class="row" style="gap:6px">${ir.value.toFixed(2)}% ${trendArrow(irccTrend())}</strong></div>
      <div class="row row--between" style="margin-top:4px"><span class="muted" style="font-size:13px">+ marjă fixă</span><strong>${(+c.margin || 0).toFixed(2)}%</strong></div>
      ${isMixed && !varNow ? `<div class="row row--between" style="margin-top:4px"><span class="muted" style="font-size:13px">Dobândă fixă (primii ${(+c.fixedYears || 0)} ani)</span><strong>${(+c.rate || 0).toFixed(2)}%</strong></div>` : ''}
      <hr class="divider" style="margin:8px 0"><div class="row row--between"><span style="font-size:13px">${varNow ? 'Dobândă curentă' : 'Dobândă după perioada fixă'}</span><strong style="color:var(--accent)">${(varNow ? a.currentRate : ir.value + (+c.margin || 0)).toFixed(2)}%</strong></div>
    </div>` : ''}

    <div class="row row--between" style="margin-top:18px;gap:10px">
      <div style="display:flex;flex-direction:column;gap:5px;font-size:12px">
        <span class="row" style="gap:6px"><span style="width:11px;height:11px;border-radius:3px;background:${PALETTE[2]};flex:none"></span>Principal</span>
        <span class="row" style="gap:6px"><span style="width:11px;height:11px;border-radius:3px;background:${PALETTE[4]};flex:none"></span>Dobândă</span>
      </div>
      <div class="seg" id="rataZoom">
        <button type="button" class="seg__btn is-active" data-lv="M">Lună</button>
        <button type="button" class="seg__btn" data-lv="Q">Trim.</button>
        <button type="button" class="seg__btn" data-lv="H">Sem.</button>
        <button type="button" class="seg__btn" data-lv="Y">An</button>
      </div>
    </div>
    <div class="canvas-wrap" style="margin-top:10px"><canvas id="rataChart"></canvas></div>
    <p class="muted" style="font-size:12.5px;text-align:center;margin-top:6px">Evoluția ratei lunare — trage stânga/dreapta pe grafic ca să derulezi în timp.</p>

    <div class="section-title" style="margin:18px 2px 10px"><h2 style="font-size:16px">Rate lunare</h2><span class="muted">${a.breakdown.length} rate</span></div>
    <div style="margin:0 2px 12px">
      <div style="display:flex;height:8px;border-radius:6px;overflow:hidden;background:var(--surface-2)">
        <div style="background:var(--ok);width:${Math.round(a.paidMonths / Math.max(1, a.paidMonths + a.monthsLeft) * 100)}%"></div>
        <div style="background:var(--bad);flex:1"></div>
      </div>
      <div class="row row--between" style="margin-top:7px;font-size:12px">
        <span class="row" style="gap:6px"><span style="width:9px;height:9px;border-radius:3px;background:var(--ok);flex:none"></span><span class="muted">Plătite</span><strong>${a.paidMonths}</strong></span>
        <span class="row" style="gap:6px"><span style="width:9px;height:9px;border-radius:3px;background:var(--bad);flex:none"></span><span class="muted">Rămase</span><strong>${a.monthsLeft}</strong></span>
      </div>
    </div>
    <div class="rate-table" id="rateTable">
      <div class="rate-head"><span>Luna</span><span>Rată</span><span>Principal · Dobândă</span></div>
      ${a.breakdown.map((b, i) => {
        const sameMonth = b.date.getFullYear() === now.getFullYear() && b.date.getMonth() === now.getMonth();
        // once this month's payment day has passed, the rate is paid → show it grey, not highlighted
        const dayPassed = sameMonth && now.getDate() >= (a.paymentDay || 1);
        const cur = sameMonth && !dayPassed;
        const paid = i < a.paidMonths || dayPassed;
        return `<div class="rate-row ${cur ? 'is-current' : paid ? 'is-paid' : ''}" ${sameMonth ? 'data-current' : ''}>
          <span class="rate-row__date">${MONTHS_RO[b.date.getMonth()]} ${String(b.date.getFullYear()).slice(2)}</span>
          <span class="rate-row__tot">${money(b.total, true)}</span>
          <span class="rate-row__split"><span style="color:${PALETTE[2]}">${numMoney(b.principal)}</span> · <span style="color:${PALETTE[4]}">${numMoney(b.interest)}</span></span>
        </div>`;
      }).join('')}
    </div>

    <div class="section-title" style="margin:18px 2px 4px"><h2 style="font-size:16px">Plăți în avans</h2></div>
    <div id="ppTotal" class="muted" style="font-size:13px;margin:0 2px 10px;display:none"></div>
    ${(sav.interestSaved > 0 || sav.monthsSaved > 0) ? `<div class="row" style="gap:8px;margin-bottom:12px">
      <span class="badge badge--ok" style="flex:1;justify-content:center;text-align:center">${icon('trending')} Economii dobândă: ${money(sav.interestSaved)}</span>
      ${sav.monthsSaved ? `<span class="badge badge--ok" style="flex:1;justify-content:center;text-align:center">${icon('clock')} ${sav.monthsSaved} luni mai devreme</span>` : ''}
    </div>` : '<p class="muted" style="font-size:13px;margin:0 0 10px">Apasă „Adaugă o plată în avans” ca să testezi o sumă și să vezi pe loc cât economisești.</p>'}
    <div class="list" id="ppList" style="max-height:240px;overflow-y:auto;padding-right:4px"></div>
    <button class="btn btn--block btn--sm" id="ppAddBtn" style="margin-top:12px">${icon('plus')}Adaugă o plată în avans</button>
    <div id="simHost"></div>

    <hr class="divider" style="margin:18px 0">
    <dl class="kvs">
      <dt>Creditor</dt><dd>${esc(c.lender) || '—'}</dd>
      <dt>Sumă inițială</dt><dd>${money(c.principal)}</dd>
      <dt>Durată inițială</dt><dd>${c.termMonths} luni${yrsPar(c.termMonths)}</dd>
      <dt>Acordat</dt><dd>${fmtDate(c.startDate)}</dd>
      <dt>Prima rată</dt><dd>${fmtDate(c.firstPaymentDate || c.startDate)}</dd>
      ${a.stubDays > 0 ? `<dt>Dobândă până la prima rată</dt><dd>${a.stubDays} zile · ${money(a.stubInterest, true)}</dd>` : ''}
      <dt>Ziua plății ratei</dt><dd>ziua ${a.paymentDay} a lunii</dd>
      <dt>Rate plătite</dt><dd>${a.paidMonths} luni${yrsPar(a.paidMonths)}</dd>
      <dt>Rate rămase</dt><dd>${a.monthsLeft} luni${yrsPar(a.monthsLeft)}</dd>
      <dt>Achitare estimată</dt><dd>${monthYear(a.payoffDate)}</dd>
      <dt>Dobândă plătită</dt><dd>${money(a.totalInterest)}</dd>
      <dt>Dobândă totală (estimat)</dt><dd>${money(a.interestTotal)}</dd>
    </dl>
  </div>`);

  // prepayment list
  const ppList = $('#ppList', body);
  const ppTotal = $('#ppTotal', body);
  function drawPP() {
    ppList.innerHTML = '';
    const cur = db.get('credits', creditId);
    const list = cur.prepayments || [];
    const total = list.reduce((s, p) => s + (+p.amount || 0), 0);
    if (list.length) { ppTotal.innerHTML = `Total plătit în avans: <strong style="color:var(--text)">${money(total, true)}</strong> · ${list.length} ${list.length === 1 ? 'plată' : 'plăți'}`; ppTotal.style.display = ''; }
    else ppTotal.style.display = 'none';
    if (!list.length) { ppList.style.display = 'none'; return; }
    ppList.style.display = '';
    [...list].sort((x, y) => y.date.localeCompare(x.date)).forEach((p) => {
      const row = el(`<div class="li" style="padding:10px 13px">
        <span class="stat__chip" style="color:var(--ok);background:rgba(52,211,153,.12)">${icon('arrowDown')}</span>
        <div class="li__main"><div class="li__title" style="font-size:14px">${money(p.amount, true)}</div><div class="li__sub">${fmtDate(p.date)} · ${p.mode === 'rate' ? 'reduce rata' : 'reduce durata'}</div></div>
        <button class="icon-btn" data-del style="width:34px;height:34px">${icon('trash')}</button>
      </div>`);
      $('[data-del]', row).onclick = async () => {
        const sc = _bodyEl ? _bodyEl.scrollTop : 0;
        const ok = await confirmDialog('Ștergi această plată în avans?');
        if (ok) {
          const cc = db.get('credits', creditId);
          db.update('credits', creditId, { prepayments: cc.prepayments.filter((x) => x.id !== p.id) });
          toast('Plată în avans ștearsă', 'ok');
        }
        _close && _close(); openDetail(creditId, sc); // confirm replaced the modal — reopen, keeping scroll
      };
      ppList.appendChild(row);
    });
    hydrateIcons(ppList);
  }
  function reopen() { const sc = _bodyEl ? _bodyEl.scrollTop : 0; _close && _close(); openDetail(creditId, sc); }
  let _close, _bodyEl;

  // #9: RON ⇄ EUR toggle in the header, next to the X
  const curBtn = el(`<button type="button" class="icon-btn" id="curToggle" title="Schimbă moneda afișată (RON ⇄ EUR)"><span style="font-weight:700;font-size:11.5px;letter-spacing:.3px">${getDisplayCurrency()}</span></button>`);

  modal({
    title: c.name, fullscreen: true, autofocus: false, body, headExtra: curBtn,
    onMount: ({ root, close }) => {
      _close = close;
      _bodyEl = $('.modal__body', root);
      $('#curToggle', root).onclick = () => { window.dispatchEvent(new CustomEvent('lh:currency-cycle')); reopen(); };
      if (restoreScroll != null && _bodyEl) requestAnimationFrame(() => { _bodyEl.scrollTop = restoreScroll; });
      hydrateIcons(root);
      drawPP();
      // center the rate table on the current installment
      const rt = $('#rateTable', root);
      const curRow = rt && $('[data-current]', rt);
      if (curRow) rt.scrollTop = Math.max(0, curRow.offsetTop - rt.clientHeight / 2);
      // reveal the prepayment tool only when the user asks for it; the arrow collapses it back
      const addBtn = $('#ppAddBtn', root);
      const simHost = $('#simHost', root);
      addBtn.onclick = () => {
        addBtn.style.display = 'none';
        simHost.appendChild(prepaymentTool(creditId, reopen, () => { simHost.innerHTML = ''; addBtn.style.display = ''; }));
      };
      // interactive, pannable + zoomable monthly-installment chart (total = principal + interest)
      const canvas = $('#rataChart', root);
      const data = a.breakdown.map((b) => ({ date: b.date, total: b.total, interest: b.interest, principal: b.principal }));
      requestAnimationFrame(() => {
        const ctl = rataChart(canvas, data, { height: 230, fmt: (v) => money(v), conv: (v) => toDisplayAmount(v) });
        const seg = $('#rataZoom', root);
        $$('.seg__btn', seg).forEach((btn) => btn.onclick = () => {
          ctl.setLevel(btn.dataset.lv);
          $$('.seg__btn', seg).forEach((x) => x.classList.toggle('is-active', x === btn));
        });
        // mini pie: principal vs dobândă for the current installment
        const pie = $('#pmtPie', root);
        if (pie && cbTot > 0) {
          donut(pie, [{ value: cb.principal, color: PALETTE[2] }, { value: cb.interest, color: PALETTE[4] }], { size: 52, thickness: 8 });
        }
      });
    },
  });
}

/* ---------- card ---------- */
function creditCard(c) {
  const a = amortization(c);
  const pct = Math.min(100, Math.round(a.paidPrincipal / c.principal * 100));
  const done = a.remaining <= 0.5;
  const t = typeOf(c.type);
  const rateTag = c.rateType === 'variable' ? ' var.' : c.rateType === 'mixed' ? ' fixă→var.' : '';
  const card = el(`<div class="card card--interactive">
    <div class="row row--between">
      <div class="row" style="min-width:0"><span class="stat__chip" style="font-size:17px;flex:none">${t.emoji}</span><div style="min-width:0"><div class="li__title">${esc(c.name)}</div><div class="li__sub">${esc(c.lender) || t.label} · ${a.currentRate.toFixed(2)}%${rateTag}</div></div></div>
      <div class="row" style="gap:6px;flex:none">
        <span class="badge ${done ? 'badge--ok' : 'badge--accent'}">${done ? 'Achitat' : a.monthsLeft + ' luni'}</span>
        <button class="icon-btn icon-btn--sm" data-edit title="Editează">${icon('edit')}</button>
      </div>
    </div>
    <div class="row row--between" style="margin:18px 0 6px"><span class="muted">Rată lunară</span><strong style="font-size:18px">${a.pmt > 0 ? money(a.pmt, true) : '—'}</strong></div>
    <div class="bar"><div class="bar__fill" style="width:${pct}%"></div></div>
    <div class="row row--between" style="margin-top:8px;font-size:12.5px"><span class="muted">${money(a.paidPrincipal)} plătit</span><span class="muted">Rămas ${money(a.remaining)}</span></div>
  </div>`);
  card.style.userSelect = 'none';
  $('[data-edit]', card).onclick = (e) => { e.stopPropagation(); openForm(db.get('credits', c.id)); };
  // long-press to delete (mobile-friendly); plain click/tap opens the detail
  let lpTimer = null, lpFired = false, sx = 0, sy = 0;
  const cancelLP = () => { clearTimeout(lpTimer); lpTimer = null; };
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return; // edit icon etc.
    lpFired = false; sx = e.clientX; sy = e.clientY;
    lpTimer = setTimeout(async () => {
      lpFired = true;
      if (await confirmDialog(`Ștergi creditul „${c.name}”?`)) { db.remove('credits', c.id); toast('Credit șters', 'ok'); }
    }, 600);
  });
  card.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) cancelLP(); });
  card.addEventListener('pointerup', cancelLP);
  card.addEventListener('pointercancel', cancelLP);
  card.addEventListener('pointerleave', cancelLP);
  card.addEventListener('contextmenu', (e) => e.preventDefault());
  card.onclick = (e) => { if (lpFired) { lpFired = false; return; } openDetail(c.id); };
  return card;
}

/* ---------- IRCC ---------- */
const trimParts = (code) => { const [y, q] = String(code).split('T'); return { y, q, axis: `T${q} ${String(y).slice(2)}`, full: `T${q} ${y}` }; };

function irccCard() {
  const ir = applicableIRCC();
  const card = el(`<div class="card" style="margin-bottom:8px">
    <div class="row row--between" style="align-items:flex-start;gap:12px">
      <div style="min-width:0">
        <div class="stat__label" style="margin:0">${icon('trending')}IRCC aplicabil acum (${esc(ir.applies)})</div>
        <div class="row" style="gap:8px;margin-top:3px"><div class="stat__value" style="margin:0">${ir.value.toFixed(2)}%</div>${trendArrow(irccTrend())}</div>
        <div class="stat__sub muted" style="margin-top:3px">${esc(ir.source)} (decalaj de două trimestre)</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:none">
        <button type="button" class="icon-btn icon-btn--sm" id="ircEdit" title="Editează IRCC">${icon('edit')}</button>
        <div class="seg">
          <button type="button" class="seg__btn" id="ircZoomOut" title="Micșorează">−</button>
          <button type="button" class="seg__btn" id="ircZoomIn" title="Mărește">+</button>
        </div>
      </div>
    </div>
    <div class="canvas-wrap" style="margin-top:8px"><canvas id="irccChart"></canvas></div>
  </div>`);
  card._draw = () => {
    const list = getIRCC();
    const appCode = applicableIRCC().sourceCode;
    const series = list.map((e) => { const p = trimParts(e.trimestru); return { label: p.axis, fullLabel: p.full, value: e.value, applicable: e.trimestru === appCode }; });
    const ctl = irccChart($('#irccChart', card), series, { height: 168, count: 9 });
    $('#ircZoomIn', card).onclick = () => ctl.zoom(-1);
    $('#ircZoomOut', card).onclick = () => ctl.zoom(1);
  };
  $('#ircEdit', card).onclick = openIRCCManager;
  return card;
}

/* ---------- IRCC manager: full table (descending), add a quarter from a list, inline edit ---------- */
const qAfter = (code) => { const [y, q] = String(code).split('T').map(Number); const idx = y * 4 + (q - 1) + 1; return `${Math.floor(idx / 4)}T${(idx % 4) + 1}`; };

// Custom quarter picker — quarters on the left, years on the right. Replaces the native
// <select> whose option popup renders light on dark themes (ugly + hard to read).
// Returns { el, getValue, setValue }.
function quarterPicker(initialCode, onChange) {
  let [curY, curQ] = String(initialCode).split('T').map(Number);
  // continuous year range: from the earliest IRCC year up to ~6 years ahead (scrollable list)
  const existingYears = getIRCC().map((e) => +String(e.trimestru).split('T')[0]).filter(Number.isFinite);
  const minY = Math.min(curY, ...(existingYears.length ? existingYears : [curY]));
  const maxY = Math.max(curY, new Date().getFullYear() + 6, ...(existingYears.length ? existingYears : [curY]));
  const yearList = []; for (let y = maxY; y >= minY; y--) yearList.push(y);

  const root = el(`<div class="picker"><button type="button" class="picker__btn" data-trig><span data-lbl></span>${icon('arrowDown')}</button></div>`);
  hydrateIcons(root);
  const trig = $('[data-trig]', root), lbl = $('[data-lbl]', root);

  // the popup lives in the modal root (escapes the card's backdrop-filter clipping)
  const pop = el(`<div class="picker__pop"><div class="picker__cols">
    <div class="picker__group"><div class="picker__group-h">Trimestru</div><div class="picker__group" data-qs></div></div>
    <div class="picker__group"><div class="picker__group-h">An</div><div class="picker__group picker__years" data-ys></div></div>
  </div></div>`);
  const qWrap = $('[data-qs]', pop), yWrap = $('[data-ys]', pop);

  const codeNow = () => `${curY}T${curQ}`;
  const updLabel = () => { lbl.textContent = trimParts(codeNow()).full; };
  function renderOpts() {
    qWrap.innerHTML = ''; yWrap.innerHTML = '';
    [1, 2, 3, 4].forEach((q) => {
      const b = el(`<button type="button" class="picker__opt ${q === curQ ? 'is-sel' : ''}">T${q}</button>`);
      b.onclick = () => { curQ = q; renderOpts(); updLabel(); onChange && onChange(codeNow()); };
      qWrap.appendChild(b);
    });
    yearList.forEach((y) => {
      const b = el(`<button type="button" class="picker__opt ${y === curY ? 'is-sel' : ''}">${y}</button>`);
      b.onclick = () => { curY = y; renderOpts(); updLabel(); onChange && onChange(codeNow()); };
      yWrap.appendChild(b);
    });
  }
  function position() {
    const r = trig.getBoundingClientRect();
    pop.style.left = Math.round(r.left) + 'px';
    pop.style.top = Math.round(r.bottom + 6) + 'px';
    pop.style.minWidth = Math.round(r.width) + 'px';
    const pw = pop.offsetWidth;
    if (r.left + pw > window.innerWidth - 8) pop.style.left = Math.max(8, window.innerWidth - 8 - pw) + 'px';
  }
  let open = false;
  const host = () => $('#modalRoot') || document.body;
  const onDoc = (e) => { if (!pop.contains(e.target) && !root.contains(e.target)) setOpen(false); };
  // close only when something OUTSIDE the popup scrolls (e.g. the modal body) — not when the
  // user scrolls the years list inside the popup
  const onScroll = (e) => { if (pop.contains(e.target)) return; setOpen(false); };
  function setOpen(v) {
    if (v === open) return;
    open = v; root.classList.toggle('is-open', v);
    if (v) {
      host().appendChild(pop); pop.classList.add('is-open'); position();
      document.addEventListener('pointerdown', onDoc, true);
      window.addEventListener('scroll', onScroll, true);
    } else {
      pop.classList.remove('is-open'); if (pop.parentNode) pop.parentNode.removeChild(pop);
      document.removeEventListener('pointerdown', onDoc, true);
      window.removeEventListener('scroll', onScroll, true);
    }
  }
  trig.onclick = () => setOpen(!open);
  renderOpts(); updLabel();
  return { el: root, getValue: codeNow, setValue: (code) => { [curY, curQ] = String(code).split('T').map(Number); renderOpts(); updLabel(); } };
}

function openIRCCManager() {
  const body = el(`<div>
    <p class="muted" style="font-size:13px;line-height:1.5;margin:0 0 12px">Valorile IRCC pe trimestre. Indicele aplicabil într-un trimestru e cel de acum 2 trimestre.</p>
    <div class="card" style="padding:13px 14px;margin-bottom:14px">
      <div class="field-row field-row--keep" style="margin-bottom:10px">
        <div class="field" style="margin:0"><label>Trimestru</label><div id="ircTrimHost"></div></div>
        <div class="field" style="margin:0"><label>Valoare (%)</label><input class="input" id="ircVal" type="number" step="0.01" inputmode="decimal" placeholder="ex. 5.60"></div>
      </div>
      <button class="btn btn--block btn--sm" id="ircAdd">${icon('plus')}Adaugă / actualizează</button>
    </div>
    <div class="rate-table" id="ircRows"></div>
  </div>`);

  modal({
    title: 'Indicele IRCC', size: 540, autofocus: false, body,
    footer: el(`<div class="row"><span class="spacer"></span><button class="btn btn--ghost" data-close-mgr>Închide</button></div>`),
    onMount: ({ root, close }) => {
      hydrateIcons(root);
      const rows = $('#ircRows', root);
      const valInput = $('#ircVal', root);

      let picker;
      const syncVal = () => { const cur = getIRCC().find((e) => e.trimestru === picker.getValue()); valInput.value = cur ? cur.value : ''; };
      picker = quarterPicker(nextIRCCQuarter(), syncVal);
      $('#ircTrimHost', root).appendChild(picker.el);

      function draw() {
        const asc = [...getIRCC()]; // chronological — for trend vs the previous quarter
        const appCode = applicableIRCC().sourceCode;
        const list = asc.map((e, i) => ({ ...e, diff: i > 0 ? Math.round((e.value - asc[i - 1].value) * 100) / 100 : 0 })).reverse();
        rows.innerHTML = '';
        list.forEach((e) => {
          const p = trimParts(e.trimestru);
          const app = e.trimestru === appCode;
          const row = el(`<div class="row" style="gap:6px;padding:8px 10px;border-bottom:1px solid var(--border);flex-wrap:nowrap">
            <strong style="flex:none;min-width:50px;font-size:13px">${p.full}</strong>
            <input class="input" data-v type="number" step="0.01" inputmode="decimal" value="${e.value}" style="flex:none;width:64px;padding:7px 8px;font-size:13px">
            <span style="flex:none;min-width:40px">${trendArrow(e.diff)}</span>
            ${app ? '<span class="badge badge--accent" style="flex:none;padding:2px 8px">aplicabil</span>' : ''}
            <span style="flex:1;min-width:0"></span>
            <button class="icon-btn" data-del title="Șterge" style="width:30px;height:30px;flex:none">${icon('trash')}</button>
          </div>`);
          $('[data-v]', row).onchange = (ev) => {
            const v = +ev.target.value;
            if (!isFinite(v)) { toast('Valoare invalidă', 'bad'); ev.target.value = e.value; return; }
            upsertIRCC(e.trimestru, v); toast(`IRCC ${p.full} actualizat`, 'ok'); draw(); syncVal();
          };
          $('[data-del]', row).onclick = async () => {
            const ok = await confirmDialog(`Ștergi IRCC pentru ${p.full}?`);
            if (ok) { removeIRCC(e.trimestru); toast('IRCC șters', 'ok'); }
            close && close(); openIRCCManager(); // confirm replaced this modal — rebuild it
          };
          rows.appendChild(row);
        });
        hydrateIcons(rows);
      }

      $('#ircAdd', root).onclick = async () => {
        const code = picker.getValue();
        const val = valInput.value;
        if (!(code && isFinite(+val) && +val > 0)) { toast('Trimestru sau valoare invalidă', 'bad'); return; }
        const exists = getIRCC().some((e) => e.trimestru === code);
        const ok = await confirmDialog(
          `${exists ? 'Actualizezi' : 'Adaugi'} IRCC pentru ${trimParts(code).full} la ${(+val).toFixed(2)}%?`,
          { danger: false, okLabel: 'Salvează' });
        if (ok) { const saved = upsertIRCC(code, val); if (saved) toast(`IRCC ${trimParts(saved).full} salvat`, 'ok'); }
        close && close(); openIRCCManager(); // confirm replaced this modal — rebuild it
      };
      $('[data-close-mgr]', root).onclick = close;
      syncVal();
      draw();
    },
  });
}

export default {
  title: 'Monitorizare credite',
  primaryAction: () => openForm(),
  topActions(host) {
    const curBtn = el(`<button class="icon-btn" id="curToggleCredits" title="Schimbă moneda afișată (RON ⇄ EUR)"><span style="font-weight:700;font-size:11.5px;letter-spacing:.3px">${getDisplayCurrency()}</span></button>`);
    curBtn.onclick = () => window.dispatchEvent(new CustomEvent('lh:currency-cycle'));
    host.appendChild(curBtn);
    host.appendChild(el(`<button class="btn" id="addCredit">${icon('plus')}Adaugă credit</button>`));
    host.querySelector('#addCredit').onclick = () => openForm();
  },
  render(root) {
    const list = db.all('credits');
    const totalMonthly = list.reduce((s, c) => s + amortization(c).pmt, 0);
    const totalRemaining = list.reduce((s, c) => s + amortization(c).remaining, 0);
    const totalInterest = list.reduce((s, c) => s + amortization(c).totalInterest, 0);

    root.appendChild(el(`<div class="grid grid--stat" style="margin-bottom:6px">
      <div class="stat"><div class="stat__label">${icon('wallet')}Total rate/lună</div><div class="stat__value">${money(totalMonthly)}</div><div class="stat__sub muted">${list.length} credite</div></div>
      <div class="stat"><div class="stat__label">${icon('coins')}Sold total rămas</div><div class="stat__value">${money(totalRemaining)}</div></div>
      <div class="stat"><div class="stat__label">${icon('trending')}Dobândă plătită</div><div class="stat__value">${money(totalInterest)}</div></div>
    </div>`));

    // IRCC quarter-rollover alert (only when the user holds variable-rate credits)
    const alert = irccAlert(list);
    if (alert) {
      const up = alert.diff > 0;
      const banner = el(`<div class="alert-banner">
        <span class="alert-banner__ico">${icon('bell')}</span>
        <div class="alert-banner__txt">
          <strong>IRCC actualizat pentru ${esc(alert.applies)}</strong>
          Indicele aplicabil a trecut de la <strong style="display:inline">${alert.prevValue.toFixed(2)}%</strong> la <strong style="display:inline">${alert.value.toFixed(2)}%</strong>
          (${up ? '+' : ''}${alert.diff.toFixed(2)} p.p., din trimestrul ${esc(alert.source)}).
          Ratele creditelor cu dobândă variabilă ${up ? 'cresc' : 'scad'} — verifică-le mai jos.
        </div>
        <button class="btn btn--ghost btn--sm" id="irccAck">Am înțeles</button>
      </div>`);
      hydrateIcons(banner);
      banner.querySelector('#irccAck').onclick = () => { ackIRCC(); banner.remove(); };
      root.appendChild(banner);
    }

    root.appendChild(el(`<div class="section-title"><h2>Indicele IRCC</h2></div>`));
    const ic = irccCard();
    root.appendChild(ic);
    requestAnimationFrame(() => ic._draw());

    root.appendChild(el(`<div class="section-title"><h2>Creditele tale</h2></div>`));
    if (!list.length) {
      const e = el(`<div></div>`);
      e.innerHTML = `<div class="empty"><div class="empty__icon">${icon('credit')}</div><h3>Niciun credit</h3><p>Alege un tip predefinit (imobiliar, nevoi personale…) și urmărește rata, IRCC și plățile în avans.</p><button class="btn" id="emptyAdd">${icon('plus')}Adaugă credit</button></div>`;
      root.appendChild(e); e.querySelector('#emptyAdd').onclick = () => openForm();
    } else {
      const grid = el(`<div class="grid grid--cards"></div>`);
      list.forEach((c) => grid.appendChild(creditCard(c)));
      root.appendChild(grid);
    }
  },
};
