/* ===== app-results: running SQL, result grid, messages, friendly errors, history ===== */
const Results = (() => {
  const head = $('#res-head'), body = $('#res-body');
  const PAGE = 500;
  let V = null;
  const verbOf = sql => ((String(sql || '').replace(/^(\s|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, '').match(/^\w+/) || [''])[0]).toUpperCase();
  const fmtCell = v => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12))));

  function run(sql, opts) {
    opts = opts || {};
    const e = active();
    const r = QL.runSQL(e.db, sql, { maxRows: 5000 });
    afterRun(e, r);
    const out = Object.assign({}, r, { sql, source: opts.source || S.mode });
    if (!opts.noHistory) addHistory(sql, !!r.error);
    S.last = out;
    show(out, opts);
    return out;
  }
  // Tracks open transactions so that work undone by ROLLBACK doesn't mark a sample database as modified.
  function afterRun(e, r) {
    let changed = false, pending = false, refresh = false;
    for (const x of r.results) {
      const v = x.verb || verbOf(x.sql);
      if (v === 'BEGIN') { e.tx = true; continue; }
      if (v === 'COMMIT' || v === 'END') { e.tx = false; if (pending) changed = true; pending = false; continue; }
      if (v === 'ROLLBACK') { e.tx = false; pending = false; refresh = true; continue; }
      const mod = (x.kind === 'ok' && !/^(SAVEPOINT|RELEASE|SELECT|WITH|EXPLAIN|ANALYZE)$/.test(v)) || (x.kind === 'rows' && /^(INSERT|UPDATE|DELETE|REPLACE)$/.test(v));
      if (!mod) continue;
      if (e.tx) pending = true; else changed = true;
    }
    if (pending) changed = true;
    if (changed || refresh) {
      if (changed && e.builtin) e.dirty = true;
      e.schema = readSchema(e);
      if (e.id === S.active) { renderTopDs(); renderSchema(); Builder.revalidate(true); Editor.refresh(); }
      if (changed) persistSoon(e);
    }
    return changed;
  }
  function show(out, opts) {
    opts = opts || {};
    const panels = [];
    const rows = out.results.filter(x => x.kind === 'rows');
    const oks = out.results.filter(x => x.kind === 'ok');
    rows.forEach((x, i) => panels.push({ id: 'r' + i, kind: 'rows', title: rows.length > 1 ? `Result ${i + 1}` : (opts.title || 'Result'), data: x, sort: null, shown: PAGE }));
    if (oks.length) panels.push({ id: 'msg', kind: 'msgs', title: oks.length > 1 ? `Messages (${oks.length})` : 'Message', data: oks });
    if (out.error) panels.unshift({ id: 'err', kind: 'error', title: 'Error', err: true });
    (opts.extra || []).forEach(p => panels.push(Object.assign({ sort: null, shown: PAGE }, p)));
    if (!panels.length) panels.push({ id: 'none', kind: 'note', title: 'Result', html: '<div class="res-empty"><div><strong>Nothing ran</strong>There is no SQL statement here yet, only comments or blank lines.</div></div>' });
    const lints = [];
    if (!out.error && out.source === 'editor') lints.push(...QL.lint(out.sql, { identSet: identSet() }));
    oks.forEach(x => {
      if ((x.verb === 'UPDATE' || x.verb === 'DELETE') && !/\bWHERE\b/i.test(x.sql) && x.changes > 0) {
        lints.push(`This ${x.verb} has no WHERE, so it ${x.verb === 'DELETE' ? 'removed' : 'changed'} every row (${fmtNum(x.changes)}).${active().builtin ? ' If that wasn’t the plan, choose “Reset” in the database menu.' : ''}`);
      }
    });
    V = { panels, cur: out.error ? 'err' : (opts.focus || (rows.length ? 'r' + (rows.length - 1) : panels[0].id)), out, opts, lints, fixes: [] };
    render();
  }
  function showData(o) {
    const panels = [{ id: 'x', kind: 'rows', title: o.title, label: o.label, data: o.data, sort: null, shown: PAGE, static: true }];
    if (o.other) panels.unshift(Object.assign({ id: 'y', kind: 'rows', sort: null, shown: PAGE, static: true }, o.other));
    V = { panels, cur: o.focus || 'x', out: null, opts: {}, lints: [], fixes: [] };
    render();
  }
  function addPanel(p, focus) {
    if (!V) return showData({ title: p.title, data: p.data, label: p.label });
    V.panels = V.panels.filter(x => x.id !== p.id);
    V.panels.push(Object.assign({ sort: null, shown: PAGE, static: true }, p));
    if (focus) V.cur = p.id;
    render(true);
  }
  const curPanel = () => (V ? V.panels.find(x => x.id === V.cur) || V.panels[0] : null);

  function render(keepScroll) {
    if (!V) { clear(); return; }
    const p = curPanel();
    V.cur = p.id;
    const tabs = V.panels.length > 1
      ? `<div class="res-tabs" role="tablist">${V.panels.map(x => `<button class="res-tab" role="tab" type="button" data-tab="${x.id}" aria-selected="${x.id === p.id}">${x.err ? '<span class="dotmark err"></span>' : ''}${esc(x.title)}</button>`).join('')}</div>`
      : `<span class="eyebrow">${esc(p.title)}</span>`;
    let meta = '';
    if (p.kind === 'rows') {
      const n = p.data.values.length;
      meta = `${fmtNum(n)}${p.data.truncated ? '+' : ''} ${n === 1 ? 'row' : 'rows'} · ${p.data.columns.length} ${p.data.columns.length === 1 ? 'column' : 'columns'}`;
    }
    if (V.out && V.out.ms != null && !p.static) meta += `${meta ? ' · ' : ''}${V.out.ms < 1 ? '<1' : Math.round(V.out.ms)} ms`;
    const acts = [];
    if (p.kind === 'rows') {
      acts.push(`<button class="btn btn-xs" type="button" data-res="copy" title="Copy as tab-separated text, ready to paste into a spreadsheet">${icon('copy', 'ic-sm')} Copy</button>`);
      if (S.caps.downloads) acts.push(`<button class="btn btn-xs" type="button" data-res="csv" title="Save the result as a CSV file">${icon('download', 'ic-sm')} CSV</button>`);
    }
    if (V.opts.previewSql) acts.push(`<button class="btn btn-xs" type="button" data-res="open">${icon('code', 'ic-sm')} Open in editor</button>`);
    head.innerHTML = `${tabs}<span class="res-meta">${meta}</span>${p.label ? `<span class="res-label">${p.label}</span>` : ''}${acts.length ? `<div class="res-actions">${acts.join('')}</div>` : ''}`;
    let html = V.lints.length && p.kind !== 'error' && !p.static ? `<div class="lints">${V.lints.map(l => `<div class="lint">${icon('alert', 'ic-sm')}<div>${l}</div></div>`).join('')}</div>` : '';
    if (p.kind === 'rows') html += gridHTML(p);
    else if (p.kind === 'msgs') html += msgsHTML(p.data);
    else if (p.kind === 'error') html += errorHTML(V.out);
    else html += p.html || '';
    const sl = body.scrollLeft, st = body.scrollTop;
    body.innerHTML = html;
    if (keepScroll) { body.scrollLeft = sl; body.scrollTop = st; } else { body.scrollTop = 0; body.scrollLeft = 0; }
  }
  function sortedValues(p) {
    if (!p.sort) return p.data.values;
    const { c, dir } = p.sort;
    const vals = p.data.values;
    const idx = vals.map((r, i) => i);
    idx.sort((a, b) => {
      const x = vals[a][c], y = vals[b][c];
      if (x == null && y == null) return a - b;
      if (x == null) return 1;
      if (y == null) return -1;
      const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
      return d * dir || a - b;
    });
    return idx.map(i => vals[i]);
  }
  function cell(v, num) {
    if (v == null) return '<td><span class="null">NULL</span></td>';
    if (v instanceof Uint8Array) return `<td class="muted">BLOB · ${v.length} bytes</td>`;
    if (typeof v === 'number') return `<td class="num">${esc(fmtCell(v))}</td>`;
    const s = String(v);
    return `<td${s.length > 36 ? ` title="${esc(s.slice(0, 2000))}"` : ''}>${esc(s.length > 400 ? s.slice(0, 400) + '…' : s)}</td>`;
  }
  function gridHTML(p) {
    const cols = p.data.columns;
    const vals = sortedValues(p);
    const num = cols.map((_, c) => {
      let any = false;
      for (let i = 0; i < Math.min(vals.length, 300); i++) { const v = vals[i][c]; if (v == null) continue; if (typeof v !== 'number') return false; any = true; }
      return any;
    });
    const n = Math.min(vals.length, p.shown || PAGE);
    const out = [];
    for (let i = 0; i < n; i++) out.push(`<tr><td class="rn">${i + 1}</td>${vals[i].map((v, c) => cell(v, num[c])).join('')}</tr>`);
    const th = cols.map((c, i) => `<th data-c="${i}" class="${num[i] ? 'num' : ''}" title="Sort by ${esc(c)}">${esc(c)}${p.sort && p.sort.c === i ? `<span class="sorter">${p.sort.dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`).join('');
    let foot = '';
    if (!vals.length) foot += `<div class="res-more">${icon('info', 'ic-sm')} No rows matched. The query itself ran without errors.</div>`;
    if (vals.length > n) foot += `<div class="res-more">Showing ${fmtNum(n)} of ${fmtNum(vals.length)} rows <button class="btn btn-xs" type="button" data-res="more">Show ${fmtNum(Math.min(PAGE, vals.length - n))} more</button></div>`;
    if (p.data.truncated) foot += `<div class="res-more">${icon('info', 'ic-sm')} Only the first ${fmtNum(vals.length)} rows were fetched. Add LIMIT or a filter to narrow the result down.</div>`;
    return `<table class="grid"><thead><tr><th class="rn" title="Row number">#</th>${th}</tr></thead><tbody>${out.join('')}</tbody></table>${foot}`;
  }
  function okText(x) {
    const n = x.changes || 0;
    const rows = c => `${fmtNum(c)} ${c === 1 ? 'row' : 'rows'}`;
    const m = /^\s*(?:CREATE|DROP)\s+(?:TEMP(?:ORARY)?\s+)?(?:UNIQUE\s+)?(TABLE|VIEW|INDEX|TRIGGER)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([^\s(]+)/i.exec(x.sql.replace(/^(\s|--[^\n]*\n?)+/, ''));
    switch (x.verb) {
      case 'INSERT': case 'REPLACE': return `${rows(n)} inserted`;
      case 'UPDATE': return `${rows(n)} updated`;
      case 'DELETE': return `${rows(n)} deleted`;
      case 'CREATE': return m ? `Created ${m[1].toLowerCase()} ${m[2]}` : 'Created';
      case 'DROP': return m ? `Removed ${m[1].toLowerCase()} ${m[2]}` : 'Removed';
      case 'ALTER': return 'Table changed';
      case 'BEGIN': return 'Transaction started: changes wait for COMMIT or ROLLBACK';
      case 'COMMIT': case 'END': return 'Transaction committed: changes saved';
      case 'ROLLBACK': return 'Transaction rolled back: changes undone';
      case 'PRAGMA': return 'Setting applied';
      default: return 'Done';
    }
  }
  function msgsHTML(list) {
    return `<div class="msg-list">${list.map(x => `<div class="msg ok">${icon('check')}<div><b>${esc(okText(x))}</b><div class="stmt">${esc(x.sql.length > 240 ? x.sql.slice(0, 240) + '…' : x.sql)}</div></div></div>`).join('')}</div>`;
  }
  function errorHTML(out) {
    const err = out.error;
    const ex = QL.explainError(err.message, out.sql, errorContext());
    const multi = (out.count || 0) > 1;
    const canFix = out.source === 'editor' && S.mode === 'editor' && ex.fixes.length;
    V.fixes = canFix ? ex.fixes : [];
    const btns = [];
    if (canFix) ex.fixes.forEach((f, i) => btns.push(`<button class="btn btn-sm btn-primary" type="button" data-fix="${i}">${icon('check', 'ic-sm')} ${esc(f.label)}</button>`));
    if (S.caps.sample) btns.push(`<button class="btn btn-sm btn-claude" type="button" data-res="why">${icon('sparkle', 'ic-sm')} Ask Claude why</button>`);
    const before = out.results.length ? `<p class="muted" style="margin:8px 0 0">The ${out.results.length === 1 ? 'statement' : out.results.length + ' statements'} before it ran successfully.</p>` : '';
    return `<div class="errcard" role="alert"><div class="errcard-h">${icon('alert')}<div><div class="errcard-title">${ex.title}</div><div class="errcard-raw">${multi ? `Statement ${err.index}: ` : ''}${esc(err.message)}</div></div></div>
      <div class="errcard-b">${ex.hints.length ? `<ul>${ex.hints.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}${before}${btns.length ? `<div class="fixes">${btns.join('')}</div>` : ''}</div></div>`;
  }
  function applyFix(fx) {
    let sql = Editor.value();
    sql = fx.removeCommaBefore ? QL.removeCommaBefore(sql, fx.removeCommaBefore) : QL.replaceIdent(sql, fx.find, fx.replace);
    Editor.replaceAll(sql);
    runCurrent();
  }
  function clear() {
    V = null;
    head.innerHTML = '<span class="eyebrow">Results</span>';
    body.innerHTML = `<div class="res-empty"><div><strong>Results appear here</strong>${S.mode === 'builder' ? 'Tick a column on the canvas and the result updates by itself.' : `Run your query with <kbd>${MOD}</kbd> + <kbd>Enter</kbd> or the Run button.`} The eye icon next to a table shows its rows.</div></div>`;
  }

  head.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) { V.cur = t.dataset.tab; render(); return; }
    const a = e.target.closest('[data-res]');
    if (!a || !V) return;
    const p = curPanel();
    if (a.dataset.res === 'copy' && p.kind === 'rows') copyText(QL.toCSV(p.data.columns, sortedValues(p), '\t'), `Copied ${fmtNum(p.data.values.length)} ${p.data.values.length === 1 ? 'row' : 'rows'}`);
    else if (a.dataset.res === 'csv' && p.kind === 'rows') saveFile(`${S.active}-result.csv`, '﻿' + QL.toCSV(p.data.columns, sortedValues(p)));
    else if (a.dataset.res === 'open' && V.opts.previewSql) { Editor.appendBlock(V.opts.previewSql); toast('Added to the editor and selected. Run it, or change it first.', { icon: 'code' }); }
  });
  body.addEventListener('click', e => {
    const th = e.target.closest('th[data-c]');
    if (th && V) {
      const p = curPanel();
      const c = +th.dataset.c;
      p.sort = !p.sort || p.sort.c !== c ? { c, dir: 1 } : p.sort.dir > 0 ? { c, dir: -1 } : null;
      render(true);
      return;
    }
    if (e.target.closest('[data-res="more"]')) { curPanel().shown += PAGE; render(true); return; }
    const fix = e.target.closest('[data-fix]');
    if (fix && V) { applyFix(V.fixes[+fix.dataset.fix]); return; }
    if (e.target.closest('[data-res="why"]') && V && V.out) Claude.ask('error', { sql: V.out.sql, message: V.out.error.message });
  });

  function addHistory(sql, err) {
    const item = { sql: sql.trim().slice(0, 4000), db: S.active, t: Date.now(), err };
    if (!item.sql) return;
    const top = S.history[0];
    if (top && top.sql === item.sql && top.db === item.db) S.history[0] = item; else S.history.unshift(item);
    S.history = S.history.slice(0, 80);
    store.set('history', S.history);
    Side.renderHistory();
  }

  return { run, afterRun, show, showData, addPanel, clear, current: () => V, refresh: () => render(true) };
})();
