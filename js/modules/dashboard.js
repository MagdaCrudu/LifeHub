// Module: Acasă (overview)
import { db, amortization } from '../store.js';
import { icon, el, money, esc, monthKey, monthLabel, hydrateIcons, $, $$ } from '../ui.js';
import { line, donut, PALETTE } from '../charts.js';
import { canInstall, promptInstall } from '../app.js';

function go(route) { location.hash = route; }

export default {
  title: 'Acasă',
  render(root) {
    const credits = db.all('credits');
    const notes = db.all('notes');
    const recipes = db.all('recipes');
    const expenses = db.all('expenses');
    const savings = db.all('savings');

    const monthlyRate = credits.reduce((s, c) => s + amortization(c).pmt, 0);
    const remaining = credits.reduce((s, c) => s + amortization(c).remaining, 0);
    const thisMonth = monthKey(new Date().toISOString());
    const spentThisMonth = expenses.filter((e) => monthKey(e.date) === thisMonth).reduce((s, e) => s + e.amount, 0);
    const totalSaved = savings.reduce((s, g) => s + (g.contributions || []).reduce((a, c) => a + c.amount, 0), 0);
    const openTodos = notes.reduce((s, n) => s + (n.todos || []).filter((t) => !t.done).length, 0);

    // install banner
    const banner = el(`<div class="install-banner ${canInstall() ? 'is-show' : ''}" id="installBanner">
      <span class="stat__chip" style="width:42px;height:42px">${icon('download')}</span>
      <div class="install-banner__txt"><strong>Instalează LifeHub</strong>Adaugă aplicația pe ecranul de start — funcționează offline, fără browser.</div>
      <button class="btn btn--sm" id="installBtn">Instalează</button>
    </div>`);
    root.appendChild(banner);
    $('#installBtn', banner).onclick = () => promptInstall();
    window.addEventListener('lh:installable', () => banner.classList.add('is-show'), { once: true });
    window.addEventListener('lh:installed', () => banner.classList.remove('is-show'));

    // greeting
    const h = new Date().getHours();
    const greet = h < 12 ? 'Bună dimineața' : h < 18 ? 'Bună ziua' : 'Bună seara';
    root.appendChild(el(`<p class="muted" style="margin:2px 0 18px;font-size:15px">${greet}! Iată o privire de ansamblu.</p>`));

    // stat tiles -> each navigates
    const tiles = [
      { icon: 'credit', label: 'Rate credite / lună', value: money(monthlyRate), sub: `${money(remaining)} sold rămas`, route: 'credits' },
      { icon: 'chart', label: `Cheltuieli ${monthLabel(thisMonth)}`, value: money(spentThisMonth), sub: `${expenses.length} tranzacții total`, route: 'stats' },
      { icon: 'piggy', label: 'Total economisit', value: money(totalSaved), sub: `${savings.length} obiective`, route: 'savings' },
      { icon: 'notes', label: 'Sarcini de făcut', value: String(openTodos), sub: `${notes.length} notițe`, route: 'notes' },
    ];
    const grid = el(`<div class="grid grid--stat"></div>`);
    tiles.forEach((t) => {
      const tile = el(`<div class="stat" style="cursor:pointer"><div class="stat__label">${icon(t.icon)}${esc(t.label)}</div><div class="stat__value">${t.value}</div><div class="stat__sub muted">${esc(t.sub)}</div></div>`);
      tile.onclick = () => go(t.route);
      grid.appendChild(tile);
    });
    root.appendChild(grid);

    // charts row
    const charts = el(`<div class="grid grid--2" style="gap:18px;margin-top:20px">
      <div class="card card--interactive" id="cardTrend"><div class="row row--between"><h3 style="margin:0;font-size:16px">Cheltuieli lunare</h3><span class="badge">${icon('chart')}</span></div><div class="canvas-wrap" style="margin-top:10px"><canvas id="dTrend"></canvas></div></div>
      <div class="card card--interactive" id="cardCat"><div class="row row--between"><h3 style="margin:0;font-size:16px">Pe categorii (luna curentă)</h3><span class="badge">${icon('coins')}</span></div>
        <div class="row" style="gap:14px;align-items:center;margin-top:10px;flex-wrap:wrap"><div class="canvas-wrap" style="width:150px;flex:none"><canvas id="dDonut"></canvas></div><div class="legend" id="dLegend" style="flex:1;min-width:130px"></div></div>
      </div>
    </div>`);
    root.appendChild(charts);
    $('#cardTrend', charts).onclick = (e) => { if (!e.target.closest('canvas') || true) go('stats'); };
    $('#cardCat', charts).onclick = () => go('stats');

    // quick actions
    root.appendChild(el(`<div class="section-title"><h2>Acces rapid</h2></div>`));
    const qa = el(`<div class="grid grid--cards"></div>`);
    [
      { icon: 'credit', t: 'Credite', d: 'Urmărește rate și solduri', r: 'credits' },
      { icon: 'notes', t: 'Notițe & To-Do', d: 'Idei și liste de sarcini', r: 'notes' },
      { icon: 'recipe', t: 'Rețete', d: `${recipes.length} rețete salvate`, r: 'recipes' },
      { icon: 'chart', t: 'Cheltuieli', d: 'Statistici și grafice', r: 'stats' },
      { icon: 'piggy', t: 'Economii', d: 'Obiective și progres', r: 'savings' },
    ].forEach((m) => {
      const c = el(`<div class="card card--interactive row" style="gap:14px"><span class="stat__chip" style="width:44px;height:44px">${icon(m.icon)}</span><div><div class="li__title">${esc(m.t)}</div><div class="li__sub">${esc(m.d)}</div></div></div>`);
      c.onclick = () => go(m.r);
      qa.appendChild(c);
    });
    root.appendChild(qa);

    hydrateIcons(root);

    // draw charts
    requestAnimationFrame(() => {
      const byMonth = {};
      expenses.forEach((e) => { const k = monthKey(e.date); byMonth[k] = (byMonth[k] || 0) + e.amount; });
      const months = Object.keys(byMonth).sort().slice(-6);
      line($('#dTrend', charts), months.map((k) => Math.round(byMonth[k])), { height: 180, labels: months.map(monthLabel), color: PALETTE[0] });

      const cur = expenses.filter((e) => monthKey(e.date) === thisMonth);
      const byCat = {};
      cur.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
      const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
      const legend = $('#dLegend', charts);
      if (catData.length) {
        donut($('#dDonut', charts), catData, { size: 150, thickness: 20, centerTop: money(spentThisMonth), centerSub: 'lună' });
        legend.innerHTML = catData.slice(0, 5).map((d) => `<div class="legend__item"><span class="legend__dot" style="background:${d.color}"></span><span>${esc(d.label)}</span><span class="legend__val">${money(d.value)}</span></div>`).join('');
      } else {
        $('#dDonut', charts).parentElement.innerHTML = `<p class="muted" style="padding:30px 0;text-align:center">Nicio cheltuială luna aceasta.</p>`;
      }
    });
  },
};
