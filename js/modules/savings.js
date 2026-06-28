// Module: Economii
import { db } from '../store.js';
import { icon, el, esc, money, fmtDate, modal, toast, confirmDialog, todayISO, uid, hydrateIcons, $, $$ } from '../ui.js';
import { ring, PALETTE } from '../charts.js';

const saved = (g) => (g.contributions || []).reduce((s, c) => s + c.amount, 0);

function openForm(existing) {
  const g = existing || { name: '', target: 5000, color: 0, deadline: '', contributions: [] };
  const form = el(`<form>
    <div class="field"><label>Nume obiectiv</label><input class="input" name="name" required value="${esc(g.name)}" placeholder="ex. Fond de urgență"></div>
    <div class="field-row">
      <div class="field"><label>Sumă țintă (RON)</label><input class="input" name="target" type="number" min="1" step="100" required value="${g.target}"></div>
      <div class="field"><label>Termen (opțional)</label><input class="input" name="deadline" type="date" value="${g.deadline || ''}"></div>
    </div>
    <div class="field"><label>Culoare</label><div class="chip-row" id="colors"></div></div>
  </form>`);
  let color = g.color || 0;
  const cr = $('#colors', form);
  PALETTE.slice(0, 6).forEach((c, i) => { const b = el(`<button type="button" class="chip"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c}"></span></button>`); if (i === color) b.classList.add('is-active'); b.onclick = () => { color = i; $$('#colors .chip', form).forEach((x, j) => x.classList.toggle('is-active', j === i)); }; cr.appendChild(b); });

  modal({
    title: existing ? 'Editează obiectiv' : 'Obiectiv nou', body: form,
    footer: el(`<div class="row"><button class="btn btn--ghost" data-cancel>Anulează</button><button class="btn" data-save>${icon('check')}Salvează</button></div>`),
    onMount: ({ root, close }) => {
      $('[data-cancel]', root).onclick = close;
      $('[data-save]', root).onclick = () => {
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        const data = { name: fd.get('name').trim(), target: +fd.get('target'), deadline: fd.get('deadline'), color };
        if (existing) db.update('savings', existing.id, data); else db.add('savings', { ...data, contributions: [] });
        close(); toast(existing ? 'Obiectiv actualizat' : 'Obiectiv adăugat', 'ok');
      };
    },
  });
}

function openContribute(g) {
  const form = el(`<form>
    <div class="field"><label>Sumă depusă (RON)</label><input class="input" name="amount" type="number" step="0.01" required value="" placeholder="0,00"></div>
    <div class="field"><label>Data</label><input class="input" name="date" type="date" required value="${todayISO()}"></div>
    <p class="muted" style="font-size:13px">Folosește o sumă negativă pentru o retragere.</p>
  </form>`);
  modal({
    title: `Depunere · ${g.name}`, body: form,
    footer: el(`<div class="row"><button class="btn btn--ghost" data-cancel>Anulează</button><button class="btn" data-save>${icon('plus')}Adaugă</button></div>`),
    onMount: ({ root, close }) => {
      $('[data-cancel]', root).onclick = close;
      $('[data-save]', root).onclick = () => {
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        const cur = db.get('savings', g.id);
        cur.contributions.unshift({ id: uid(), amount: +fd.get('amount'), date: fd.get('date') });
        db.update('savings', g.id, { contributions: cur.contributions });
        close(); toast('Depunere înregistrată', 'ok');
      };
    },
  });
}

function openDetail(g) {
  const s = saved(g);
  const pct = g.target ? s / g.target : 0;
  const color = PALETTE[g.color || 0];
  const body = el(`<div>
    <div class="canvas-wrap" style="width:170px;margin:0 auto 10px"><canvas id="ring"></canvas></div>
    <div class="row row--between" style="margin:6px 0"><span class="muted">Economisit</span><strong>${money(s)} / ${money(g.target)}</strong></div>
    ${g.deadline ? `<div class="row row--between"><span class="muted">Termen</span><strong>${fmtDate(g.deadline)}</strong></div>` : ''}
    <div class="row row--between"><span class="muted">Rămas de strâns</span><strong>${money(Math.max(0, g.target - s))}</strong></div>
    <button class="btn btn--block" data-add style="margin-top:16px">${icon('plus')}Adaugă depunere</button>
    <h4 style="margin:20px 0 8px">Istoric depuneri</h4>
    <div class="list" id="hist"></div>
  </div>`);
  const hist = $('#hist', body);
  function drawHist() {
    const cur = db.get('savings', g.id);
    hist.innerHTML = '';
    if (!cur.contributions.length) { hist.innerHTML = `<p class="muted">Nicio depunere încă.</p>`; return; }
    cur.contributions.forEach((c) => {
      const row = el(`<div class="li" style="padding:10px 13px">
        <span class="stat__chip" style="color:${c.amount < 0 ? 'var(--bad)' : 'var(--ok)'};background:${c.amount < 0 ? 'rgba(251,113,133,.12)' : 'rgba(52,211,153,.12)'}">${icon(c.amount < 0 ? 'arrowDown' : 'arrowUp')}</span>
        <div class="li__main"><div class="li__title" style="font-size:14px">${money(c.amount, true)}</div><div class="li__sub">${fmtDate(c.date)}</div></div>
        <button class="icon-btn" data-del style="width:34px;height:34px">${icon('trash')}</button>
      </div>`);
      $('[data-del]', row).onclick = () => {
        const cc = db.get('savings', g.id);
        db.update('savings', g.id, { contributions: cc.contributions.filter((x) => x.id !== c.id) });
        drawHist(); hydrateIcons(hist);
      };
      hist.appendChild(row);
    });
    hydrateIcons(hist);
  }
  drawHist();

  modal({
    title: g.name, size: 520, body,
    footer: el(`<div class="row"><button class="btn btn--danger" data-del>${icon('trash')}Șterge</button><span class="spacer"></span><button class="btn btn--ghost" data-edit>${icon('edit')}Editează</button></div>`),
    onMount: ({ root, close }) => {
      hydrateIcons(root);
      requestAnimationFrame(() => ring($('#ring', root), pct, { size: 170, color, label: 'atins' }));
      $('[data-add]', root).onclick = () => { close(); openContribute(g); };
      $('[data-edit]', root).onclick = () => { close(); openForm(g); };
      $('[data-del]', root).onclick = async () => { if (await confirmDialog(`Ștergi obiectivul „${g.name}”?`)) { db.remove('savings', g.id); close(); toast('Obiectiv șters', 'ok'); } };
    },
  });
}

function goalCard(g) {
  const s = saved(g);
  const pct = g.target ? Math.min(1, s / g.target) : 0;
  const color = PALETTE[g.color || 0];
  const done = s >= g.target;
  const card = el(`<div class="card card--interactive">
    <div class="row" style="gap:16px;align-items:center">
      <div class="canvas-wrap" style="width:96px;flex:none"><canvas class="ringC"></canvas></div>
      <div style="flex:1;min-width:0">
        <div class="row row--between"><div class="li__title">${esc(g.name)}</div>${done ? `<span class="badge badge--ok">${icon('check')}Atins</span>` : ''}</div>
        <div class="stat__value" style="font-size:22px;margin-top:6px">${money(s)}</div>
        <div class="li__sub">din ${money(g.target)}${g.deadline ? ' · ' + fmtDate(g.deadline) : ''}</div>
        <button class="btn btn--sm" data-add style="margin-top:12px">${icon('plus')}Depune</button>
      </div>
    </div>
  </div>`);
  $('[data-add]', card).onclick = (e) => { e.stopPropagation(); openContribute(g); };
  card.onclick = () => openDetail(g);
  card._draw = () => ring($('.ringC', card), pct, { size: 96, thickness: 10, color });
  return card;
}

export default {
  title: 'Economii',
  primaryAction: () => openForm(),
  topActions(host) { host.appendChild(el(`<button class="btn" id="addGoal">${icon('plus')}Obiectiv nou</button>`)); host.querySelector('#addGoal').onclick = () => openForm(); },
  render(root) {
    const list = db.all('savings');
    const totalSaved = list.reduce((s, g) => s + saved(g), 0);
    const totalTarget = list.reduce((s, g) => s + g.target, 0);

    root.appendChild(el(`<div class="grid grid--stat" style="margin-bottom:8px">
      <div class="stat"><div class="stat__label">${icon('piggy')}Total economisit</div><div class="stat__value">${money(totalSaved)}</div><div class="stat__sub muted">${list.length} obiective</div></div>
      <div class="stat"><div class="stat__label">${icon('target')}Total țintă</div><div class="stat__value">${money(totalTarget)}</div></div>
      <div class="stat"><div class="stat__label">${icon('trending')}Progres general</div><div class="stat__value">${totalTarget ? Math.round(totalSaved / totalTarget * 100) : 0}%</div></div>
    </div>`));

    root.appendChild(el(`<div class="section-title"><h2>Obiective de economii</h2></div>`));
    if (!list.length) {
      const e = el(`<div></div>`);
      e.innerHTML = `<div class="empty"><div class="empty__icon">${icon('piggy')}</div><h3>Niciun obiectiv</h3><p>Stabilește obiective de economii și urmărește-ți progresul cu inele vizuale.</p><button class="btn" id="emptyAdd">${icon('plus')}Obiectiv nou</button></div>`;
      root.appendChild(e); $('#emptyAdd', e).onclick = () => openForm();
    } else {
      const grid = el(`<div class="grid grid--cards"></div>`);
      const cards = list.map((g) => { const c = goalCard(g); grid.appendChild(c); return c; });
      root.appendChild(grid);
      requestAnimationFrame(() => cards.forEach((c) => c._draw()));
    }
  },
};
