/* ===== app-base: helpers, icons, storage, state, databases, overlays, layout ===== */
const QL = window.QL;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = QL.esc;
const qi = QL.qi;
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const plain = html => String(html).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const fmtNum = n => Number(n).toLocaleString('en-US');
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
const MOD = IS_MAC ? '⌘' : 'Ctrl';
const SVGNS = 'http://www.w3.org/2000/svg';
const shortType = t => String(t || '').replace(/\(.*\)/, '').toUpperCase() || 'ANY';

// ---------- icons ----------
const ICONS = {
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14.5h18M9 9v11"/>',
  db: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L21 7.5H6.4"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5v-15Z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18"/>',
  music: '<path d="M9 18V5.5l11-2v12.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
  pencil: '<path d="M4 20l1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19 4 20Z"/><path d="M13.5 7.3l3.2 3.2"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M7 4.8v14.4L19 12 7 4.8Z" fill="currentColor"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
  reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.5H8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17h.01"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.2 1.1 2.2h5c0-1 .3-1.6 1.1-2.2A6 6 0 0 0 12 3Z"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  builder: '<rect x="3" y="3.5" width="8" height="7" rx="1.5"/><rect x="13" y="13.5" width="8" height="7" rx="1.5"/><path d="M11 7h3a2.5 2.5 0 0 1 2.5 2.5v4"/>',
  code: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5"/>',
  grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  sparkle: '<path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z"/><path d="M19 15.5c.2 1.4 1 2.2 2.5 2.5-1.4.3-2.3 1.1-2.5 2.5-.2-1.4-1-2.2-2.5-2.5 1.4-.3 2.3-1.1 2.5-2.5Z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  logo: '<rect x="3" y="3.5" width="13" height="13" rx="2"/><path d="M3 8h13M7.8 8v8.5"/><circle cx="16.5" cy="16.5" r="3.7" fill="currentColor" fill-opacity=".15"/><path d="m19.2 19.2 2.3 2.3"/>',
};
const icon = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const VENN = (fillLeft, fillRight, inner) => `<svg class="venn" viewBox="0 0 22 14" aria-hidden="true">${fillLeft ? '<circle cx="8" cy="7" r="6" fill="currentColor" fill-opacity=".45"/>' : ''}${fillRight ? '<circle cx="14" cy="7" r="6" fill="currentColor" fill-opacity=".45"/>' : ''}${inner && !fillLeft && !fillRight ? '<path d="M11 1.8A6 6 0 0 1 11 12.2A6 6 0 0 1 11 1.8Z" fill="currentColor" fill-opacity=".6"/>' : ''}<circle cx="8" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="14" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

// ---------- storage: per-viewer conveniences only ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('qlab.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('qlab.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};
const idb = (() => {
  let opening = null;
  const open = () => opening || (opening = new Promise(res => {
    try {
      const r = indexedDB.open('query-lab', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('dbs');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch (e) { res(null); }
  }));
  const write = async (fn) => {
    const db = await open();
    if (!db) return false;
    return new Promise(res => {
      try {
        const t = db.transaction('dbs', 'readwrite');
        fn(t.objectStore('dbs'));
        t.oncomplete = () => res(true); t.onerror = () => res(false); t.onabort = () => res(false);
      } catch (e) { res(false); }
    });
  };
  return {
    put: (k, v) => write(s => s.put(v, k)),
    del: k => write(s => s.delete(k)),
    async all() {
      const db = await open();
      if (!db) return [];
      return new Promise(res => {
        try {
          const out = [];
          const c = db.transaction('dbs', 'readonly').objectStore('dbs').openCursor();
          c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); };
          c.onerror = () => res([]);
        } catch (e) { res([]); }
      });
    },
  };
})();

// ---------- state ----------
const S = {
  SQL: null,
  dbs: new Map(),
  active: 'shop',
  mode: 'builder',
  prefs: Object.assign({ theme: null, wl: 252, wr: 372, top: 62, sideOff: false, welcomeDone: false, tourDone: false, lastDb: 'shop', mode: 'builder', sideTab: 'learn' }, store.get('prefs', {})),
  builders: store.get('builders', {}),
  buffers: store.get('buffers', {}),
  progress: store.get('progress', {}),
  history: store.get('history', []),
  lesson: null,
  last: null,
  builderQuery: null,
  dragPayload: null,
  openTables: new Set(),
  seeded: new Set(),
  caps: { sample: null, downloads: null },
};
const savePrefs = debounce(() => store.set('prefs', S.prefs), 200);

// ---------- databases ----------
const dsMeta = id => QL.DATASETS.find(d => d.id === id);
const active = () => S.dbs.get(S.active);
const tableNames = () => (active() ? active().schema.order : []);
const tableSet = () => new Set(tableNames().map(t => t.toLowerCase()));
function registerBuiltins() {
  for (const ds of QL.DATASETS) S.dbs.set(ds.id, { id: ds.id, name: ds.name, icon: ds.icon, blurb: ds.blurb, builtin: true, notes: ds.notes, order: ds.order, db: null, pristine: null, dirty: false, tx: false, schema: null });
  S.dbs.set('mine', { id: 'mine', name: 'My database', icon: 'user', blurb: 'Your own tables, kept in this browser', builtin: false, notes: {}, order: [], db: null, bytes: null, tx: false, schema: null });
}
function openBytes(bytes) {
  const db = bytes ? new S.SQL.Database(bytes) : new S.SQL.Database();
  try { db.run('PRAGMA foreign_keys = ON'); } catch (e) { /* ignore */ }
  return db;
}
function ensureBuilt(id) {
  const e = S.dbs.get(id);
  if (!e) return null;
  if (!e.db) {
    if (e.builtin) {
      const spec = dsMeta(id).build();
      const db = new S.SQL.Database();
      db.exec(spec.ddl);
      db.exec('BEGIN');
      for (const t of spec.tables) {
        const st = db.prepare(`INSERT INTO ${qi(t.name)} (${t.columns.map(qi).join(', ')}) VALUES (${t.columns.map(() => '?').join(', ')})`);
        for (const r of t.rows) st.run(r);
        st.free();
      }
      db.exec('COMMIT');
      e.pristine = db.export();
      db.run('PRAGMA foreign_keys = ON');
      e.db = db;
    } else {
      e.db = openBytes(e.bytes);
      e.bytes = null;
    }
    e.schema = readSchema(e);
  }
  return e;
}
function readSchema(e) {
  const db = e.db;
  const q = sql => { const r = db.exec(sql); return r.length ? r[0].values : []; };
  const tables = {};
  for (const [name, type, sql] of q("SELECT name, type, sql FROM sqlite_schema WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'")) {
    const columns = q(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(${QL.strLit(name)})`)
      .map(([n, t, nn, d, pk]) => ({ name: n, type: t || '', notnull: !!nn, dflt: d, pk: !!pk }));
    const fks = type === 'table' ? q(`SELECT "from", "table", "to" FROM pragma_foreign_key_list(${QL.strLit(name)})`).map(([from, table, to]) => ({ from, table, to })) : [];
    let count = null;
    if (type === 'table') { try { count = q(`SELECT COUNT(*) FROM ${qi(name)}`)[0][0]; } catch (err) { count = null; } }
    tables[name] = { name, type, sql, columns, fks, count };
  }
  for (const t of Object.values(tables)) for (const f of t.fks) {
    if (!f.to) { const target = tables[f.table]; const pk = target && target.columns.find(c => c.pk); f.to = pk ? pk.name : 'id'; }
  }
  const pref = e.order || [];
  const rank = n => { const i = pref.indexOf(n); return i < 0 ? 999 : i; };
  const order = Object.keys(tables).sort((a, b) => rank(a) - rank(b) || (tables[a].type === tables[b].type ? 0 : tables[a].type === 'table' ? -1 : 1) || a.localeCompare(b));
  return { tables, order };
}
function errorContext() {
  const sch = active().schema;
  return { tables: sch.order.slice(), columns: Object.fromEntries(sch.order.map(t => [t, sch.tables[t].columns.map(c => c.name)])) };
}
function identSet() {
  const sch = active().schema;
  const set = new Set();
  for (const t of sch.order) { set.add(t.toLowerCase()); for (const c of sch.tables[t].columns) set.add(c.name.toLowerCase()); }
  return set;
}
const persistTimers = {};
function persistSoon(e) {
  if (!e || e.builtin) return;
  clearTimeout(persistTimers[e.id]);
  persistTimers[e.id] = setTimeout(() => {
    if (e.tx || !e.db) return;
    try {
      const bytes = e.db.export();
      e.db.run('PRAGMA foreign_keys = ON');
      idb.put('db:' + e.id, { id: e.id, name: e.name, icon: e.icon, bytes, t: Date.now() });
    } catch (err) { /* keep working without persistence */ }
  }, 700);
}
async function restoreUserDbs() {
  const all = await idb.all();
  for (const [key, val] of all) {
    if (!String(key).startsWith('db:') || !val || !val.bytes) continue;
    const id = val.id || String(key).slice(3);
    const prev = S.dbs.get(id);
    S.dbs.set(id, Object.assign(prev || { builtin: false, notes: {}, order: [], tx: false, schema: null, db: null }, {
      id, name: val.name || 'Imported database', icon: val.icon || 'file', blurb: prev ? prev.blurb : 'Opened from a file, kept in this browser', bytes: val.bytes, db: null,
    }));
  }
}

// ---------- toasts, modal, popover ----------
function toast(html, opts) {
  opts = opts || {};
  const el = h(`<div class="toast" role="status">${opts.icon ? icon(opts.icon) : ''}<span>${html}</span></div>`);
  if (opts.action) {
    const b = h(`<button type="button">${esc(opts.action.label)}</button>`);
    b.addEventListener('click', () => { el.remove(); opts.action.run(); });
    el.append(b);
  }
  $('#toasts').append(el);
  const all = $$('.toast');
  if (all.length > 3) all[0].remove();
  setTimeout(() => el.remove(), opts.ms || (opts.action ? 6000 : 3400));
}
const Modal = {
  onClose: null,
  open(html, opts) {
    opts = opts || {};
    const box = $('#modal-box');
    box.className = 'modal' + (opts.narrow ? ' narrow' : '');
    box.innerHTML = html;
    $('#modal').hidden = false;
    Modal.onClose = opts.onClose || null;
    const f = box.querySelector('[autofocus]') || box.querySelector('input, select, textarea, button');
    if (f) setTimeout(() => f.focus(), 30);
    return box;
  },
  close() {
    if ($('#modal').hidden) return;
    $('#modal').hidden = true;
    $('#modal-box').innerHTML = '';
    const cb = Modal.onClose; Modal.onClose = null;
    if (cb) cb();
  },
};
function confirmBox(o) {
  return new Promise(res => {
    const box = Modal.open(`<div class="modal-h"><h2 id="modal-title">${o.title}</h2></div><div class="modal-b">${o.body || ''}</div>
      <div class="modal-f"><button class="btn" type="button" data-a="no">Cancel</button><button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" type="button" data-a="yes" autofocus>${o.ok || 'OK'}</button></div>`, { narrow: true, onClose: () => res(false) });
    box.querySelector('[data-a="no"]').addEventListener('click', () => Modal.close());
    box.querySelector('[data-a="yes"]').addEventListener('click', () => { Modal.onClose = null; Modal.close(); res(true); });
  });
}
const Pop = {
  items: [],
  open(anchor, items) {
    const el = $('#pop');
    Pop.items = items;
    el.innerHTML = items.map((it, i) => it.sep ? '<div class="menu-sep"></div>' : `<button class="menu-item act" type="button" role="${it.checked != null ? 'menuitemradio' : 'menuitem'}" ${it.checked != null ? `aria-checked="${!!it.checked}"` : ''} data-i="${i}">${it.html}</button>`).join('');
    el.hidden = false;
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
    const w = el.offsetWidth, hh = el.offsetHeight;
    let x = Math.min(r.left, innerWidth - w - 12), y = r.bottom + 6;
    if (y + hh > innerHeight - 12) y = Math.max(12, r.top - hh - 6);
    el.style.left = Math.max(12, x) + 'px';
    el.style.top = y + 'px';
    setTimeout(() => document.addEventListener('pointerdown', Pop.outside, true), 0);
  },
  close() { $('#pop').hidden = true; document.removeEventListener('pointerdown', Pop.outside, true); },
  outside(e) { if (!e.target.closest('#pop')) Pop.close(); },
};
$('#pop').addEventListener('click', e => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  const it = Pop.items[+b.dataset.i];
  Pop.close();
  if (it && it.run) it.run();
});
async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg || 'Copied', { icon: 'check' });
  } catch (e) {
    const ta = h('<textarea style="position:fixed;left:-9999px;top:0" aria-hidden="true"></textarea>');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
    toast(ok ? (okMsg || 'Copied') : 'Copying isn’t allowed here. Select the text and press ' + MOD + '+C.', { icon: ok ? 'check' : 'info' });
  }
}
async function saveFile(filename, data) {
  const d = S.caps.downloads;
  if (!d) { toast('Saving files isn’t available here.'); return false; }
  try {
    await d.save({ filename, data });
    return true;
  } catch (e) {
    const code = e && e.code;
    if (code === 'declined') return false;
    if (code === 'rate_limited') toast('A save is already waiting for your confirmation.');
    else if (code === 'too_large') toast('The file is too large to save here.');
    else toast('The file couldn’t be saved.');
    return false;
  }
}

// ---------- theme & layout ----------
const MQ_MID = matchMedia('(max-width: 1180px)');
const MQ_NARROW = matchMedia('(max-width: 760px)');
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
function applyTheme() {
  if (S.prefs.theme) document.documentElement.dataset.theme = S.prefs.theme; else delete document.documentElement.dataset.theme;
  $('#btn-theme').innerHTML = icon(isDark() ? 'sun' : 'moon');
}
function applyLayout() {
  const app = $('#app');
  app.style.setProperty('--w-left', S.prefs.wl + 'px');
  app.style.setProperty('--w-right', S.prefs.wr + 'px');
  app.style.setProperty('--top', S.prefs.top + '%');
  app.classList.toggle('side-off', !!S.prefs.sideOff);
}
const sideVisible = () => (MQ_MID.matches ? $('#side').classList.contains('open') : !S.prefs.sideOff);
function openDrawer(id) {
  closeDrawers();
  const el = $('#' + id);
  el.classList.add('open');
  $('#scrim').hidden = false;
  const f = el.querySelector('button, [tabindex]');
  if (f) setTimeout(() => f.focus(), 60);
  afterLayout();
}
function closeDrawers() {
  $$('.schema.open, .side.open').forEach(e => e.classList.remove('open'));
  $('#scrim').hidden = true;
  afterLayout();
}
function toggleLearn() {
  if (MQ_MID.matches) {
    if ($('#side').classList.contains('open')) closeDrawers(); else openDrawer('side');
  } else {
    S.prefs.sideOff = !S.prefs.sideOff;
    savePrefs();
    applyLayout();
    afterLayout();
  }
}
function afterLayout() {
  requestAnimationFrame(() => { Builder.drawLinks(); Learn.updateStrip(); });
}
function initSplit(el, onMove, onReset, onKey) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    const move = ev => onMove(ev);
    const up = () => {
      el.classList.remove('dragging');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      savePrefs();
      afterLayout();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  el.addEventListener('dblclick', () => { onReset(); applyLayout(); savePrefs(); afterLayout(); });
  el.addEventListener('keydown', e => {
    const d = { ArrowLeft: -16, ArrowUp: -16, ArrowRight: 16, ArrowDown: 16 }[e.key];
    if (d) { e.preventDefault(); onKey(d); applyLayout(); savePrefs(); afterLayout(); }
  });
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function initSplitters() {
  initSplit($('#split-left'), ev => {
    S.prefs.wl = clamp(Math.round(ev.clientX - $('#schema').getBoundingClientRect().left), 190, 460);
    applyLayout();
  }, () => { S.prefs.wl = 252; }, d => { S.prefs.wl = clamp(S.prefs.wl + d, 190, 460); });
  initSplit($('#split-right'), ev => {
    S.prefs.wr = clamp(Math.round($('#side').getBoundingClientRect().right - ev.clientX), 300, 580);
    applyLayout();
  }, () => { S.prefs.wr = 372; }, d => { S.prefs.wr = clamp(S.prefs.wr - d, 300, 580); });
  initSplit($('#split-mid'), ev => {
    const r = $('#work').getBoundingClientRect();
    const strip = $('#task-strip').hidden ? 0 : $('#task-strip').offsetHeight + 8;
    S.prefs.top = clamp(Math.round((ev.clientY - r.top - strip) / (r.height - strip) * 100), 24, 84);
    applyLayout();
  }, () => { S.prefs.top = 62; }, d => { S.prefs.top = clamp(S.prefs.top + d / 8, 24, 84); });
}
