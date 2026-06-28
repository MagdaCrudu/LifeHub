// Module: Notițe & To-Do
import { db } from '../store.js';
import { icon, el, esc, modal, toast, confirmDialog, fmtDate, todayISO, uid, $, $$ } from '../ui.js';

const COLORS = ['#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#60a5fa'];
let query = '';

function openForm(existing) {
  const n = existing || { title: '', body: '', color: 0, pinned: false, todos: [] };
  let todos = (n.todos || []).map((t) => ({ ...t }));
  let color = n.color || 0;

  const form = el(`<form>
    <div class="field"><label>Titlu</label><input class="input" name="title" required value="${esc(n.title)}" placeholder="ex. Idei proiect"></div>
    <div class="field"><label>Conținut</label><textarea class="textarea" name="body" placeholder="Scrie notița aici…">${esc(n.body)}</textarea></div>
    <div class="field"><label>Culoare</label><div class="chip-row" id="colors"></div></div>
    <div class="field"><label>Listă de sarcini</label><div class="list" id="todoList"></div>
      <div class="row" style="margin-top:8px"><input class="input" id="todoInput" placeholder="Adaugă o sarcină și apasă Enter"></div>
    </div>
  </form>`);

  const colorsRow = $('#colors', form);
  COLORS.forEach((c, i) => {
    const b = el(`<button type="button" class="chip" style="border-color:${c}55" title="culoare"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c}"></span></button>`);
    if (i === color) b.classList.add('is-active');
    b.onclick = () => { color = i; $$('#colors .chip', form).forEach((x, j) => x.classList.toggle('is-active', j === i)); };
    colorsRow.appendChild(b);
  });

  const todoList = $('#todoList', form);
  function renderTodos() {
    todoList.innerHTML = '';
    if (!todos.length) { todoList.innerHTML = `<div class="muted" style="font-size:13px;padding:4px 2px">Nicio sarcină încă.</div>`; return; }
    todos.forEach((t) => {
      const row = el(`<div class="li" style="padding:10px 12px">
        <button type="button" class="check ${t.done ? 'is-checked' : ''}">${icon('check')}</button>
        <span class="li__main li__title" style="font-weight:600;font-size:14px;${t.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(t.text)}</span>
        <button type="button" class="icon-btn" data-del style="width:34px;height:34px">${icon('trash')}</button>
      </div>`);
      $('.check', row).onclick = () => { t.done = !t.done; renderTodos(); };
      $('[data-del]', row).onclick = () => { todos = todos.filter((x) => x !== t); renderTodos(); };
      todoList.appendChild(row);
    });
  }
  renderTodos();
  const todoInput = $('#todoInput', form);
  todoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const v = todoInput.value.trim(); if (v) { todos.push({ id: uid(), text: v, done: false }); todoInput.value = ''; renderTodos(); } }
  });

  modal({
    title: existing ? 'Editează notița' : 'Notiță nouă', size: 560, body: form,
    footer: el(`<div class="row"><button class="btn btn--ghost" data-cancel>Anulează</button><button class="btn" data-save>${icon('check')}Salvează</button></div>`),
    onMount: ({ root, close }) => {
      $('[data-cancel]', root).onclick = close;
      $('[data-save]', root).onclick = () => {
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        const data = { title: fd.get('title').trim(), body: fd.get('body').trim(), color, todos, pinned: n.pinned || false, updatedAt: todayISO() };
        if (existing) db.update('notes', existing.id, data); else db.add('notes', data);
        close(); toast(existing ? 'Notiță actualizată' : 'Notiță adăugată', 'ok');
      };
    },
  });
}

function noteCard(n) {
  const c = COLORS[n.color || 0];
  const total = (n.todos || []).length;
  const done = (n.todos || []).filter((t) => t.done).length;
  const card = el(`<div class="card card--interactive note-card" style="border-top:3px solid ${c}">
    <div class="row row--between">
      <div class="li__title" style="font-size:16px">${esc(n.title)}</div>
      <button class="icon-btn" data-pin title="Fixează" style="width:34px;height:34px;${n.pinned ? 'color:' + c : ''}">${icon('pin')}</button>
    </div>
    ${n.body ? `<div class="note-card__body">${esc(n.body)}</div>` : '<div class="note-card__body"></div>'}
    ${total ? `<div class="row" style="gap:8px"><span class="badge" style="border-color:${c}55;color:${c}">${icon('list')}${done}/${total}</span><div class="bar" style="flex:1"><div class="bar__fill" style="width:${total ? done / total * 100 : 0}%;background:${c}"></div></div></div>` : ''}
    <div class="li__sub">${fmtDate(n.updatedAt)}</div>
  </div>`);
  $('[data-pin]', card).onclick = (e) => { e.stopPropagation(); db.update('notes', n.id, { pinned: !n.pinned }); };
  card.onclick = () => openView(n);
  return card;
}

function openView(n) {
  const c = COLORS[n.color || 0];
  const body = el(`<div>
    ${n.body ? `<p style="white-space:pre-wrap;line-height:1.6;margin:0 0 14px">${esc(n.body)}</p>` : ''}
    <div class="list" id="todos"></div>
  </div>`);
  const list = $('#todos', body);
  function draw() {
    list.innerHTML = '';
    const todos = db.get('notes', n.id)?.todos || [];
    if (!todos.length && !n.body) list.innerHTML = `<p class="muted">Notiță goală.</p>`;
    todos.forEach((t) => {
      const row = el(`<div class="li" style="padding:11px 13px">
        <button class="check ${t.done ? 'is-checked' : ''}">${icon('check')}</button>
        <span class="li__main li__title" style="font-weight:600;font-size:14.5px;${t.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(t.text)}</span>
      </div>`);
      $('.check', row).onclick = () => {
        const cur = db.get('notes', n.id);
        const tt = cur.todos.find((x) => x.id === t.id); tt.done = !tt.done;
        db.update('notes', n.id, { todos: cur.todos });
        // local redraw without full re-render flash
        $('.check', row).classList.toggle('is-checked', tt.done);
        $('.li__main', row).style.textDecoration = tt.done ? 'line-through' : '';
        $('.li__main', row).style.opacity = tt.done ? '.6' : '1';
      };
      list.appendChild(row);
    });
  }
  draw();
  modal({
    title: n.title, size: 540, body,
    footer: el(`<div class="row"><button class="btn btn--danger" data-del>${icon('trash')}Șterge</button><span class="spacer"></span><button class="btn btn--ghost" data-edit>${icon('edit')}Editează</button></div>`),
    onMount: ({ root, close }) => {
      $('[data-edit]', root).onclick = () => { close(); openForm(n); };
      $('[data-del]', root).onclick = async () => { if (await confirmDialog(`Ștergi notița „${n.title}”?`)) { db.remove('notes', n.id); close(); toast('Notiță ștearsă', 'ok'); } };
    },
  });
}

export default {
  title: 'Notițe & To-Do',
  primaryAction: () => openForm(),
  topActions(host) { host.appendChild(el(`<button class="btn" id="addNote">${icon('plus')}Notiță nouă</button>`)); host.querySelector('#addNote').onclick = () => openForm(); },
  render(root) {
    const search = el(`<div class="card" style="padding:6px 8px;margin-bottom:18px;display:flex;align-items:center;gap:8px">${icon('search')}<input class="input" id="q" placeholder="Caută în notițe…" value="${esc(query)}" style="border:0;background:transparent;box-shadow:none"></div>`);
    root.appendChild(search);
    $('#q', search).oninput = (e) => { query = e.target.value; rerenderList(); };

    const container = el(`<div></div>`);
    root.appendChild(container);
    function rerenderList() {
      container.innerHTML = '';
      let list = db.all('notes');
      if (query) { const q = query.toLowerCase(); list = list.filter((n) => (n.title + ' ' + n.body + ' ' + (n.todos || []).map((t) => t.text).join(' ')).toLowerCase().includes(q)); }
      const pinned = list.filter((n) => n.pinned), rest = list.filter((n) => !n.pinned);
      if (!list.length) {
        container.innerHTML = query ? `<div class="empty"><div class="empty__icon">${icon('search')}</div><h3>Niciun rezultat</h3><p>Nicio notiță nu corespunde căutării „${esc(query)}”.</p></div>`
          : `<div class="empty"><div class="empty__icon">${icon('notes')}</div><h3>Nicio notiță</h3><p>Creează notițe și liste de sarcini ca să-ți organizezi ideile.</p><button class="btn" id="emptyAdd">${icon('plus')}Notiță nouă</button></div>`;
        const b = $('#emptyAdd', container); if (b) b.onclick = () => openForm();
        import('../ui.js').then((m) => m.hydrateIcons(container));
        return;
      }
      if (pinned.length) {
        container.appendChild(el(`<div class="section-title"><h2>${'📌'} Fixate</h2></div>`));
        const g = el(`<div class="grid grid--cards"></div>`); pinned.forEach((n) => g.appendChild(noteCard(n))); container.appendChild(g);
      }
      if (rest.length) {
        if (pinned.length) container.appendChild(el(`<div class="section-title"><h2>Altele</h2></div>`));
        const g = el(`<div class="grid grid--cards"></div>`); rest.forEach((n) => g.appendChild(noteCard(n))); container.appendChild(g);
      }
      import('../ui.js').then((m) => m.hydrateIcons(container));
    }
    rerenderList();
  },
};
