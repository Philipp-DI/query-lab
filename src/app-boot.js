/* ===== app-boot: guided tour, global wiring, start-up ===== */
const Tour = (() => {
  const root = $('#tour');
  let i = 0;
  const steps = [
    { sel: ['#ds-btn'], title: 'Pick a database', text: 'Four sample databases with realistic data: an online shop, a library, a company and a music service. Your own data goes into “My database”.' },
    { sel: ['#schema', '#btn-schema'], title: 'Tables and columns', text: 'The eye icon previews a table. Drag tables and columns into the builder or the editor, or simply click them.' },
    { sel: ['#canvas', '#mode-builder'], title: 'Build queries visually', text: 'Tick columns, drag a column’s dot onto another table to join them, then filter, sort and summarize below. The SQL is written for you, with a plain-English explanation.', before: () => setMode('builder') },
    { sel: ['#mode-editor'], title: 'Or write SQL yourself', text: `The editor highlights SQL, suggests tables and columns (Ctrl+Space) and runs with ${MOD}+Enter.` },
    { sel: ['#results'], title: 'Results and help', text: 'Results appear here. When something goes wrong you get a plain-language explanation and, where possible, a one-click fix.' },
    { sel: ['#side', '#btn-learn'], title: 'Learn step by step', text: `${QL.LESSONS.length} lessons with exercises that are checked automatically, plus a reference and your query history.` },
  ];
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const target = st => { for (const s of st.sel) { const el = $(s); if (visible(el)) return el; } return null; };
  function start() { closeDrawers(); Pop.close(); toggleDsMenu(false); i = 0; root.hidden = false; show(); }
  function show() {
    const st = steps[i];
    if (st.before) st.before();
    const el = target(st);
    if (!el) { if (i < steps.length - 1) { i++; show(); } else end(); return; }
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    const pad = 6;
    root.innerHTML = `<div class="tour-spot" style="left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px"></div>
      <div class="tour-card" role="dialog" aria-label="${esc(st.title)}"><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p>
      <div class="row"><span class="count">${i + 1} / ${steps.length}</span><button class="btn btn-sm btn-ghost" type="button" data-t="end">Skip</button>${i ? '<button class="btn btn-sm" type="button" data-t="prev">Back</button>' : ''}<button class="btn btn-sm btn-primary" type="button" data-t="next">${i === steps.length - 1 ? 'Done' : 'Next'}</button></div></div>`;
    const card = root.querySelector('.tour-card');
    const cw = card.offsetWidth, ch = card.offsetHeight, W = innerWidth, H = innerHeight;
    let x, y;
    if (r.right + 16 + cw < W) { x = r.right + 16; y = r.top; }
    else if (r.left - 16 - cw > 0) { x = r.left - 16 - cw; y = r.top; }
    else if (r.bottom + 16 + ch < H) { x = r.left; y = r.bottom + 16; }
    else { x = r.left; y = r.top - 16 - ch; }
    card.style.left = clamp(x, 12, W - cw - 12) + 'px';
    card.style.top = clamp(y, 12, H - ch - 12) + 'px';
    const nx = card.querySelector('[data-t="next"]');
    if (nx) nx.focus();
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    if (b.dataset.t === 'next') { if (i < steps.length - 1) { i++; show(); } else end(); }
    else if (b.dataset.t === 'prev') { i = Math.max(0, i - 1); show(); }
    else end();
  });
  function end() { root.hidden = true; root.innerHTML = ''; S.prefs.tourDone = true; savePrefs(); }
  window.addEventListener('resize', debounce(() => { if (!root.hidden) show(); }, 150));
  return { start, end, isOpen: () => !root.hidden };
})();

function wire() {
  $('#logo').innerHTML = icon('logo');
  $('#mode-builder').innerHTML = `${icon('builder', 'ic-sm')}<span>Visual builder</span>`;
  $('#mode-editor').innerHTML = `${icon('code', 'ic-sm')}<span>SQL editor</span>`;
  $('#btn-run').innerHTML = `${icon('play', 'ic-sm')} Run <kbd class="hide-sm">${MOD} ↵</kbd>`;
  $('#btn-schema').innerHTML = icon('list');
  $('#btn-tour').innerHTML = icon('help');
  $('#ic-import').outerHTML = icon('upload', 'ic-sm');
  $('#ic-learn').outerHTML = icon('book', 'ic-sm');
  $('#ds-chev').innerHTML = icon('chevDown', 'ic-sm');
  $$('[data-close]').forEach(b => {
    b.innerHTML = icon('x', 'ic-sm');
    b.addEventListener('click', () => {
      if (b.dataset.close === 'side' && !MQ_MID.matches) { S.prefs.sideOff = true; savePrefs(); applyLayout(); afterLayout(); }
      else closeDrawers();
    });
  });
  $('#mode-builder').addEventListener('click', () => setMode('builder'));
  $('#mode-editor').addEventListener('click', () => setMode('editor'));
  $('#btn-run').addEventListener('click', runCurrent);
  $('#btn-schema').addEventListener('click', () => openDrawer('schema'));
  $('#btn-learn').addEventListener('click', toggleLearn);
  $('#btn-import').addEventListener('click', () => Import.open());
  $('#btn-theme').addEventListener('click', () => { S.prefs.theme = isDark() ? 'light' : 'dark'; savePrefs(); applyTheme(); });
  $('#btn-tour').addEventListener('click', () => Tour.start());
  $('#scrim').addEventListener('click', closeDrawers);
  $('#ws-tools').addEventListener('click', e => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    switch (b.dataset.tool) {
      case 'all': Builder.addAll(); break;
      case 'clear': Builder.clearAll(); break;
      case 'explain': Claude.ask('explain', { sql: currentSQL() }); break;
      case 'write': Claude.ask('write', {}); break;
      case 'clear-ed': Editor.replaceAll(''); Editor.focus(); toast(`Editor cleared. Undo with ${MOD}+Z.`); break;
    }
  });
  $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') Modal.close(); });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if ($('#modal').hidden && !Tour.isOpen() && e.target.id !== 'ed-ta' && !e.target.closest('#sheet')) { e.preventDefault(); runCurrent(); }
      return;
    }
    if (e.key === 'Escape') {
      if (Tour.isOpen()) Tour.end();
      else if (!$('#modal').hidden) Modal.close();
      else if (!$('#pop').hidden) Pop.close();
      else if (!$('#ds-menu').hidden) toggleDsMenu(false);
      else if (Claude.isOpen()) Claude.close();
      else if (!$('#scrim').hidden) closeDrawers();
    }
  });
  const onMid = () => { closeDrawers(); applyLayout(); afterLayout(); };
  if (MQ_MID.addEventListener) MQ_MID.addEventListener('change', onMid); else MQ_MID.addListener(onMid);
  const dark = matchMedia('(prefers-color-scheme: dark)');
  if (dark.addEventListener) dark.addEventListener('change', applyTheme);
  const flush = () => { Editor.saveBuffer(); store.set('buffers', S.buffers); store.set('builders', S.builders); store.set('prefs', S.prefs); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
  initSplitters();
  initSchemaEvents();
  initDsMenu();
}

function loadEngine() {
  return new Promise((resolve, reject) => {
    if (window.initSqlJs) { resolve(); return; }
    const urls = ['https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-asm.js', 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-asm.js'];
    let k = 0;
    const next = () => {
      if (k >= urls.length) { reject(new Error('engine')); return; }
      const s = document.createElement('script');
      s.src = urls[k++];
      s.async = true;
      s.onload = () => (window.initSqlJs ? resolve() : next());
      s.onerror = () => { s.remove(); next(); };
      document.head.appendChild(s);
    };
    next();
  });
}

async function boot() {
  applyTheme();
  applyLayout();
  wire();
  try {
    await loadEngine();
    S.SQL = await window.initSqlJs();
  } catch (e) {
    $('#boot').classList.add('failed');
    $('#boot-msg').textContent = 'The SQL engine couldn’t be loaded. Check your internet connection, then reload the page.';
    return;
  }
  $('#boot-msg').textContent = 'Preparing the sample data…';
  await new Promise(r => setTimeout(r, 30));
  registerBuiltins();
  await restoreUserDbs();
  Builder.preset();
  S.mode = S.prefs.mode === 'editor' ? 'editor' : 'builder';
  setActive(S.dbs.has(S.prefs.lastDb) ? S.prefs.lastDb : 'shop');
  setMode(S.mode);
  Side.setTab(['learn', 'ref', 'hist'].includes(S.prefs.sideTab) ? S.prefs.sideTab : 'learn');
  Learn.render();
  Editor.measure();
  const bootEl = $('#boot');
  if (bootEl) bootEl.remove();
  Builder.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { Editor.measure(); Builder.refresh(); });
  Claude.init();
}
boot();
