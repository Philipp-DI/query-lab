/* ===== app-editor: SQL editor with highlighting, autocomplete, drop targets and snippets ===== */
const Editor = (() => {
  const ta = $('#ed-ta'), hl = $('#ed-hl'), gutter = $('#ed-gutter'), main = $('#ed-main'), ac = $('#ac'), caret = $('#ed-dropcaret'), ed = $('#ed');
  let key = null;
  let suppressAC = false;
  let AC = null;
  const M = { cw: 7.8, lh: 21, pl: 14, pt: 12 };
  const saveBuffers = debounce(() => store.set('buffers', S.buffers), 400);

  function measure() {
    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:13px/21px var(--f-mono);left:0;top:0';
    span.textContent = 'M'.repeat(100);
    main.append(span);
    const w = span.getBoundingClientRect().width;
    span.remove();
    if (w > 0) M.cw = w / 100;
    const cs = getComputedStyle(ta);
    M.pl = parseFloat(cs.paddingLeft) || 14;
    M.pt = parseFloat(cs.paddingTop) || 12;
    M.lh = parseFloat(cs.lineHeight) || 21;
  }
  function refresh() {
    const v = ta.value;
    hl.innerHTML = QL.highlight(v, tableSet()) + '\n';
    const lines = v.split('\n').length;
    if (+gutter.dataset.n !== lines) {
      let s = '';
      for (let i = 1; i <= lines; i++) s += i + '\n';
      gutter.textContent = s;
      gutter.dataset.n = lines;
    }
    sync();
    status();
  }
  function sync() { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; }
  function status() {
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos).split('\n');
    const sel = ta.selectionEnd - ta.selectionStart;
    $('#ed-status').innerHTML = `<span>Line ${before.length}, column ${before[before.length - 1].length + 1}${sel ? ` · ${sel} selected` : ''}</span><span class="sep"></span><span><kbd>${MOD}</kbd> + <kbd>Enter</kbd> runs ${sel ? 'the selection' : 'everything'}</span><span><kbd>Ctrl</kbd> + <kbd>Space</kbd> suggests</span>`;
  }

  // ---------- buffers ----------
  function defaultFor(k) {
    if (k === 'ds:shop') return `-- Welcome to Query Lab. This is a real SQLite database running in your browser.\n-- Run the query with ${MOD}+Enter or the Run button, then change it and run it again.\nSELECT first_name, last_name, city\nFROM customers\nWHERE country = 'Germany'\nORDER BY last_name\nLIMIT 10;\n`;
    if (k === 'ds:mine') return `-- My database: your own tables, kept in this browser.\n-- Import a CSV, JSON, SQL or SQLite file with “Import data”, or create a table here:\nCREATE TABLE IF NOT EXISTS notes (\n  id      INTEGER PRIMARY KEY,\n  text    TEXT NOT NULL,\n  created DATE DEFAULT CURRENT_DATE\n);\n\nINSERT INTO notes (text) VALUES ('My first row');\n\nSELECT * FROM notes;\n`;
    if (k.startsWith('ds:')) {
      const e = S.dbs.get(k.slice(3));
      const first = e && e.schema && e.schema.order[0];
      return `-- ${e ? e.name : 'Database'}${e && e.blurb ? ': ' + e.blurb : ''}\nSELECT *\nFROM ${first ? qi(first) : 'my_table'}\nLIMIT 20;\n`;
    }
    return '';
  }
  function setContext(k, fallback) {
    if (key) S.buffers[key] = ta.value;
    key = k;
    ta.value = S.buffers[k] != null ? S.buffers[k] : (fallback != null ? fallback : defaultFor(k));
    acClose();
    refresh();
    saveBuffers();
  }
  function saveBuffer() { if (key) { S.buffers[key] = ta.value; saveBuffers(); } }

  // ---------- inserting text (keeps undo where the browser supports it) ----------
  function insertText(text, start, end) {
    if (start == null) start = ta.selectionStart;
    if (end == null) end = ta.selectionEnd;
    suppressAC = true;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(start, end);
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) { ta.setRangeText(text, start, end, 'end'); }
    suppressAC = false;
    refresh();
    saveBuffer();
  }
  function insertSmart(text) {
    if (S.mode !== 'editor') setMode('editor');
    const pos = ta.selectionStart, end = ta.selectionEnd, v = ta.value;
    const prev = v[pos - 1] || '', next = v[end] || '';
    let s = text;
    if (prev && /[\w)'",]/.test(prev)) s = ' ' + s;
    if (next && /[\w(]/.test(next)) s += ' ';
    insertText(s, pos, end);
  }
  function insertBlock(text, select) {
    if (S.mode !== 'editor') setMode('editor');
    const v = ta.value;
    let pos = ta.selectionStart;
    const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
    const lineText = v.slice(lineStart, v.indexOf('\n', pos) < 0 ? v.length : v.indexOf('\n', pos));
    let prefix = '';
    if (lineText.trim()) { pos = v.indexOf('\n', pos) < 0 ? v.length : v.indexOf('\n', pos); prefix = '\n\n'; }
    else if (lineStart > 0 && v[lineStart - 2] !== '\n' && v.slice(0, lineStart).trim()) prefix = '\n';
    insertText(prefix + text, pos, pos);
    if (select) { const s = pos + prefix.length; ta.setSelectionRange(s, s + text.length); status(); }
  }
  function appendBlock(text) {
    if (S.mode !== 'editor') setMode('editor');
    const v = ta.value.replace(/\s+$/, '');
    const start = v.length;
    const prefix = v ? '\n\n' : '';
    insertText(prefix + text + '\n', start, ta.value.length);
    ta.setSelectionRange(start + prefix.length, start + prefix.length + text.length);
    ta.scrollTop = ta.scrollHeight;
    sync(); status();
  }
  function replaceAll(text) { insertText(text, 0, ta.value.length); ta.setSelectionRange(text.length, text.length); ta.scrollTop = 0; sync(); }
  function needsQualify() { return /\bJOIN\b/i.test(ta.value) || QL.tablesIn(ta.value, tableNames()).length > 1; }

  // ---------- caret geometry (monospace, no wrapping) ----------
  function caretXY(pos) {
    const lines = ta.value.slice(0, pos).split('\n');
    const col = lines[lines.length - 1].replace(/\t/g, '  ').length;
    return { x: M.pl + col * M.cw - ta.scrollLeft, y: M.pt + (lines.length - 1) * M.lh - ta.scrollTop };
  }
  function posFromPoint(cx, cy) {
    const r = ta.getBoundingClientRect();
    const lines = ta.value.split('\n');
    const line = clamp(Math.floor((cy - r.top - M.pt + ta.scrollTop) / M.lh), 0, lines.length - 1);
    const col = clamp(Math.round((cx - r.left - M.pl + ta.scrollLeft) / M.cw), 0, lines[line].length);
    let pos = 0;
    for (let i = 0; i < line; i++) pos += lines[i].length + 1;
    return pos + col;
  }

  // ---------- autocomplete ----------
  const KIND = { col: 'col', table: 'tbl', kw: 'key', fn: 'fn' };
  function inCodeContext(before) {
    let q = false, dq = false;
    for (let i = 0; i < before.length; i++) {
      const c = before[i];
      if (!dq && c === "'") q = !q;
      else if (!q && c === '"') dq = !dq;
      else if (!q && !dq && c === '-' && before[i + 1] === '-') { const nl = before.indexOf('\n', i); if (nl < 0) return false; i = nl; }
    }
    return !q && !dq;
  }
  function acUpdate(force) {
    if (suppressAC) return;
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) return acClose();
    const v = ta.value;
    const before = v.slice(0, pos);
    if (!inCodeContext(before)) return acClose();
    const sch = active().schema;
    const names = sch.order;
    let items = [], prefix = '', start = pos;
    let m = /([A-Za-z_][\w$]*)\.([\w$]*)$/.exec(before);
    const dotted = !!m;
    if (m) {
      const map = QL.aliases(v, names);
      const table = map[m[1].toLowerCase()] || names.find(t => t.toLowerCase() === m[1].toLowerCase());
      if (!table) return acClose();
      prefix = m[2];
      start = pos - prefix.length;
      items = sch.tables[table].columns.map(c => ({ label: c.name, kind: 'col', detail: shortType(c.type), insert: qi(c.name) }));
    } else {
      m = /[A-Za-z_][\w$]*$/.exec(before);
      prefix = m ? m[0] : '';
      if (!prefix && !force) return acClose();
      if (prefix && /\d/.test(before[pos - prefix.length - 1] || '')) return acClose();
      start = pos - prefix.length;
      const pw = (/([A-Za-z]+)\s+$/.exec(before.slice(0, start)) || [])[1];
      const PW = pw ? pw.toUpperCase() : '';
      const used = QL.tablesIn(v, names);
      const tablesIt = names.map(t => ({ label: t, kind: 'table', detail: sch.tables[t].count != null ? `${fmtNum(sch.tables[t].count)} rows` : sch.tables[t].type, insert: qi(t) }));
      const seen = new Map();
      for (const t of (used.length ? used : names)) for (const c of sch.tables[t].columns) {
        if (!seen.has(c.name)) seen.set(c.name, { label: c.name, kind: 'col', detail: t, insert: qi(c.name) });
        else if (!seen.get(c.name).detail.includes('…')) seen.get(c.name).detail += ', …';
      }
      const cols = [...seen.values()];
      const kws = QL.AC_KEYWORDS.map(k => ({ label: k, kind: 'kw', insert: k }));
      const fns = [...QL.FUNCTIONS].map(f => ({ label: f + '()', kind: 'fn', insert: f + '()', back: 1 }));
      if (['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE', 'EXISTS'].includes(PW)) items = [...tablesIt, ...kws];
      else if (['SELECT', 'WHERE', 'BY', 'AND', 'OR', 'ON', 'SET', 'HAVING', 'DISTINCT'].includes(PW)) items = [...cols, ...fns, ...tablesIt, ...kws];
      else items = [...kws, ...cols, ...tablesIt, ...fns];
    }
    const p = prefix.toLowerCase();
    let list = items.filter(it => it.label.toLowerCase().startsWith(p));
    if (p.length >= 2) list = list.concat(items.filter(it => !it.label.toLowerCase().startsWith(p) && it.label.toLowerCase().includes(p)));
    if (!list.length || (list.length === 1 && list[0].label.toLowerCase() === p)) return acClose();
    if (!force && !dotted && p.length < 1) return acClose();
    AC = { list: list.slice(0, 60), i: 0, start, end: pos };
    ac.innerHTML = AC.list.map((it, i) => `<div class="ac-item" role="option" id="ac-${i}" data-i="${i}" aria-selected="${i === 0}"><span class="ac-kind ${it.kind}">${KIND[it.kind]}</span><span class="ac-label">${esc(it.label)}</span>${it.detail ? `<span class="ac-detail">${esc(it.detail)}</span>` : ''}</div>`).join('');
    ac.hidden = false;
    ta.setAttribute('aria-activedescendant', 'ac-0');
    const xy = caretXY(start);
    const mw = main.clientWidth, mh = main.clientHeight;
    const w = ac.offsetWidth, hh = ac.offsetHeight;
    let left = clamp(xy.x, 4, Math.max(4, mw - w - 4));
    let top = xy.y + M.lh + 2;
    if (top + hh > mh - 4 && xy.y - hh - 2 > 0) top = xy.y - hh - 2;
    ac.style.left = left + 'px';
    ac.style.top = top + 'px';
  }
  function acClose() { if (AC) { AC = null; ac.hidden = true; ta.removeAttribute('aria-activedescendant'); } }
  function acMove(d) {
    if (!AC) return;
    AC.i = (AC.i + d + AC.list.length) % AC.list.length;
    $$('.ac-item', ac).forEach((el, i) => el.setAttribute('aria-selected', i === AC.i));
    const el = ac.querySelector(`[data-i="${AC.i}"]`);
    if (el) { el.scrollIntoView({ block: 'nearest' }); ta.setAttribute('aria-activedescendant', el.id); }
  }
  function acAccept(i) {
    if (!AC) return;
    const it = AC.list[i == null ? AC.i : i];
    const { start, end } = AC;
    acClose();
    insertText(it.insert, start, end);
    if (it.back) { const p = ta.selectionStart - it.back; ta.setSelectionRange(p, p); }
  }
  ac.addEventListener('mousedown', e => { e.preventDefault(); const it = e.target.closest('[data-i]'); if (it) acAccept(+it.dataset.i); });

  // ---------- keys ----------
  ta.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') { e.preventDefault(); acClose(); runCurrent(); return; }
    if (e.ctrlKey && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); acUpdate(true); return; }
    if (mod && e.key === '/') { e.preventDefault(); toggleComment(); return; }
    if (AC) {
      if (e.key === 'ArrowDown') { e.preventDefault(); acMove(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); acMove(-1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acAccept(); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); acClose(); return; }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
      if (s === en && !e.shiftKey) { insertText('  ', s, en); return; }
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const block = v.slice(ls, en);
      const out = e.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ');
      insertText(out, ls, en);
      ta.setSelectionRange(ls, ls + out.length);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const s = ta.selectionStart, v = ta.value;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const indent = (/^[ \t]*/.exec(v.slice(ls, s)) || [''])[0];
      if (indent) { e.preventDefault(); insertText('\n' + indent); }
    }
  });
  function toggleComment() {
    const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let le = v.indexOf('\n', en > s && v[en - 1] === '\n' ? en - 1 : en);
    if (le < 0) le = v.length;
    const block = v.slice(ls, le);
    const lines = block.split('\n');
    const all = lines.filter(l => l.trim()).every(l => /^\s*--/.test(l));
    const out = lines.map(l => (all ? l.replace(/^(\s*)-- ?/, '$1') : (l.trim() ? '-- ' + l : l))).join('\n');
    insertText(out, ls, le);
    ta.setSelectionRange(ls, ls + out.length);
  }
  ta.addEventListener('input', () => { refresh(); saveBuffer(); acUpdate(false); });
  ta.addEventListener('scroll', () => { sync(); if (AC) acClose(); });
  ta.addEventListener('click', () => { status(); acClose(); });
  ta.addEventListener('keyup', e => { if (/Arrow|Home|End|Page/.test(e.key)) status(); });
  ta.addEventListener('blur', () => setTimeout(acClose, 120));
  ta.addEventListener('select', status);

  // ---------- drops from the tables panel ----------
  ta.addEventListener('dragover', e => {
    if (!S.dragPayload) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'copy'; } catch (err) { /* ignore */ }
    ed.classList.add('drop-on');
    const pos = posFromPoint(e.clientX, e.clientY);
    const xy = caretXY(pos);
    caret.hidden = false;
    caret.style.left = xy.x + 'px';
    caret.style.top = xy.y + 'px';
  });
  const endDrop = () => { ed.classList.remove('drop-on'); caret.hidden = true; };
  ta.addEventListener('dragleave', endDrop);
  ta.addEventListener('drop', e => {
    const p = S.dragPayload;
    endDrop();
    if (!p) return;
    e.preventDefault();
    const pos = posFromPoint(e.clientX, e.clientY);
    ta.setSelectionRange(pos, pos);
    insertSmart(p.col ? qualifiedName(p.table, p.col) : qi(p.table));
    S.dragPayload = null;
  });

  // ---------- snippets ----------
  function snippetList() {
    const sch = active().schema;
    const t0 = sch.order.find(n => sch.tables[n].type === 'table') || 'my_table';
    const T = sch.tables[t0];
    const cols = T ? T.columns.map(c => c.name) : ['id', 'name'];
    const c1 = cols.find(c => c !== 'id') || cols[0] || 'name';
    let fk = null;
    for (const n of sch.order) { const f = sch.tables[n].fks[0]; if (f) { fk = { t: n, f }; break; } }
    const lit = c => { const col = T && T.columns.find(x => x.name === c); const cls = QL.typeClass(col && col.type); return cls === 'num' || cls === 'bool' ? '0' : cls === 'date' ? `'${new Date().toISOString().slice(0, 10)}'` : "'text'"; };
    const ins = cols.filter(c => !(T && T.columns.find(x => x.name === c && x.pk))).slice(0, 3);
    return [
      ['SELECT', 'block', `SELECT ${cols.slice(0, 3).map(qi).join(', ')}\nFROM ${qi(t0)}\nLIMIT 10;`],
      ['WHERE', 'inline', `WHERE ${qi(c1)} = ${lit(c1)}`],
      ['AND / OR', 'inline', 'AND '],
      ['JOIN', 'inline', fk ? `JOIN ${qi(fk.f.table)} ON ${qi(fk.f.table)}.${qi(fk.f.to)} = ${qi(fk.t)}.${qi(fk.f.from)}` : 'JOIN other_table ON other_table.id = my_table.other_id'],
      ['GROUP BY', 'block', `SELECT ${qi(c1)}, COUNT(*) AS n\nFROM ${qi(t0)}\nGROUP BY ${qi(c1)}\nORDER BY n DESC;`],
      ['ORDER BY', 'inline', `ORDER BY ${qi(c1)} DESC`],
      ['LIMIT', 'inline', 'LIMIT 10'],
      ['CASE', 'inline', `CASE\n  WHEN condition THEN 'yes'\n  ELSE 'no'\nEND`],
      ['INSERT', 'block', `INSERT INTO ${qi(t0)} (${ins.map(qi).join(', ')})\nVALUES (${ins.map(lit).join(', ')});`],
      ['UPDATE', 'block', `UPDATE ${qi(t0)}\nSET ${qi(c1)} = ${lit(c1)}\nWHERE id = 1;`],
      ['DELETE', 'block', `DELETE FROM ${qi(t0)}\nWHERE id = 1;`],
      ['CREATE TABLE', 'block', 'CREATE TABLE new_table (\n  id      INTEGER PRIMARY KEY,\n  name    TEXT NOT NULL,\n  created DATE DEFAULT CURRENT_DATE\n);'],
    ];
  }
  function renderSnips() {
    const list = snippetList();
    $('#snips').innerHTML = `<span class="snip-label">Insert</span>${list.map((s, i) => `<button class="snip" type="button" data-i="${i}" title="Insert a ${esc(s[0])} template">${esc(s[0])}</button>`).join('')}`;
    $('#snips').onclick = e => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const s = snippetList()[+b.dataset.i];
      if (s[1] === 'block') insertBlock(s[2], true); else insertSmart(s[2]);
    };
  }

  return {
    measure, refresh, setContext, saveBuffer, insertText, insertSmart, insertBlock, appendBlock, replaceAll, needsQualify, renderSnips,
    value: () => ta.value,
    selection: () => ta.value.slice(ta.selectionStart, ta.selectionEnd),
    focus: () => ta.focus({ preventScroll: true }),
    key: () => key,
  };
})();

// ---------- mode switching, tools, running ----------
function setMode(m) {
  S.mode = m === 'editor' ? 'editor' : 'builder';
  S.prefs.mode = S.mode; savePrefs();
  $('#mode-builder').setAttribute('aria-selected', S.mode === 'builder');
  $('#mode-editor').setAttribute('aria-selected', S.mode === 'editor');
  $('#builder').hidden = S.mode !== 'builder';
  $('#editor').hidden = S.mode !== 'editor';
  renderTools();
  if (S.mode === 'builder') { Builder.refresh(); Builder.scheduleRun(); }
  else { Editor.renderSnips(); Editor.refresh(); }
  Learn.updateStrip();
}
function renderTools() {
  const t = $('#ws-tools');
  if (S.mode === 'builder') {
    t.innerHTML = `<button class="btn btn-quiet btn-sm" type="button" data-tool="all" title="Put every table on the canvas to see how they connect">${icon('layers', 'ic-sm')} All tables</button><button class="btn btn-quiet btn-sm" type="button" data-tool="clear">${icon('trash', 'ic-sm')} Clear</button>`;
  } else {
    const c = S.caps.sample;
    t.innerHTML = `${c ? `<button class="btn btn-sm btn-claude" type="button" data-tool="explain" title="Ask Claude to explain the query">${icon('sparkle', 'ic-sm')} Explain</button><button class="btn btn-sm btn-claude" type="button" data-tool="write" title="Describe what you want and let Claude write the SQL">${icon('sparkle', 'ic-sm')} Write for me</button>` : ''}<button class="btn btn-quiet btn-sm" type="button" data-tool="clear-ed">${icon('trash', 'ic-sm')} Clear</button>`;
  }
}
function currentSQL() {
  if (S.mode === 'builder') return S.builderQuery && S.builderQuery.valid ? S.builderQuery.sql : '';
  const sel = Editor.selection();
  return sel.trim() ? sel : Editor.value();
}
function runCurrent() {
  const sql = currentSQL();
  if (!sql.trim()) { toast(S.mode === 'builder' ? 'Add a table to the canvas first.' : 'Write a query first.'); return; }
  Results.run(sql, { source: S.mode });
  if (MQ_NARROW.matches) $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
