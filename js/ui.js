// ui.js — DOM helpers, icon set, modal, toast, formatters.

/* ---------- icons (feather-style stroke) ---------- */
const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  credit: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/><path d="M6 15h4"/>',
  notes: '<path d="M5 3.5h9l5 5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V9h5"/><path d="M8 13h8M8 16.5h5"/>',
  recipe: '<path d="M7 3v7a3 3 0 0 0 6 0V3"/><path d="M10 10v11"/><path d="M17 3c-1.5 1-2.5 3-2.5 5.5S15.5 13 17 14v7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  piggy: '<path d="M3 12a6 6 0 0 1 6-6h5a6 6 0 0 1 6 6v1.5a3.5 3.5 0 0 1-3.5 3.5H18l-1 2h-3l-.8-1.6A6 6 0 0 1 3 13.5z"/><path d="M3 11.5 1.5 10M16 9.5h.01"/>',
  theme: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8z"/>',
  data: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  check: '<path d="M5 12.5 10 17.5 19.5 6.5"/>',
  pin: '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 14v7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  refresh: '<path d="M3.5 12a8.5 8.5 0 0 1 14.5-6l2 2"/><path d="M20 4v4h-4"/><path d="M20.5 12a8.5 8.5 0 0 1-14.5 6l-2-2"/><path d="M4 20v-4h4"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5"/><path d="M4 4h16"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="17" cy="13.5" r="1.4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  flame: '<path d="M12 3c1 3-2 4-2 7a2.5 2.5 0 0 0 5 0c0-1-.5-2-.5-2 2 1.5 3 3.5 3 6a5.5 5.5 0 0 1-11 0c0-4 3.5-6 5.5-11z"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  sparkles: '<path d="M12 3l1.8 4.8L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.7z"/><path d="M18 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  users: '<circle cx="12" cy="9" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
  trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  star: '<path d="M12 3.5l2.6 5.6 6 .6-4.5 4 1.3 6L12 16.8 6.6 19.7l1.3-6-4.5-4 6-.6z"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11V3z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
};

export function icon(name, cls = '') {
  const inner = P[name] || P.info;
  return `<span class="nav__icon ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></span>`;
}

/* ---------- DOM helpers ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* render all [data-i] icon placeholders inside a root */
export function hydrateIcons(root = document) {
  $$('[data-i]', root).forEach((node) => {
    if (node.dataset.done) return;
    node.outerHTML = icon(node.dataset.i, node.className.replace('nav__icon', '').trim());
  });
}

/* ---------- formatting ---------- */
// Display-only currency: data is always stored in RON; EUR is just a viewing conversion.
const RON_PER_EUR = 4.97; // aproximativ (mijloc 2026)
let DISPLAY_CUR = 'RON';
const FMT = {
  RON: { 0: new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }), 2: new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  EUR: { 0: new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), 2: new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
};
export function setDisplayCurrency(c) { DISPLAY_CUR = c === 'EUR' ? 'EUR' : 'RON'; }
export function getDisplayCurrency() { return DISPLAY_CUR; }
export const money = (n, dec = false) => {
  let v = Number(n) || 0;
  if (DISPLAY_CUR === 'EUR') v = v / RON_PER_EUR;
  return FMT[DISPLAY_CUR][dec ? 2 : 0].format(v);
};
export const num = (n) => new Intl.NumberFormat('ro-RO').format(Number(n) || 0);
// number without a currency symbol, but converted to the chosen display currency
export const numMoney = (n) => num(DISPLAY_CUR === 'EUR' ? (Number(n) || 0) / RON_PER_EUR : n);
// raw numeric conversions (no formatting) between stored RON and the chosen display currency
export const toDisplayAmount = (n) => (DISPLAY_CUR === 'EUR' ? (Number(n) || 0) / RON_PER_EUR : (Number(n) || 0));
export const fromDisplayAmount = (n) => (DISPLAY_CUR === 'EUR' ? (Number(n) || 0) * RON_PER_EUR : (Number(n) || 0));

const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.'];
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function monthKey(iso) { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
export function monthLabel(key) { const [y, m] = key.split('-'); return `${MONTHS[+m - 1]} ${String(y).slice(2)}`; }
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- toast ---------- */
export function toast(msg, type = '') {
  const root = $('#toastRoot');
  const t = el(`<div class="toast ${type ? 'toast--' + type : ''}">${type ? icon(type === 'ok' ? 'check' : 'info') : ''}<span>${esc(msg)}</span></div>`);
  root.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s, transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 320); }, 2600);
}

/* ---------- modal ---------- */
// Back-button integration: while any modal is open we keep exactly ONE history entry
// so the phone's Back button closes the modal instead of leaving the app. Closing a
// modal only drops that entry on the NEXT tick — if another modal opens synchronously
// in between (confirm→reopen, add/delete prepayment→refresh), the entry is reused and
// no spurious popstate fires (which used to bounce the user back to the page).
let _activeClose = null;     // close() of the modal currently in #modalRoot
let _activeKeyHandler = null; // its Escape handler (removed when replaced in place)
let _modalPushed = false;    // whether a history entry exists for the modal layer
function _settleHistory() {
  // no modal reopened after the last close → drop the entry we pushed
  if (!_activeClose && _modalPushed) { _modalPushed = false; try { history.back(); } catch {} }
}
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (!_activeClose) return;       // no modal open → let routing handle it
    _modalPushed = false;            // the browser already removed the entry
    const c = _activeClose; _activeClose = null;
    c();
  });
}

export function modal({ title, body, footer, onMount, size, autofocus = true, fullscreen = false, headExtra = null }) {
  const root = $('#modalRoot');
  clearTimeout(root._closeTimer); // cancel a pending removal so reopening (e.g. edit) isn't wiped
  if (_activeKeyHandler) { document.removeEventListener('keydown', _activeKeyHandler); _activeKeyHandler = null; }
  root.innerHTML = '';
  const wrap = el(`
    <div>
      <div class="modal__backdrop"></div>
      <div class="modal${fullscreen ? ' modal--full' : ''}" role="dialog" aria-modal="true" style="${!fullscreen && size ? `width:min(${size}px,calc(100vw - 24px))` : ''}">
        <div class="modal__head"><h3>${esc(title)}</h3><div class="modal__head-right" style="display:flex;align-items:center;gap:6px">${headExtra ? '' : ''}<button class="icon-btn" data-close>${icon('close')}</button></div></div>
        <div class="modal__body"></div>
        ${footer ? '<div class="modal__foot"></div>' : ''}
      </div>
    </div>`);
  if (headExtra) {
    const hr = $('.modal__head-right', wrap);
    const node = typeof headExtra === 'string' ? el(headExtra) : headExtra;
    if (node) hr.insertBefore(node, hr.firstChild);
  }
  const bodyEl = $('.modal__body', wrap);
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  if (footer) { const f = $('.modal__foot', wrap); if (typeof footer === 'string') f.innerHTML = footer; else f.appendChild(footer); }
  root.appendChild(wrap);
  root.classList.add('is-open');
  hydrateIcons(root);

  const close = () => {
    clearTimeout(root._closeTimer);
    root.classList.remove('is-open');
    root._closeTimer = setTimeout(() => (root.innerHTML = ''), 200);
    document.removeEventListener('keydown', onKey);
    if (_activeKeyHandler === onKey) _activeKeyHandler = null;
    if (_activeClose === close) _activeClose = null;
    setTimeout(_settleHistory, 0); // drop our history entry unless a modal reopens synchronously
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  _activeKeyHandler = onKey;
  $('.modal__backdrop', wrap).addEventListener('click', close);
  $('[data-close]', wrap).addEventListener('click', close);
  // one history entry per modal layer (a confirm/reopen reuses the existing entry)
  if (!_modalPushed) { try { history.pushState({ lhModal: true }, ''); _modalPushed = true; } catch {} }
  _activeClose = close;
  if (onMount) onMount({ root: wrap, close });
  if (autofocus) setTimeout(() => { const fi = $('input,textarea,select', wrap); if (fi) fi.focus({ preventScroll: true }); }, 60);
  return { close, root: wrap };
}

export function confirmDialog(message, { danger = true, okLabel = 'Șterge' } = {}) {
  return new Promise((resolve) => {
    modal({
      title: 'Confirmare',
      body: `<p class="muted" style="line-height:1.55;margin:4px 0 6px">${esc(message)}</p>`,
      footer: el(`<div class="row"><button class="btn btn--ghost" data-no>Anulează</button><button class="btn ${danger ? 'btn--danger' : ''}" data-yes>${esc(okLabel)}</button></div>`),
      onMount: ({ root, close }) => {
        $('[data-no]', root).onclick = () => { close(); resolve(false); };
        $('[data-yes]', root).onclick = () => { close(); resolve(true); };
      },
    });
  });
}

/* empty-state block */
export function empty(iconName, title, text, actionHTML = '') {
  return `<div class="empty"><div class="empty__icon">${icon(iconName)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${actionHTML}</div>`;
}
