/* ===== app-builder: drag-and-drop query canvas, column grid, generated SQL ===== */
const Builder = (() => {
  const canvas = $('#canvas'), stage = $('#stage'), svg = $('#links'), fieldsBox = $('#fields');
  let B = null;
  const blank = () => ({ tables: [], joins: [], fields: [], distinct: false, limit: '', match: 'AND', seq: 1 });
  const sch = () => active().schema;
  const tableBy = uid => B.tables.find(t => t.uid === uid);
  const fieldBy = id => B.fields.find(f => f.id === id);
  const cardEl = uid => stage.querySelector(`.card[data-uid="${uid}"]`);
  const nextId = p => p + (B.seq++);
  const save = debounce(() => store.set('builders', S.builders), 300);
  const cssEsc = s => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));

  function load() {
    if (!S.builders[S.active]) S.builders[S.active] = blank();
    B = S.builders[S.active];
    if (!B.seq) B.seq = 1;
    revalidate(true);
  }
  function revalidate(skipRun) {
    if (!B) return;
    const s = sch();
    const colOk = (uid, col) => { const t = tableBy(uid); return !!t && (col === '*' || (!!s.tables[t.name] && s.tables[t.name].columns.some(c => c.name === col))); };
    B.tables = B.tables.filter(t => s.tables[t.name]);
    B.fields = B.fields.filter(f => colOk(f.uid, f.col));
    B.joins = B.joins.filter(j => j.a.uid !== j.b.uid && colOk(j.a.uid, j.a.col) && colOk(j.b.uid, j.b.col));
    B.fields.forEach(f => { if (!f.id) f.id = nextId('f'); });
    B.joins.forEach(j => { if (!j.id) j.id = nextId('j'); });
    render();
    if (!skipRun && S.mode === 'builder') scheduleRun();
  }

  // ---------- rendering ----------
  function render() {
    if (!B) return;
    stage.querySelectorAll('.card, .jlabel').forEach(n => n.remove());
    renderEmpty();
    for (const t of B.tables) stage.append(cardNode(t));
    renderFields();
    renderOptions();
    updateSQL();
    sizeStage();
    drawLinks();
  }
  function renderEmpty() {
    const empty = $('#canvas-empty');
    empty.hidden = B.tables.length > 0;
    if (B.tables.length) return;
    const names = tableNames();
    empty.innerHTML = names.length
      ? `<div><h3>Drag a table here</h3><p>Or click one to start. Tables that belong together are joined automatically.</p><div class="chips">${names.map(n => `<button class="chip" type="button" data-add="${esc(n)}">${icon('plus', 'ic-sm')}${esc(n)}</button>`).join('')}</div></div>`
      : '<div><h3>No tables yet</h3><p>Import a file, or create a table in the SQL editor first.</p></div>';
  }
  function cardNode(t) {
    const T = sch().tables[t.name];
    const sel = new Set(B.fields.filter(f => f.uid === t.uid).map(f => f.col));
    const joined = new Set();
    B.joins.forEach(j => { if (j.a.uid === t.uid) joined.add(j.a.col); if (j.b.uid === t.uid) joined.add(j.b.col); });
    const fkCols = new Set(T.fks.map(f => f.from));
    return h(`<div class="card" data-uid="${t.uid}" style="left:${t.x}px;top:${t.y}px">
      <div class="card-h" title="Drag to move · double-click to rename">${icon('table', 'ic-sm')}<span class="card-name">${esc(t.name)}</span>${t.alias !== t.name ? `<span class="card-alias">AS ${esc(t.alias)}</span>` : ''}<button class="icon-btn" type="button" data-act="remove" aria-label="Remove ${esc(t.alias)} from the query" title="Remove">${icon('x', 'ic-sm')}</button></div>
      <div class="card-b">
        <label class="ccol star${sel.has('*') ? ' on' : ''}" data-col="*"><input type="checkbox"${sel.has('*') ? ' checked' : ''}><span class="cname">* all columns</span></label>
        ${T.columns.map(c => `<label class="ccol${sel.has(c.name) ? ' on' : ''}${joined.has(c.name) ? ' joined' : ''}" data-col="${esc(c.name)}" title="${esc((c.type || 'any type') + (c.pk ? ' · primary key' : '') + (fkCols.has(c.name) ? ' · foreign key' : ''))}"><input type="checkbox"${sel.has(c.name) ? ' checked' : ''}><span class="cname">${esc(c.name)}</span>${c.pk ? '<span class="key pk">PK</span>' : fkCols.has(c.name) ? '<span class="key fk">FK</span>' : ''}<span class="ctype">${esc(shortType(c.type))}</span><span class="dot" title="Drag onto a column of another table to join them"></span></label>`).join('')}
      </div></div>`);
  }
  function sizeStage() {
    if (!canvas.offsetParent) return;
    let w = 0, hh = 0;
    stage.querySelectorAll('.card').forEach(c => { w = Math.max(w, c.offsetLeft + c.offsetWidth); hh = Math.max(hh, c.offsetTop + c.offsetHeight); });
    stage.style.width = Math.max(canvas.clientWidth, w + 80) + 'px';
    stage.style.height = Math.max(canvas.clientHeight, hh + 60) + 'px';
  }
  function estimate(name) {
    const T = sch().tables[name];
    return { w: 220, h: 42 + ((T ? T.columns.length : 4) + 1) * 24 };
  }
  // scroll the canvas (only the canvas, never the page) so a card's top-left is in view
  function reveal(el) {
    const cr = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.right > cr.right) canvas.scrollLeft += Math.min(r.right - cr.right + 16, r.left - cr.left - 8);
    if (r.left < cr.left) canvas.scrollLeft -= cr.left - r.left + 8;
    if (r.bottom > cr.bottom) canvas.scrollTop += Math.min(r.bottom - cr.bottom + 16, r.top - cr.top - 8);
    if (r.top < cr.top) canvas.scrollTop -= cr.top - r.top + 8;
  }
  function freeSpot(size) {
    const W = Math.max(canvas.clientWidth || 640, size.w + 40);
    const rects = B.tables.map(t => { const el = cardEl(t.uid); const e2 = estimate(t.name); return { x: t.x, y: t.y, w: el ? el.offsetWidth : e2.w, h: el ? el.offsetHeight : e2.h }; });
    for (let y = 16; y < 6000; y += 20) {
      for (let x = 16; x + size.w <= W - 12 || x === 16; x += 20) {
        if (!rects.some(r => x < r.x + r.w + 44 && x + size.w + 44 > r.x && y < r.y + r.h + 24 && y + size.h + 24 > r.y)) return { x, y };
      }
    }
    return { x: 16, y: 16 };
  }

  // ---------- joins drawing ----------
  function rowPoint(uid, col, side, sr) {
    const card = cardEl(uid);
    if (!card) return null;
    const row = card.querySelector(`.ccol[data-col="${cssEsc(col)}"]`) || card.querySelector('.card-h');
    const cr = card.getBoundingClientRect(), rr = row.getBoundingClientRect();
    return { x: (side > 0 ? cr.right : cr.left) - sr.left, y: rr.top - sr.top + rr.height / 2, dir: side };
  }
  function curve(p, q) {
    const dx = Math.max(40, Math.abs(q.x - p.x) * 0.45);
    const c1x = p.x + (p.dir || 1) * dx, c2x = q.x + (q.dir == null ? -1 : q.dir) * dx;
    return { d: `M${p.x.toFixed(1)},${p.y.toFixed(1)} C${c1x.toFixed(1)},${p.y.toFixed(1)} ${c2x.toFixed(1)},${q.y.toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`, mid: { x: (p.x + 3 * c1x + 3 * c2x + q.x) / 8, y: (p.y + q.y) / 2 } };
  }
  const order = () => (S.builderQuery && S.builderQuery.order && S.builderQuery.order.length ? S.builderQuery.order : B.tables.map(t => t.uid));
  function aFirst(j) { const o = order(); return o.indexOf(j.a.uid) <= o.indexOf(j.b.uid); }
  function joinVenn(j) {
    const k = j.keep || 'match';
    if (k === 'match') return VENN(false, false, true);
    if (k === 'all') return VENN(true, true);
    const left = aFirst(j) ? 'a' : 'b';
    return VENN(k === left, k !== left);
  }
  function joinText(j) {
    const k = j.keep || 'match';
    if (k === 'a') return 'all ' + tableBy(j.a.uid).alias;
    if (k === 'b') return 'all ' + tableBy(j.b.uid).alias;
    if (k === 'all') return 'all rows';
    return 'matching';
  }
  function drawLinks() {
    if (!B || S.mode !== 'builder' || !canvas.offsetParent) return;
    stage.querySelectorAll('.jlabel').forEach(n => n.remove());
    const sr = stage.getBoundingClientRect();
    let html = '';
    for (const j of B.joins) {
      const ca = cardEl(j.a.uid), cb = cardEl(j.b.uid);
      if (!ca || !cb) continue;
      const ra = ca.getBoundingClientRect(), rb = cb.getBoundingClientRect();
      let sa = 1, sb = -1;
      if (ra.right + 24 <= rb.left) { sa = 1; sb = -1; } else if (rb.right + 24 <= ra.left) { sa = -1; sb = 1; } else { sa = 1; sb = 1; }
      const p = rowPoint(j.a.uid, j.a.col, sa, sr), q = rowPoint(j.b.uid, j.b.col, sb, sr);
      if (!p || !q) continue;
      const c = curve(p, q);
      const keptA = j.keep === 'a' || j.keep === 'all', keptB = j.keep === 'b' || j.keep === 'all';
      html += `<path class="link" d="${c.d}"/><path class="hit" data-j="${j.id}" d="${c.d}"/><circle class="end${keptA ? ' kept' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"/><circle class="end${keptB ? ' kept' : ''}" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="4"/>`;
      const A = tableBy(j.a.uid), Bt = tableBy(j.b.uid);
      stage.append(h(`<button class="jlabel" type="button" data-j="${j.id}" style="left:${c.mid.x.toFixed(1)}px;top:${c.mid.y.toFixed(1)}px" title="${esc(`${A.alias}.${j.a.col} = ${Bt.alias}.${j.b.col}`)} · click to change">${joinVenn(j)}<span>${esc(joinText(j))}</span></button>`));
    }
    svg.innerHTML = html;
  }
  let raf = 0;
  const scheduleLinks = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawLinks(); }); };
  function joinMenu(jid, anchor) {
    const j = B.joins.find(x => x.id === jid);
    if (!j) return;
    const A = tableBy(j.a.uid), Bt = tableBy(j.b.uid);
    const first = aFirst(j);
    const left = first ? 'a' : 'b';
    const kwA = first ? 'LEFT JOIN' : 'RIGHT JOIN', kwB = first ? 'RIGHT JOIN' : 'LEFT JOIN';
    const k = j.keep || 'match';
    const item = (venn, title, sub) => `${venn}<span class="mi-text"><span class="mi-title">${title}</span><span class="mi-sub">${sub}</span></span>`;
    Pop.open(anchor, [
      { html: item(VENN(false, false, true), 'Only rows that have a match', 'JOIN · also called INNER JOIN'), checked: k === 'match', run: () => setKeep(j, 'match') },
      { html: item(VENN(left === 'a', left !== 'a'), `All <b>${esc(A.alias)}</b>, matched where possible`, kwA), checked: k === 'a', run: () => setKeep(j, 'a') },
      { html: item(VENN(left === 'b', left !== 'b'), `All <b>${esc(Bt.alias)}</b>, matched where possible`, kwB), checked: k === 'b', run: () => setKeep(j, 'b') },
      { html: item(VENN(true, true), 'All rows from both', 'FULL OUTER JOIN'), checked: k === 'all', run: () => setKeep(j, 'all') },
      { sep: true },
      { html: `${icon('x', 'ic-sm')}<span>Remove this join</span>`, run: () => { B.joins = B.joins.filter(x => x !== j); render(); changed(); } },
    ]);
  }
  function setKeep(j, keep) { j.keep = keep; render(); changed(); }

  // ---------- model changes ----------
  function addTable(name, pos, opts) {
    opts = opts || {};
    const T = sch().tables[name];
    if (!T) return null;
    const same = B.tables.filter(t => t.name === name);
    let alias = name;
    if (same.length) {
      const selfFk = T.fks.find(f => f.table === name);
      const base = selfFk && /_id$/i.test(selfFk.from) ? selfFk.from.replace(/_id$/i, '') : `${name}_${same.length + 1}`;
      alias = base;
      let n = 2;
      while (B.tables.some(t => t.alias.toLowerCase() === alias.toLowerCase()) || sch().tables[alias]) alias = `${base}_${n++}`;
    }
    const size = estimate(name);
    const p = pos ? { x: Math.max(6, Math.round(pos.x)), y: Math.max(6, Math.round(pos.y)) } : freeSpot(size);
    const t = { uid: nextId('t'), name, alias, x: p.x, y: p.y };
    B.tables.push(t);
    const made = autoJoin(t);
    if (!opts.defer) {
      render(); changed();
      if (made.length && !opts.quiet) toast(`Joined automatically: ${made.map(s => `<code>${esc(s)}</code>`).join(', ')}`, { icon: 'link' });
      requestAnimationFrame(() => { const el = cardEl(t.uid); if (el) reveal(el); });
    }
    return t;
  }
  function autoJoin(t) {
    const s = sch();
    const made = [];
    const linked = (a, b) => B.joins.some(j => (j.a.uid === a && j.b.uid === b) || (j.a.uid === b && j.b.uid === a));
    const T = s.tables[t.name];
    for (const fk of T.fks) {
      const target = B.tables.find(o => o.uid !== t.uid && o.name === fk.table && !linked(t.uid, o.uid));
      if (!target) continue;
      if (fk.table === t.name) {
        B.joins.push({ id: nextId('j'), a: { uid: target.uid, col: fk.from }, b: { uid: t.uid, col: fk.to }, keep: 'a' });
        made.push(`${target.alias}.${fk.from} = ${t.alias}.${fk.to}`);
      } else {
        B.joins.push({ id: nextId('j'), a: { uid: t.uid, col: fk.from }, b: { uid: target.uid, col: fk.to }, keep: 'match' });
        made.push(`${t.alias}.${fk.from} = ${target.alias}.${fk.to}`);
      }
    }
    // connect to at most one copy of each table, so a second "employees" doesn't get joined twice
    const linkedNames = new Set(B.joins.filter(j => j.a.uid === t.uid || j.b.uid === t.uid).map(j => tableBy(j.a.uid === t.uid ? j.b.uid : j.a.uid).name));
    for (const o of B.tables) {
      if (o.uid === t.uid || o.name === t.name || linked(o.uid, t.uid) || linkedNames.has(o.name)) continue;
      const fk = s.tables[o.name].fks.find(f => f.table === t.name);
      if (!fk) continue;
      B.joins.push({ id: nextId('j'), a: { uid: o.uid, col: fk.from }, b: { uid: t.uid, col: fk.to }, keep: 'match' });
      made.push(`${o.alias}.${fk.from} = ${t.alias}.${fk.to}`);
      linkedNames.add(o.name);
    }
    return made;
  }
  function removeTable(uid) {
    B.tables = B.tables.filter(t => t.uid !== uid);
    B.fields = B.fields.filter(f => f.uid !== uid);
    B.joins = B.joins.filter(j => j.a.uid !== uid && j.b.uid !== uid);
    render(); changed();
  }
  const newField = (uid, col) => ({ id: nextId('f'), uid, col, show: true, agg: '', sort: '', op: '', val: '', val2: '', alias: '' });
  function addField(tableName, col, pos) {
    let t = B.tables.find(x => x.name === tableName);
    if (!t) t = addTable(tableName, pos);
    if (!t) return;
    if (B.fields.some(f => f.uid === t.uid && f.col === col)) {
      const row = fieldsBox.querySelector(`.frow[data-f="${B.fields.find(f => f.uid === t.uid && f.col === col).id}"]`);
      if (row) { row.scrollIntoView({ block: 'nearest' }); row.classList.add('pop-in'); setTimeout(() => row.classList.remove('pop-in'), 500); }
      return;
    }
    B.fields.push(newField(t.uid, col));
    render(); changed();
  }
  function toggleField(uid, col, on) {
    if (on) { if (!B.fields.some(f => f.uid === uid && f.col === col)) B.fields.push(newField(uid, col)); }
    else B.fields = B.fields.filter(f => !(f.uid === uid && f.col === col));
    render(); changed();
  }
  function addJoin(a, b) {
    if (B.joins.some(j => (j.a.uid === a.uid && j.a.col === a.col && j.b.uid === b.uid && j.b.col === b.col) || (j.a.uid === b.uid && j.a.col === b.col && j.b.uid === a.uid && j.b.col === a.col))) { toast('These columns are already joined.'); return; }
    B.joins.push({ id: nextId('j'), a, b, keep: 'match' });
    render(); changed();
    toast(`Joined <code>${esc(tableBy(a.uid).alias)}.${esc(a.col)}</code> = <code>${esc(tableBy(b.uid).alias)}.${esc(b.col)}</code>. Click the label on the line to change the join type.`, { icon: 'link' });
  }
  function addAll() {
    const have = new Set(B.tables.map(t => t.name));
    const names = tableNames().filter(n => !have.has(n) && sch().tables[n].type === 'table');
    if (!names.length) { toast('Every table is already on the canvas.'); return; }
    names.forEach(n => addTable(n, null, { defer: true }));
    render(); changed();
    toast(`Added ${names.length} ${names.length === 1 ? 'table' : 'tables'}. The lines show how they are related.`, { icon: 'link' });
  }
  function clearAll() {
    if (!B.tables.length) return;
    const target = B;
    const snap = JSON.stringify(B);
    Object.assign(B, blank(), { seq: B.seq });
    render(); changed();
    toast('Cleared the builder.', { action: { label: 'Undo', run: () => { Object.assign(target, JSON.parse(snap)); if (target === B) { render(); changed(); } else save(); } } });
  }
  function rename(uid) {
    const t = tableBy(uid);
    const card = cardEl(uid);
    if (!t || !card) return;
    const head = card.querySelector('.card-h');
    const input = h(`<input type="text" value="${esc(t.alias)}" aria-label="Name for this table in the query" spellcheck="false">`);
    head.querySelector('.card-name').replaceWith(input);
    const al = head.querySelector('.card-alias');
    if (al) al.remove();
    input.focus(); input.select();
    let done = false;
    const finish = ok => {
      if (done) return;
      done = true;
      if (ok) {
        const v = input.value.trim() || t.name;
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) toast('Use letters, digits and _ only, and start with a letter.');
        else if (B.tables.some(o => o !== t && o.alias.toLowerCase() === v.toLowerCase())) toast('Another table on the canvas already uses that name.');
        else if (v !== t.name && sch().tables[v]) toast('That name belongs to a real table. Pick a different alias.');
        else t.alias = v;
      }
      render(); changed();
    };
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('pointerdown', e => e.stopPropagation());
  }

  // ---------- columns grid ----------
  const OPS_NEED = op => op && op !== 'null' && op !== 'notnull';
  function aliasHint(f) {
    if (f.agg) return f.col === '*' ? 'row_count' : `${{ COUNT: 'count', COUNT_DISTINCT: 'count_distinct', SUM: 'sum', AVG: 'avg', MIN: 'min', MAX: 'max' }[f.agg]}_${f.col}`;
    return 'rename…';
  }
  function placeholder(op, cls) {
    if (op === 'in') return cls === 'num' ? '1, 2, 3' : 'a, b, c';
    if (op === 'between') return cls === 'date' ? '2026-01-01' : 'from';
    if (op === 'contains' || op === 'starts' || op === 'ends') return 'text';
    return cls === 'num' ? '0' : cls === 'date' ? 'YYYY-MM-DD' : cls === 'bool' ? '1 or 0' : 'value';
  }
  function fieldRow(f, multi) {
    const t = tableBy(f.uid);
    const T = sch().tables[t.name];
    const c = f.col === '*' ? null : T.columns.find(x => x.name === f.col);
    const cls = c ? QL.typeClass(c.type) : 'num';
    const aggs = f.col === '*' ? [['', 'no summary'], ['COUNT', 'COUNT rows']]
      : [['', 'no summary'], ['COUNT', 'COUNT'], ['COUNT_DISTINCT', 'COUNT different'], ...(cls === 'num' || cls === 'bool' ? [['SUM', 'SUM'], ['AVG', 'AVG']] : []), ['MIN', 'MIN'], ['MAX', 'MAX']];
    const starPlain = f.col === '*' && !f.agg;
    const opts = (list, cur) => list.map(([v, l]) => `<option value="${v}"${(cur || '') === v ? ' selected' : ''}>${l}</option>`).join('');
    const name = `${multi ? `<span class="ftable">${esc(t.alias)}.</span>` : ''}${f.col === '*' ? '*' : esc(f.col)}`;
    return `<div class="frow${f.show === false ? ' hidden-field' : ''}" data-f="${f.id}">
      <span class="fgrip" draggable="true" title="Drag to reorder">${icon('grip', 'ic-sm')}</span>
      <span class="fname" title="${esc(t.alias + '.' + f.col)}">${name}</span>
      <input type="checkbox" data-k="show"${f.show !== false ? ' checked' : ''} aria-label="Show ${esc(f.col)} in the result" title="Show in the result">
      <select data-k="agg" aria-label="Summary for ${esc(f.col)}">${opts(aggs, f.agg)}</select>
      <select data-k="sort" aria-label="Sort by ${esc(f.col)}"${starPlain ? ' disabled' : ''}>${opts([['', 'no sort'], ['ASC', '↑ A→Z, 0→9'], ['DESC', '↓ Z→A, 9→0']], f.sort)}</select>
      <span class="ffilter">${starPlain ? '<span class="muted" style="font-size:12px">use COUNT to filter</span>' : `<select data-k="op" aria-label="Filter on ${esc(f.col)}">${opts([['', 'no filter'], ...QL.OPS], f.op)}</select>${OPS_NEED(f.op) ? `<input type="text" data-k="val" value="${esc(f.val || '')}" placeholder="${placeholder(f.op, cls)}" aria-label="Filter value">` : ''}${f.op === 'between' ? `<input type="text" data-k="val2" value="${esc(f.val2 || '')}" placeholder="to" aria-label="Second filter value">` : ''}`}</span>
      <input type="text" data-k="alias" value="${esc(f.alias || '')}" placeholder="${esc(aliasHint(f))}" aria-label="Column name in the result"${f.show === false ? ' disabled' : ''} spellcheck="false">
      <button class="icon-btn x" type="button" data-act="del" aria-label="Remove ${esc(f.col)}" title="Remove">${icon('x', 'ic-sm')}</button>
    </div>`;
  }
  function renderFields() {
    if (!B.fields.length) {
      fieldsBox.innerHTML = `<div class="fields-empty">${B.tables.length ? 'Tick columns in the tables above. Each one shows up here, where you can filter, sort and summarize it.' : 'The columns you pick appear here. Then you can filter, sort and summarize them.'}</div>`;
      return;
    }
    const multi = B.tables.length > 1;
    fieldsBox.innerHTML = `<div class="frow fhead"><span></span><span>Column</span><span title="Show in the result">Show</span><span>Summary</span><span>Sort</span><span>Filter</span><span>Name in result</span><span></span></div>${B.fields.map(f => fieldRow(f, multi)).join('')}`;
  }
  function renderOptions() {
    $('#b-distinct').checked = !!B.distinct;
    $('#b-limit').value = B.limit || '';
    $('#b-match').value = B.match === 'OR' ? 'OR' : 'AND';
  }
  function updateSQL() {
    const q = QL.buildQuery(B, sch());
    S.builderQuery = q;
    $('#bsql').innerHTML = q.sql ? QL.highlight(q.sql, tableSet()) : '<span class="c">-- Add a table to get started</span>';
    $('#bexplain').innerHTML = q.valid ? `<ul>${q.english.map(x => `<li>${x}</li>`).join('')}</ul>${q.warnings.map(w => `<div class="warn">${w}</div>`).join('')}${q.notes.map(n => `<div class="note">${n}</div>`).join('')}` : '';
  }
  const runSoon = debounce(() => {
    if (S.mode !== 'builder') return;
    const q = S.builderQuery;
    if (q && q.valid) Results.run(q.sql, { source: 'builder', noHistory: true, quiet: true });
    else Results.clear();
  }, 220);
  function scheduleRun() { runSoon(); }
  function changed() { updateSQL(); save(); scheduleRun(); Learn.updateStrip(); }

  // ---------- events: canvas ----------
  canvas.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { addTable(add.dataset.add); return; }
    const rm = e.target.closest('[data-act="remove"]');
    if (rm) { removeTable(rm.closest('.card').dataset.uid); return; }
    const lab = e.target.closest('.jlabel');
    if (lab) { joinMenu(lab.dataset.j, lab); return; }
    if (e.target.closest('.dot')) e.preventDefault();
  });
  svg.addEventListener('click', e => {
    const hit = e.target.closest('.hit');
    if (hit) joinMenu(hit.dataset.j, { x: e.clientX, y: e.clientY });
  });
  canvas.addEventListener('change', e => {
    const inp = e.target.closest('.ccol input');
    if (!inp) return;
    toggleField(inp.closest('.card').dataset.uid, inp.closest('.ccol').dataset.col, inp.checked);
  });
  canvas.addEventListener('dblclick', e => {
    const head = e.target.closest('.card-h');
    if (head && !e.target.closest('button, input')) rename(head.closest('.card').dataset.uid);
  });
  canvas.addEventListener('pointerdown', e => {
    const dot = e.target.closest('.dot');
    if (dot) { startLink(e, dot); return; }
    const head = e.target.closest('.card-h');
    if (!head || e.target.closest('button, input') || e.button > 0) return;
    const card = head.closest('.card');
    const t = tableBy(card.dataset.uid);
    if (!t) return;
    e.preventDefault();
    head.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY, ox = t.x, oy = t.y;
    let moved = false, scrollTimer = null, lastEv = e;
    card.classList.add('dragging');
    const edgeScroll = () => {
      const r = canvas.getBoundingClientRect();
      let dx = 0, dy = 0;
      if (lastEv.clientX > r.right - 28) dx = 12; else if (lastEv.clientX < r.left + 28) dx = -12;
      if (lastEv.clientY > r.bottom - 28) dy = 12; else if (lastEv.clientY < r.top + 28) dy = -12;
      if (dx || dy) { stage.style.width = Math.max(stage.offsetWidth, t.x + card.offsetWidth + 80) + 'px'; stage.style.height = Math.max(stage.offsetHeight, t.y + card.offsetHeight + 80) + 'px'; canvas.scrollBy(dx, dy); }
    };
    const move = ev => {
      lastEv = ev;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      t.x = Math.max(4, Math.round(ox + dx + (canvas.scrollLeft - startScroll.x)));
      t.y = Math.max(4, Math.round(oy + dy + (canvas.scrollTop - startScroll.y)));
      card.style.left = t.x + 'px';
      card.style.top = t.y + 'px';
      scheduleLinks();
      if (!scrollTimer) scrollTimer = setInterval(edgeScroll, 30);
    };
    const startScroll = { x: canvas.scrollLeft, y: canvas.scrollTop };
    const up = () => {
      clearInterval(scrollTimer);
      card.classList.remove('dragging');
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      head.removeEventListener('pointercancel', up);
      if (moved) { sizeStage(); drawLinks(); save(); }
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
  });
  function startLink(e, dot) {
    e.preventDefault();
    e.stopPropagation();
    const row = dot.closest('.ccol'), card = dot.closest('.card');
    const from = { uid: card.dataset.uid, col: row.dataset.col };
    if (from.col === '*') return;
    dot.setPointerCapture(e.pointerId);
    canvas.classList.add('linking');
    const sr0 = stage.getBoundingClientRect();
    const start = rowPoint(from.uid, from.col, 1, sr0);
    const temp = document.createElementNS(SVGNS, 'path');
    temp.setAttribute('class', 'link temp');
    svg.append(temp);
    let target = null;
    const move = ev => {
      const sr = stage.getBoundingClientRect();
      const p = { x: start.x + (sr0.left - sr.left), y: start.y + (sr0.top - sr.top), dir: 1 };
      const q = { x: ev.clientX - sr.left, y: ev.clientY - sr.top, dir: -1 };
      temp.setAttribute('d', curve(p, q).d);
      stage.querySelectorAll('.ccol.drop-target').forEach(n => n.classList.remove('drop-target'));
      target = null;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const r2 = el && el.closest('.ccol');
      if (r2 && r2.dataset.col !== '*') {
        const c2 = r2.closest('.card');
        if (c2 && c2.dataset.uid !== from.uid) { target = { uid: c2.dataset.uid, col: r2.dataset.col }; r2.classList.add('drop-target'); }
      }
    };
    const up = () => {
      dot.removeEventListener('pointermove', move);
      dot.removeEventListener('pointerup', up);
      dot.removeEventListener('pointercancel', up);
      temp.remove();
      canvas.classList.remove('linking');
      stage.querySelectorAll('.ccol.drop-target').forEach(n => n.classList.remove('drop-target'));
      if (target) addJoin(from, target);
    };
    dot.addEventListener('pointermove', move);
    dot.addEventListener('pointerup', up);
    dot.addEventListener('pointercancel', up);
  }
  // drops from the tables panel
  canvas.addEventListener('dragover', e => {
    if (!S.dragPayload) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'copy'; } catch (err) { /* ignore */ }
    canvas.classList.add('drop-on');
  });
  canvas.addEventListener('dragleave', e => { if (!canvas.contains(e.relatedTarget)) canvas.classList.remove('drop-on'); });
  canvas.addEventListener('drop', e => {
    canvas.classList.remove('drop-on');
    const p = S.dragPayload;
    if (!p) return;
    e.preventDefault();
    const sr = stage.getBoundingClientRect();
    const pos = { x: e.clientX - sr.left - 100, y: e.clientY - sr.top - 16 };
    if (p.col) addField(p.table, p.col, pos); else addTable(p.table, pos);
    S.dragPayload = null;
  });
  canvas.addEventListener('scroll', () => { /* links live in stage coordinates; nothing to do */ });

  // ---------- events: columns grid & options ----------
  fieldsBox.addEventListener('change', e => {
    const el = e.target;
    const row = el.closest('.frow');
    if (!row || !el.dataset.k) return;
    const f = fieldBy(row.dataset.f);
    if (!f) return;
    const k = el.dataset.k;
    if (k === 'show') f.show = el.checked;
    else if (k === 'val' || k === 'val2' || k === 'alias') return;
    else f[k] = el.value;
    if (k === 'agg' && f.col === '*' && !f.agg) { f.op = ''; f.sort = ''; }
    renderFields();
    const again = fieldsBox.querySelector(`.frow[data-f="${f.id}"] [data-k="${k}"]`);
    if (again) again.focus();
    if (k === 'op' && OPS_NEED(f.op)) { const v = fieldsBox.querySelector(`.frow[data-f="${f.id}"] [data-k="val"]`); if (v) v.focus(); }
    changed();
  });
  fieldsBox.addEventListener('input', e => {
    const el = e.target;
    const row = el.closest('.frow');
    if (!row || !['val', 'val2', 'alias'].includes(el.dataset.k)) return;
    const f = fieldBy(row.dataset.f);
    if (!f) return;
    f[el.dataset.k] = el.value;
    changed();
  });
  fieldsBox.addEventListener('click', e => {
    const del = e.target.closest('[data-act="del"]');
    if (!del) return;
    const id = del.closest('.frow').dataset.f;
    B.fields = B.fields.filter(f => f.id !== id);
    render(); changed();
  });
  fieldsBox.addEventListener('focusin', e => {
    const inp = e.target.closest('input[data-k="val"], input[data-k="val2"]');
    if (!inp) return;
    const f = fieldBy(inp.closest('.frow').dataset.f);
    if (!f || f.col === '*' || f.agg) return;
    const t = tableBy(f.uid);
    const id = 'dl-' + S.active.replace(/\W/g, '') + '-' + f.id;
    let dl = document.getElementById(id);
    if (!dl) { dl = document.createElement('datalist'); dl.id = id; document.body.append(dl); }
    try {
      const r = active().db.exec(`SELECT DISTINCT ${qi(f.col)} FROM ${qi(t.name)} WHERE ${qi(f.col)} IS NOT NULL ORDER BY 1 LIMIT 80`);
      dl.innerHTML = r.length ? r[0].values.map(v => `<option value="${esc(String(v[0]))}"></option>`).join('') : '';
    } catch (err) { dl.innerHTML = ''; }
    inp.setAttribute('list', id);
  });
  let dragField = null;
  fieldsBox.addEventListener('dragstart', e => {
    const grip = e.target.closest('.fgrip');
    if (!grip) return;
    dragField = grip.closest('.frow').dataset.f;
    S.dragPayload = null;
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); e.dataTransfer.setDragImage(grip.closest('.frow'), 12, 14); } catch (err) { /* ignore */ }
  });
  fieldsBox.addEventListener('dragover', e => {
    if (S.dragPayload && S.dragPayload.col) { e.preventDefault(); return; }
    if (!dragField) return;
    const row = e.target.closest('.frow:not(.fhead)');
    fieldsBox.querySelectorAll('.drop-before, .drop-after').forEach(n => n.classList.remove('drop-before', 'drop-after'));
    if (!row) return;
    e.preventDefault();
    const r = row.getBoundingClientRect();
    row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  fieldsBox.addEventListener('drop', e => {
    if (S.dragPayload && S.dragPayload.col) { e.preventDefault(); addField(S.dragPayload.table, S.dragPayload.col); S.dragPayload = null; return; }
    if (!dragField) return;
    e.preventDefault();
    const row = e.target.closest('.frow:not(.fhead)');
    const from = B.fields.findIndex(f => f.id === dragField);
    if (row && from >= 0 && row.dataset.f !== dragField) {
      const [moved] = B.fields.splice(from, 1);
      let to = B.fields.findIndex(f => f.id === row.dataset.f);
      if (row.classList.contains('drop-after')) to += 1;
      B.fields.splice(to, 0, moved);
      renderFields(); changed();
    }
    dragField = null;
  });
  fieldsBox.addEventListener('dragend', () => { dragField = null; fieldsBox.querySelectorAll('.drop-before, .drop-after').forEach(n => n.classList.remove('drop-before', 'drop-after')); });
  $('#b-distinct').addEventListener('change', e => { B.distinct = e.target.checked; changed(); });
  $('#b-limit').addEventListener('input', e => { B.limit = e.target.value; changed(); });
  $('#b-match').addEventListener('change', e => { B.match = e.target.value; changed(); });
  $('#b-copy').addEventListener('click', () => { if (S.builderQuery && S.builderQuery.sql) copyText(S.builderQuery.sql, 'SQL copied'); });
  $('#b-edit').addEventListener('click', () => {
    if (!S.builderQuery || !S.builderQuery.sql) { toast('Add a table first.'); return; }
    const sql = S.builderQuery.sql;
    setMode('editor');
    Editor.replaceAll(sql);
    toast('The query is in the SQL editor now. The builder keeps its own copy.', { icon: 'code' });
  });
  window.addEventListener('resize', debounce(() => { sizeStage(); drawLinks(); }, 120));

  function preset() {
    if (S.builders.shop) return;
    S.builders.shop = { tables: [{ uid: 't1', name: 'customers', alias: 'customers', x: 24, y: 20 }, { uid: 't2', name: 'orders', alias: 'orders', x: 330, y: 52 }],
      joins: [{ id: 'j3', a: { uid: 't2', col: 'customer_id' }, b: { uid: 't1', col: 'id' }, keep: 'match' }],
      fields: [
        { id: 'f4', uid: 't1', col: 'first_name', show: true, agg: '', sort: '', op: '', val: '', val2: '', alias: '' },
        { id: 'f5', uid: 't1', col: 'last_name', show: true, agg: '', sort: '', op: '', val: '', val2: '', alias: '' },
        { id: 'f6', uid: 't1', col: 'city', show: true, agg: '', sort: '', op: '', val: '', val2: '', alias: '' },
        { id: 'f7', uid: 't2', col: 'id', show: true, agg: 'COUNT', sort: 'DESC', op: '', val: '', val2: '', alias: 'orders' },
        { id: 'f8', uid: 't1', col: 'country', show: false, agg: '', sort: '', op: '=', val: 'Germany', val2: '', alias: '' },
      ], distinct: false, limit: '10', match: 'AND', seq: 9 };
  }

  return { load, revalidate, render, addTable, addField, addAll, clearAll, drawLinks, scheduleRun, refresh: () => { sizeStage(); drawLinks(); }, preset, current: () => B };
})();
