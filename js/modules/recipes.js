// Module: Rețete de gătit
import { db } from '../store.js';
import { icon, el, esc, modal, toast, confirmDialog, hydrateIcons, $, $$ } from '../ui.js';

const CATS = ['Mic dejun', 'Supe', 'Principal', 'Salate', 'Desert', 'Gustări', 'Băuturi'];
const EMOJIS = ['🍲', '🥣', '🍝', '🥗', '🥞', '🍰', '🍕', '🍜', '🥘', '🍛', '🌮', '🍳', '🥪', '🍞', '☕', '🍪'];
let filter = 'Toate';

function openForm(existing) {
  const r = existing || { name: '', category: 'Principal', emoji: '🍲', servings: 2, minutes: 30, favorite: false, ingredients: [], steps: [] };
  let emoji = r.emoji;
  const form = el(`<form>
    <div class="field"><label>Emoji</label><div class="chip-row" id="emojis"></div></div>
    <div class="field"><label>Nume rețetă</label><input class="input" name="name" required value="${esc(r.name)}" placeholder="ex. Ciorbă de văcuță"></div>
    <div class="field-row">
      <div class="field"><label>Categorie</label><select class="select" name="category">${CATS.map((c) => `<option ${c === r.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label>Porții</label><input class="input" name="servings" type="number" min="1" value="${r.servings}"></div>
    </div>
    <div class="field"><label>Timp de preparare (minute)</label><input class="input" name="minutes" type="number" min="1" value="${r.minutes}"></div>
    <div class="field"><label>Ingrediente (câte unul pe rând)</label><textarea class="textarea" name="ingredients" placeholder="2 morcovi&#10;1 ceapă">${esc((r.ingredients || []).join('\n'))}</textarea></div>
    <div class="field"><label>Pași de preparare (câte unul pe rând)</label><textarea class="textarea" name="steps" placeholder="Călește ceapa…">${esc((r.steps || []).join('\n'))}</textarea></div>
  </form>`);
  const er = $('#emojis', form);
  EMOJIS.forEach((e) => { const b = el(`<button type="button" class="chip" style="font-size:18px;padding:6px 10px">${e}</button>`); if (e === emoji) b.classList.add('is-active'); b.onclick = () => { emoji = e; $$('#emojis .chip', form).forEach((x) => x.classList.toggle('is-active', x.textContent === e)); }; er.appendChild(b); });

  modal({
    title: existing ? 'Editează rețeta' : 'Rețetă nouă', size: 580, body: form,
    footer: el(`<div class="row"><button class="btn btn--ghost" data-cancel>Anulează</button><button class="btn" data-save>${icon('check')}Salvează</button></div>`),
    onMount: ({ root, close }) => {
      $('[data-cancel]', root).onclick = close;
      $('[data-save]', root).onclick = () => {
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        const data = {
          name: fd.get('name').trim(), category: fd.get('category'), emoji,
          servings: +fd.get('servings') || 1, minutes: +fd.get('minutes') || 1, favorite: r.favorite || false,
          ingredients: fd.get('ingredients').split('\n').map((s) => s.trim()).filter(Boolean),
          steps: fd.get('steps').split('\n').map((s) => s.trim()).filter(Boolean),
        };
        if (existing) db.update('recipes', existing.id, data); else db.add('recipes', data);
        close(); toast(existing ? 'Rețetă actualizată' : 'Rețetă adăugată', 'ok');
      };
    },
  });
}

function openView(r) {
  const body = el(`<div>
    <div style="height:130px;border-radius:18px;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:64px;margin-bottom:16px">${r.emoji}</div>
    <div class="row wrap" style="gap:8px;margin-bottom:14px">
      <span class="badge badge--accent">${esc(r.category)}</span>
      <span class="badge">${icon('clock')}${r.minutes} min</span>
      <span class="badge">${icon('users')}${r.servings} porții</span>
      ${r.favorite ? `<span class="badge badge--warn">${icon('star')}Favorit</span>` : ''}
    </div>
    <h4 style="margin:6px 0 8px">Ingrediente</h4>
    <div class="list">${(r.ingredients || []).map((i) => `<div class="li" style="padding:9px 13px"><span class="legend__dot" style="background:var(--accent)"></span><span class="li__main" style="font-size:14px">${esc(i)}</span></div>`).join('') || '<p class="muted">—</p>'}</div>
    <h4 style="margin:18px 0 8px">Mod de preparare</h4>
    <ol style="margin:0;padding-left:4px;list-style:none">${(r.steps || []).map((s, i) => `<li style="display:flex;gap:12px;margin-bottom:12px"><span class="stat__chip" style="flex:none">${i + 1}</span><span style="line-height:1.55;padding-top:5px">${esc(s)}</span></li>`).join('') || '<p class="muted">—</p>'}</ol>
  </div>`);
  modal({
    title: r.name, size: 580, body,
    footer: el(`<div class="row"><button class="btn btn--danger" data-del>${icon('trash')}Șterge</button><button class="btn btn--ghost" data-fav>${icon('star')}${r.favorite ? 'Scoate favorit' : 'Favorit'}</button><span class="spacer"></span><button class="btn btn--ghost" data-edit>${icon('edit')}Editează</button></div>`),
    onMount: ({ root, close }) => {
      hydrateIcons(root);
      $('[data-edit]', root).onclick = () => { close(); openForm(r); };
      $('[data-fav]', root).onclick = () => { db.update('recipes', r.id, { favorite: !r.favorite }); close(); };
      $('[data-del]', root).onclick = async () => { if (await confirmDialog(`Ștergi rețeta „${r.name}”?`)) { db.remove('recipes', r.id); close(); toast('Rețetă ștearsă', 'ok'); } };
    },
  });
}

function recipeCard(r) {
  const card = el(`<div class="card card--interactive recipe-card">
    <div class="recipe-card__top">${r.emoji}
      <button class="icon-btn" data-fav style="position:absolute;top:10px;right:10px;width:34px;height:34px;${r.favorite ? 'color:#fbbf24' : 'color:#fff'}">${icon('star')}</button>
    </div>
    <div class="recipe-card__body">
      <div class="li__title" style="font-size:16px">${esc(r.name)}</div>
      <div class="row wrap" style="gap:6px;margin-top:10px">
        <span class="badge">${esc(r.category)}</span>
        <span class="badge">${icon('clock')}${r.minutes}m</span>
        <span class="badge">${icon('users')}${r.servings}</span>
      </div>
    </div>
  </div>`);
  $('[data-fav]', card).onclick = (e) => { e.stopPropagation(); db.update('recipes', r.id, { favorite: !r.favorite }); };
  card.onclick = () => openView(r);
  return card;
}

export default {
  title: 'Rețete de gătit',
  primaryAction: () => openForm(),
  topActions(host) { host.appendChild(el(`<button class="btn" id="addRec">${icon('plus')}Rețetă nouă</button>`)); host.querySelector('#addRec').onclick = () => openForm(); },
  render(root) {
    const all = db.all('recipes');
    const cats = ['Toate', 'Favorite', ...CATS.filter((c) => all.some((r) => r.category === c))];
    if (!cats.includes(filter)) filter = 'Toate';
    const chips = el(`<div class="chip-row" style="margin-bottom:20px">${cats.map((c) => `<button class="chip ${c === filter ? 'is-active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>`);
    root.appendChild(chips);
    const grid = el(`<div></div>`); root.appendChild(grid);
    function draw() {
      grid.innerHTML = '';
      let list = all;
      if (filter === 'Favorite') list = all.filter((r) => r.favorite);
      else if (filter !== 'Toate') list = all.filter((r) => r.category === filter);
      if (!list.length) {
        grid.innerHTML = `<div class="empty"><div class="empty__icon">${icon('recipe')}</div><h3>Nicio rețetă</h3><p>Salvează-ți rețetele preferate cu ingrediente și pași de preparare.</p><button class="btn" id="emptyAdd">${icon('plus')}Rețetă nouă</button></div>`;
        const b = $('#emptyAdd', grid); if (b) b.onclick = () => openForm();
        hydrateIcons(grid); return;
      }
      const g = el(`<div class="grid grid--cards"></div>`); list.forEach((r) => g.appendChild(recipeCard(r))); grid.appendChild(g);
      hydrateIcons(grid);
    }
    $$('[data-cat]', chips).forEach((b) => b.onclick = () => { filter = b.dataset.cat; $$('[data-cat]', chips).forEach((x) => x.classList.toggle('is-active', x === b)); draw(); });
    draw();
  },
};
