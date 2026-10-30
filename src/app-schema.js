/* ===== app-schema: database picker, tables panel, switching databases ===== */
function renderTopDs() {
  const e = active();
  $('#ds-ic').innerHTML = icon(e.icon || 'db', 'ic-sm');
  $('#ds-name').textContent = e.name;
  $('#ds-dirty').hidden = !(e.builtin && e.dirty);
}

function renderSchema() {
  const e = active();
  const sch = e.schema;
  const body = $('#schema-body');
  const n = sch.order.length;
  $('#schema-sub').textContent = `${n} ${n === 1 ? 'table' : 'tables'}`;
  if (n && !S.seeded.has(S.active)) { S.seeded.add(S.active); S.openTables.add(S.active + ':' + sch.order[0]); }
  if (!n) {
    body.innerHTML = `<div class="schema-empty"><p>No tables yet.</p><p><button class="btn btn-sm" type="button" data-act="import">${icon('upload', 'ic-sm')} Import data</button></p><p>Or create one in the SQL editor with <code>CREATE TABLE</code>.</p></div>`;
  } else {
    body.innerHTML = `<ul class="tlist">${sch.order.map(name => tableItem(sch.tables[name], (e.notes || {})[name])).join('')}</ul>`;
  }
  $('#schema-foot').innerHTML = `<div class="legend"><span><span class="key pk">PK</span> primary key</span><span><span class="key fk">FK</span> foreign key</span></div><div style="margin-top:6px">Drag tables and columns into the builder or the editor, or click them.</div>`;
}
function tableItem(t, note) {
  const open = S.openTables.has(S.active + ':' + t.name);
  const count = t.type === 'view' ? 'view' : (t.count == null ? '' : fmtNum(t.count));
  return `<li class="titem${open ? ' open' : ''}" data-t="${esc(t.name)}">
    <div class="trow" draggable="true">
      <button class="tog" type="button" aria-label="Show the columns of ${esc(t.name)}" aria-expanded="${open}">${icon('chev', 'ic-sm')}</button>
      ${icon(t.type === 'view' ? 'layers' : 'table', 'ic-sm t-ic')}
      <span class="tname" title="${esc(t.name)}">${esc(t.name)}</span>
      <span class="tcount" title="rows">${count}</span>
      <span class="tacts">
        <button type="button" data-act="preview" title="Preview rows" aria-label="Preview the rows of ${esc(t.name)}">${icon('eye', 'ic-sm')}</button>
        <button type="button" data-act="add" title="Add to the query" aria-label="Add ${esc(t.name)} to the query">${icon('plus', 'ic-sm')}</button>
      </span>
    </div>
    <ul class="clist">
      ${note && note._ ? `<li class="tdesc" style="padding-left:6px">${esc(note._)}</li>` : ''}
      ${t.columns.map(c => colItem(t, c, note)).join('')}
    </ul>
  </li>`;
}
function colItem(t, c, note) {
  const fk = t.fks.find(f => f.from === c.name);
  const key = c.pk ? '<span class="key pk">PK</span>' : fk ? '<span class="key fk">FK</span>' : '<span class="key none"></span>';
  const tip = [c.type || 'any type', c.pk ? 'primary key' : '', c.notnull && !c.pk ? 'required (NOT NULL)' : '', fk ? `points to ${fk.table}.${fk.to}` : '', note && note[c.name] ? note[c.name] : ''].filter(Boolean).join(' · ');
  return `<li class="crow" draggable="true" data-c="${esc(c.name)}" title="${esc(tip)}">${key}<span class="cname">${esc(c.name)}</span>${fk ? `<span class="cref">→ ${esc(fk.table)}</span>` : ''}<span class="ctype">${esc(shortType(c.type))}</span></li>`;
}

function previewTable(name) {
  const sql = `SELECT *\nFROM ${qi(name)}\nLIMIT 200;`;
  Results.run(sql, { source: 'preview', noHistory: true, title: `Preview: ${name}`, previewSql: sql });
  if (MQ_NARROW.matches) { closeDrawers(); $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
function qualifiedName(table, col) {
  if (!col) return qi(table);
  return Editor.needsQualify() ? `${qi(table)}.${qi(col)}` : qi(col);
}
function useTable(name) {
  if (S.mode === 'builder') Builder.addTable(name);
  else Editor.insertSmart(qi(name));
  if (MQ_NARROW.matches) closeDrawers();
}
function useColumn(table, col) {
  if (S.mode === 'builder') Builder.addField(table, col);
  else Editor.insertSmart(qualifiedName(table, col));
  if (MQ_NARROW.matches) closeDrawers();
}

function initSchemaEvents() {
  const body = $('#schema-body');
  body.addEventListener('click', e => {
    if (e.target.closest('[data-act="import"]')) { Import.open(); return; }
    const li = e.target.closest('.titem');
    if (!li) return;
    const name = li.dataset.t;
    const act = e.target.closest('[data-act]');
    if (act) { if (act.dataset.act === 'preview') previewTable(name); else useTable(name); return; }
    const crow = e.target.closest('.crow');
    if (crow) { useColumn(name, crow.dataset.c); return; }
    if (e.target.closest('.trow')) {
      const key = S.active + ':' + name;
      if (S.openTables.has(key)) S.openTables.delete(key); else S.openTables.add(key);
      li.classList.toggle('open');
      const tog = li.querySelector('.tog');
      if (tog) tog.setAttribute('aria-expanded', li.classList.contains('open'));
    }
  });
  body.addEventListener('dblclick', e => {
    const row = e.target.closest('.trow');
    if (row && !e.target.closest('button')) previewTable(row.closest('.titem').dataset.t);
  });
  body.addEventListener('dragstart', e => {
    const li = e.target.closest('.titem');
    if (!li) return;
    const crow = e.target.closest('.crow');
    const payload = { table: li.dataset.t, col: crow ? crow.dataset.c : null };
    S.dragPayload = payload;
    try {
      e.dataTransfer.setData('text/plain', payload.col || payload.table);
      e.dataTransfer.setData('application/x-qlab', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copy';
    } catch (err) { /* ignore */ }
    if (MQ_NARROW.matches) setTimeout(closeDrawers, 50);
  });
  body.addEventListener('dragend', () => { S.dragPayload = null; $$('.drop-on').forEach(n => n.classList.remove('drop-on')); });
}

// ---------- database menu ----------
function dsMenuItem(e) {
  const tables = e.schema ? e.schema.order.length : null;
  const sub = e.builtin ? e.blurb : (tables == null ? e.blurb : `${tables} ${tables === 1 ? 'table' : 'tables'} · kept in this browser`);
  return `<button class="menu-item" type="button" role="menuitemradio" aria-checked="${e.id === S.active}" data-db="${esc(e.id)}">
    <span class="mi-ic">${icon(e.icon || 'db', 'ic-sm')}</span>
    <span class="mi-text"><span class="mi-title">${esc(e.name)}${e.builtin && e.dirty ? '<span class="ds-dirty">modified</span>' : ''}</span><span class="mi-sub">${esc(sub)}</span></span>
    ${e.id === S.active ? icon('check', 'ic-sm') : ''}
  </button>`;
}
function renderDsMenu() {
  const m = $('#ds-menu');
  const e = active();
  const builtins = [...S.dbs.values()].filter(x => x.builtin);
  const user = [...S.dbs.values()].filter(x => !x.builtin);
  const acts = [];
  acts.push(`<button class="menu-item act" type="button" data-menu="import">${icon('upload', 'ic-sm')} Import data…</button>`);
  if (e.builtin) acts.push(`<button class="menu-item act" type="button" data-menu="reset" ${e.dirty ? '' : 'disabled'}>${icon('reset', 'ic-sm')} Reset “${esc(e.name)}” to the original data</button>`);
  if (S.caps.downloads) acts.push(`<button class="menu-item act" type="button" data-menu="zip">${icon('download', 'ic-sm')} Save “${esc(e.name)}” as a file (.zip with SQLite + SQL)</button>`);
  acts.push(`<button class="menu-item act" type="button" data-menu="dump">${icon('copy', 'ic-sm')} Copy “${esc(e.name)}” as an SQL script</button>`);
  if (!e.builtin && e.id === 'mine') acts.push(`<button class="menu-item act btn-danger" type="button" data-menu="empty">${icon('trash', 'ic-sm')} Delete all tables in “My database”</button>`);
  if (!e.builtin && e.id !== 'mine') acts.push(`<button class="menu-item act btn-danger" type="button" data-menu="remove">${icon('trash', 'ic-sm')} Remove “${esc(e.name)}” from this browser</button>`);
  m.innerHTML = `<div class="menu-sec">Sample databases</div>${builtins.map(dsMenuItem).join('')}
    <div class="menu-sec">Your data</div>${user.map(dsMenuItem).join('')}
    <div class="menu-sep"></div>${acts.join('')}`;
}
function toggleDsMenu(force) {
  const m = $('#ds-menu');
  const open = force != null ? force : m.hidden;
  if (open) { renderDsMenu(); m.hidden = false; $('#ds-btn').setAttribute('aria-expanded', 'true'); setTimeout(() => document.addEventListener('pointerdown', dsOutside, true), 0); }
  else { m.hidden = true; $('#ds-btn').setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', dsOutside, true); }
}
function dsOutside(e) { if (!e.target.closest('.ds')) toggleDsMenu(false); }
function initDsMenu() {
  $('#ds-btn').addEventListener('click', () => toggleDsMenu());
  $('#ds-menu').addEventListener('click', async e => {
    const item = e.target.closest('[data-db]');
    if (item) { toggleDsMenu(false); if (item.dataset.db !== S.active) setActive(item.dataset.db, { announce: true }); return; }
    const act = e.target.closest('[data-menu]');
    if (!act || act.disabled) return;
    toggleDsMenu(false);
    const cur = active();
    switch (act.dataset.menu) {
      case 'import': Import.open(); break;
      case 'reset': resetDataset(cur.id); break;
      case 'zip': Import.exportZip(cur); break;
      case 'dump': copyText(Import.dump(cur.db), `Copied “${esc(cur.name)}” as an SQL script`); break;
      case 'empty':
        if (await confirmBox({ title: 'Delete all tables?', body: '<p>This removes every table in “My database” from this browser. It can’t be undone.</p>', ok: 'Delete tables', danger: true })) {
          cur.db.close(); cur.db = openBytes(null); cur.schema = readSchema(cur); persistSoon(cur);
          setActive(cur.id); toast('“My database” is empty now.');
        }
        break;
      case 'remove':
        if (await confirmBox({ title: `Remove “${esc(cur.name)}”?`, body: '<p>The database is removed from this browser. Your original file is not affected.</p>', ok: 'Remove', danger: true })) {
          const id = cur.id;
          try { cur.db && cur.db.close(); } catch (err) { /* ignore */ }
          S.dbs.delete(id); delete S.builders[id]; idb.del('db:' + id);
          setActive('mine'); toast('Database removed.');
        }
        break;
    }
  });
}
function resetDataset(id) {
  const e = S.dbs.get(id);
  if (!e || !e.builtin || !e.pristine) return;
  try { e.db.close(); } catch (err) { /* ignore */ }
  e.db = openBytes(e.pristine);
  e.dirty = false; e.tx = false;
  e.schema = readSchema(e);
  Learn.reapplySetup(id);
  if (id === S.active) { renderTopDs(); renderSchema(); Builder.revalidate(); Editor.refresh(); Results.clear(); if (S.mode === 'builder') Builder.scheduleRun(); }
  toast(`“${esc(e.name)}” is back to its original data.`, { icon: 'reset' });
}

function setActive(id, opts) {
  opts = opts || {};
  if (!S.dbs.has(id)) id = 'shop';
  Editor.saveBuffer();
  const e = ensureBuilt(id);
  S.active = id;
  S.prefs.lastDb = id; savePrefs();
  renderTopDs();
  renderSchema();
  Builder.load();
  if (!S.lesson) Editor.setContext('ds:' + id);
  else Editor.refresh();
  Results.clear();
  if (S.mode === 'builder') Builder.scheduleRun(true);
  Learn.render();
  if (opts.announce) toast(`Switched to <b>${esc(e.name)}</b>`, { icon: e.icon || 'db', ms: 2200 });
}
