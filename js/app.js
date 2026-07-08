// app.js — shell: routing, theme, install prompt, backup, service worker.
import { $, $$, hydrateIcons, icon, toast, modal, el, esc, setDisplayCurrency, getDisplayCurrency } from './ui.js';
import { subscribe, settings, exportData, importData, db, init as initStore, reload as reloadStore, storageInfo } from './store.js';

import dashboard from './modules/dashboard.js';
import credits from './modules/credits.js';
import notes from './modules/notes.js';
import recipes from './modules/recipes.js';
import stats from './modules/stats.js';
import savings from './modules/savings.js';

const modules = { dashboard, credits, notes, recipes, stats, savings };
let current = 'dashboard';

// App version (keep in sync with the sw.js CACHE version on each release)
const APP_VERSION = 'v26';
{ const vEl = $('#appVersion'); if (vEl) vEl.textContent = `LifeHub ${APP_VERSION}`; }

/* ---------- render ---------- */
const view = $('#view');
const pageTitle = $('#pageTitle');
const topActions = $('#topActions');

function setActive(route) {
  $$('.nav__item, .tab').forEach((b) => b.classList.toggle('is-active', b.dataset.route === route));
}

function renderCurrent() {
  const m = modules[current] || dashboard;
  pageTitle.textContent = m.title;
  topActions.innerHTML = '';
  if (m.topActions) m.topActions(topActions);
  view.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'view-anim';
  view.appendChild(wrap);
  m.render(wrap);
  hydrateIcons(view);
  hydrateIcons(topActions);
  setupFab(m);
  setActive(current);
}

// Pure render of a route (no history changes) — driven by hashchange / boot.
function navigate(route) {
  if (!modules[route]) route = 'dashboard';
  current = route;
  closeSidebar();
  view.scrollTop = 0;
  renderCurrent();
}
// User navigation → push a history entry so the phone's Back button steps through
// modules (and only exits the app from the first screen) instead of closing immediately.
function goTo(route) {
  if (('#' + route) === location.hash) { closeSidebar(); return; }
  location.hash = '#' + route; // triggers hashchange → navigate()
}

/* fab on mobile triggers the module's primary action */
function setupFab(m) {
  let fab = $('.fab');
  if (m.primaryAction) {
    if (!fab) { fab = el(`<button class="fab" aria-label="Adaugă">${icon('plus')}</button>`); document.getElementById('app').appendChild(fab); hydrateIcons(fab); }
    fab.onclick = () => m.primaryAction();
    fab.style.display = '';
  } else if (fab) {
    fab.style.display = 'none';
  }
}

/* ---------- static shell icons (sidebar nav, footer, mobile tabbar) ---------- */
hydrateIcons(document);

/* ---------- nav wiring ---------- */
$$('[data-route]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.route)));
window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'dashboard'));

/* ---------- sidebar (mobile) ---------- */
const sidebar = $('#sidebar'), scrim = $('#scrim');
function openSidebar() { sidebar.classList.add('is-open'); scrim.classList.add('is-open'); }
function closeSidebar() { sidebar.classList.remove('is-open'); scrim.classList.remove('is-open'); }
$('#menuBtn').addEventListener('click', openSidebar);
scrim.addEventListener('click', closeSidebar);

/* ---------- theme ---------- */
const root = document.documentElement;
function applyTheme(t) {
  root.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').setAttribute('content', t === 'light' ? '#e9ebf4' : '#171a2e');
  settings.set('theme', t);
}
// Default theme is now light (one-time migration overrides the old dark default).
if (!settings.get('themeDefaultV2', false)) { settings.set('theme', 'light'); settings.set('themeDefaultV2', true); }
applyTheme(settings.get('theme', 'light'));
$('#themeBtn').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  renderCurrent();
  toast(next === 'light' ? 'Temă luminoasă' : 'Temă întunecată', 'ok');
});

/* ---------- display currency (RON / EUR, viewing only) ---------- */
function applyCurrency(c) {
  setDisplayCurrency(c);
  settings.set('currency', c);
  const lbl = $('#curLabel'); if (lbl) lbl.textContent = c;
}
function cycleCurrency() {
  const next = getDisplayCurrency() === 'RON' ? 'EUR' : 'RON';
  applyCurrency(next);
  renderCurrent();
  toast('Monedă afișare: ' + next, 'ok');
}
applyCurrency(settings.get('currency', 'RON'));
$('#currencyBtn').addEventListener('click', cycleCurrency);
// other views (e.g. the credit-detail header toggle) can flip the display currency
window.addEventListener('lh:currency-cycle', cycleCurrency);

/* ---------- data / backup ---------- */
$('#dataBtn').addEventListener('click', openDataModal);
function openDataModal() {
  closeSidebar();
  const info = storageInfo();
  const where = info.mode === 'files'
    ? `<div class="info-note"><span class="info-note__ico">${icon('info')}</span><div class="info-note__txt"><strong>Stocare în fișiere</strong>Datele se citesc și se scriu în <code>data_storage/</code> (un fișier .json per modul, editabil manual).</div></div>`
    : `<div class="info-note"><span class="info-note__ico">${icon('info')}</span><div class="info-note__txt"><strong>Stocare privată a aplicației</strong>Datele sunt persistente pe acest dispozitiv. Pentru editare manuală folosește Export/Import.</div></div>`;
  // the storage explanation is tucked behind an (i) button next to the title (toggles it open)
  const infoBtn = el(`<button class="icon-btn" id="storageInfoBtn" title="Despre stocare">${icon('info')}</button>`);
  modal({
    title: 'Date & backup',
    headExtra: infoBtn,
    body: (() => {
      const errs = info.errors ? `<p class="badge badge--bad" style="margin-bottom:14px">${icon('info')} Erori în fișiere: ${esc(info.errors.join('; '))}</p>` : '';
      return `
      <div id="storageInfoWrap" style="display:none;margin-bottom:16px">${where}</div>${errs}
      <div class="list">
        ${info.mode === 'files' ? `<button class="li" id="reloadBtn" style="text-align:left;border:1px solid var(--border);cursor:pointer">
          <span class="stat__chip">${icon('refresh')}</span>
          <span class="li__main"><div class="li__title">Reîncarcă din fișiere</div><div class="li__sub">Preia modificările făcute manual în data_storage/</div></span>
        </button>` : ''}
        <button class="li" id="expBtn" style="text-align:left;border:1px solid var(--border);cursor:pointer">
          <span class="stat__chip">${icon('download')}</span>
          <span class="li__main"><div class="li__title">Exportă backup</div><div class="li__sub">Descarcă un fișier .json cu toate datele</div></span>
        </button>
        <label class="li" style="cursor:pointer">
          <span class="stat__chip">${icon('upload')}</span>
          <span class="li__main"><div class="li__title">Importă backup</div><div class="li__sub">Restaurează dintr-un fișier .json</div></span>
          <input type="file" id="impInput" accept="application/json,.json" hidden>
        </label>
        <button class="li" id="resetBtn" style="text-align:left;border:1px solid var(--border);cursor:pointer">
          <span class="stat__chip" style="color:var(--bad);background:rgba(251,113,133,.12)">${icon('trash')}</span>
          <span class="li__main"><div class="li__title">Resetează datele</div><div class="li__sub">Revino la datele demo inițiale</div></span>
        </button>
      </div>`;
    })(),
    onMount: ({ root, close }) => {
      const infoWrap = $('#storageInfoWrap', root);
      $('#storageInfoBtn', root).onclick = () => { infoWrap.style.display = infoWrap.style.display === 'none' ? '' : 'none'; };
      const reloadEl = $('#reloadBtn', root);
      if (reloadEl) reloadEl.onclick = async () => { await reloadStore(); close(); renderCurrent(); toast('Reîncărcat din fișiere', 'ok'); };
      $('#expBtn', root).onclick = () => {
        const blob = new Blob([exportData()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `lifehub-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click(); URL.revokeObjectURL(a.href);
        toast('Backup descărcat', 'ok');
      };
      $('#impInput', root).onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try { importData(reader.result); close(); renderCurrent(); toast('Date importate', 'ok'); }
          catch (err) { toast('Fișier invalid', 'bad'); }
        };
        reader.readAsText(file);
      };
      $('#resetBtn', root).onclick = async () => {
        const { confirmDialog } = await import('./ui.js');
        if (await confirmDialog('Sigur resetezi toate datele la valorile demo? Acțiunea nu poate fi anulată.', { okLabel: 'Resetează' })) {
          db.reset(); close(); renderCurrent(); toast('Date resetate', 'ok');
        }
      };
    },
  });
}

/* ---------- install prompt ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('lh:installable'));
});
export function canInstall() { return !!deferredPrompt; }
export async function promptInstall() {
  if (!deferredPrompt) { toast('Folosește meniul browserului: „Instalează aplicația”', ''); return; }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') toast('Se instalează LifeHub…', 'ok');
  deferredPrompt = null;
  window.dispatchEvent(new CustomEvent('lh:installed'));
}
window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('LifeHub instalat!', 'ok'); });

/* ---------- re-render on data change ---------- */
let rafPending = false;
subscribe(() => { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; renderCurrent(); }); });

/* ---------- boot ---------- */
view.innerHTML = `<div class="empty"><div class="empty__icon">${icon('data')}</div><h3>Se încarcă…</h3></div>`;
hydrateIcons(view);
(async () => {
  if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch {} }
  await initStore();
  navigate(location.hash.slice(1) || 'dashboard');
})();

/* ---------- service worker + auto-update ---------- */
if ('serviceWorker' in navigator) {
  // when a new SW takes control (after an update), reload once so the page runs the latest code
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return; // skip on first-ever install (avoids a needless reload)
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      const check = () => reg.update().catch(() => {});
      check();
      // re-check for a newer version when the app regains focus and periodically
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      setInterval(check, 60 * 1000);
    } catch { /* offline / unsupported */ }
  });
}
