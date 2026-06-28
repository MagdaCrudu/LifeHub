// Module: Statistici cheltuieli
import { db } from '../store.js';
import { icon, el, esc, money, fmtDate, modal, toast, confirmDialog, monthKey, monthLabel, todayISO, hydrateIcons, $, $$ } from '../ui.js';
import { donut, bars, PALETTE } from '../charts.js';

const CATS = ['Mâncare', 'Transport', 'Utilități', 'Distracție', 'Sănătate', 'Cumpărături', 'Educație', 'Altele'];
let period = 'all'; // 'all' | monthKey

function openForm(existing) {
  const x = existing || { category: 'Mâncare', amount: 0, date: todayISO(), note: '' };
  const form = el(`<form>
    <div class="field"><label>Sumă (RON)</label><input class="input" name="amount" type="number" min="0" step="0.01" required value="${x.amount}" placeholder="0,00"></div>
    <div class="field"><label>Categorie</label><select class="select" name="category">${CATS.map((c) => `<option ${c === x.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label>Data</label><input class="input" name="date" type="date" required value="${x.date}"></div>
    <div class="field"><label>Notă (opțional)</label><input class="input" name="note" value="${esc(x.note)}" placeholder="ex. cumpărături Lidl"></div>
  </form>`);
  modal({
    title: existing ? 'Editează cheltuiala' : 'Adaugă cheltuială', body: form,
    footer: el(`<div class="row"><button class="btn btn--ghost" data-cancel>Anulează</button><button class="btn" data-save>${icon('check')}Salvează</button></div>`),
    onMount: ({ root, close }) => {
      $('[data-cancel]', root).onclick = close;
      $('[data-save]', root).onclick = () => {
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        const data = { category: fd.get('category'), amount: +fd.get('amount'), date: fd.get('date'), note: fd.get('note').trim() };
        if (existing) db.update('expenses', existing.id, data); else db.add('expenses', data);
        close(); toast(existing ? 'Cheltuială actualizată' : 'Cheltuială adăugată', 'ok');
      };
    },
  });
}

export default {
  title: 'Statistici cheltuieli',
  primaryAction: () => openForm(),
  topActions(host) { host.appendChild(el(`<button class="btn" id="addExp">${icon('plus')}Adaugă cheltuială</button>`)); host.querySelector('#addExp').onclick = () => openForm(); },
  render(root) {
    const all = db.all('expenses');
    const months = [...new Set(all.map((e) => monthKey(e.date)))].sort().reverse();
    if (period !== 'all' && !months.includes(period)) period = 'all';

    // period filter chips
    const chips = el(`<div class="chip-row" style="margin-bottom:18px">
      <button class="chip ${period === 'all' ? 'is-active' : ''}" data-p="all">Toate</button>
      ${months.slice(0, 6).map((m) => `<button class="chip ${period === m ? 'is-active' : ''}" data-p="${m}">${monthLabel(m)}</button>`).join('')}
    </div>`);
    root.appendChild(chips);
    $$('[data-p]', chips).forEach((b) => b.onclick = () => { period = b.dataset.p; this.render2(root); });

    this.render2 = (rootEl) => {
      // remove everything except chips
      [...rootEl.children].forEach((c) => { if (c !== chips) c.remove(); });
      $$('[data-p]', chips).forEach((b) => b.classList.toggle('is-active', b.dataset.p === period));

      const list = period === 'all' ? all : all.filter((e) => monthKey(e.date) === period);
      const total = list.reduce((s, e) => s + e.amount, 0);
      const count = list.length;
      const avg = count ? total / count : 0;

      // monthly totals for trend
      const byMonth = {};
      all.forEach((e) => { const k = monthKey(e.date); byMonth[k] = (byMonth[k] || 0) + e.amount; });
      const sortedMonths = Object.keys(byMonth).sort();
      const lastK = sortedMonths[sortedMonths.length - 1];
      const prevK = sortedMonths[sortedMonths.length - 2];
      const delta = prevK ? ((byMonth[lastK] - byMonth[prevK]) / byMonth[prevK]) * 100 : 0;

      // stat tiles
      const stats = el(`<div class="grid grid--stat" style="margin-bottom:8px">
        <div class="stat"><div class="stat__label">${icon('wallet')}Total ${period === 'all' ? '' : monthLabel(period)}</div><div class="stat__value">${money(total)}</div><div class="stat__sub muted">${count} tranzacții</div></div>
        <div class="stat"><div class="stat__label">${icon('coins')}Medie / tranzacție</div><div class="stat__value">${money(avg)}</div></div>
        <div class="stat"><div class="stat__label">${icon('trending')}Față de luna trecută</div><div class="stat__value" style="color:${delta > 0 ? 'var(--bad)' : 'var(--ok)'}">${delta > 0 ? '+' : ''}${Math.round(delta)}%</div><div class="stat__sub muted">pe total lunar</div></div>
      </div>`);
      rootEl.appendChild(stats);

      if (!list.length) {
        const e = el(`<div></div>`);
        e.innerHTML = `<div class="empty"><div class="empty__icon">${icon('chart')}</div><h3>Nicio cheltuială</h3><p>Adaugă cheltuieli pentru a vedea statistici și grafice pe categorii.</p><button class="btn" id="emptyAdd">${icon('plus')}Adaugă cheltuială</button></div>`;
        rootEl.appendChild(e); $('#emptyAdd', e).onclick = () => openForm(); hydrateIcons(e); return;
      }

      // by category
      const byCat = {};
      list.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
      const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));

      // charts row
      const charts = el(`<div class="grid grid--2" style="gap:18px;margin-top:6px">
        <div class="card"><h3 style="margin:0 0 6px;font-size:16px">Pe categorii</h3>
          <div class="row" style="gap:18px;align-items:center;flex-wrap:wrap">
            <div class="canvas-wrap" style="width:200px;flex:none"><canvas id="cDonut"></canvas></div>
            <div class="legend" id="legend" style="flex:1;min-width:160px"></div>
          </div>
        </div>
        <div class="card"><h3 style="margin:0 0 10px;font-size:16px">Evoluție lunară</h3><div class="canvas-wrap"><canvas id="cBars"></canvas></div></div>
      </div>`);
      rootEl.appendChild(charts);

      // legend
      const legend = $('#legend', charts);
      legend.innerHTML = catData.map((d) => `<div class="legend__item"><span class="legend__dot" style="background:${d.color}"></span><span>${esc(d.label)}</span><span class="legend__val">${money(d.value)}</span></div>`).join('');

      // transactions list
      rootEl.appendChild(el(`<div class="section-title"><h2>Tranzacții</h2><span class="muted">${count}</span></div>`));
      const listEl = el(`<div class="list"></div>`);
      [...list].sort((a, b) => b.date.localeCompare(a.date)).forEach((e, i) => {
        const color = PALETTE[CATS.indexOf(e.category) % PALETTE.length] || PALETTE[0];
        const row = el(`<div class="li">
          <span class="legend__dot" style="background:${color};width:13px;height:13px"></span>
          <div class="li__main"><div class="li__title">${esc(e.category)}${e.note ? ` · <span class="muted" style="font-weight:500">${esc(e.note)}</span>` : ''}</div><div class="li__sub">${fmtDate(e.date)}</div></div>
          <strong style="font-size:15px">${money(e.amount, true)}</strong>
          <button class="icon-btn" data-edit style="width:34px;height:34px">${icon('edit')}</button>
          <button class="icon-btn" data-del style="width:34px;height:34px">${icon('trash')}</button>
        </div>`);
        $('[data-edit]', row).onclick = () => openForm(e);
        $('[data-del]', row).onclick = async () => { if (await confirmDialog('Ștergi această cheltuială?')) { db.remove('expenses', e.id); toast('Șters', 'ok'); } };
        listEl.appendChild(row);
      });
      rootEl.appendChild(listEl);
      hydrateIcons(rootEl);

      // draw canvases
      requestAnimationFrame(() => {
        donut($('#cDonut', charts), catData, { size: 200, centerTop: money(total), centerSub: 'Total' });
        const barData = sortedMonths.slice(-6).map((k) => ({ label: monthLabel(k), value: Math.round(byMonth[k]), color: PALETTE[1] }));
        bars($('#cBars', charts), barData, { height: 220, format: (v) => money(v) });
      });
    };

    this.render2(root);
  },
};
