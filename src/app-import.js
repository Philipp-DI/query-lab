/* ===== app-import: bring in CSV / JSON / SQL / SQLite, export as zip or SQL script ===== */
const Import = (() => {
  let st = null;
  const SAMPLES = {
    csv: { name: 'expenses.csv', text: `date;category;description;amount;paid_by_card
03.01.2026;Groceries;Weekly market;23,80;true
04.01.2026;Transport;Monthly pass;58,00;true
05.01.2026;Rent;January;1.150,00;false
08.01.2026;Groceries;Supermarket;41,37;true
10.01.2026;Leisure;Cinema, two tickets;24,00;true
12.01.2026;Health;Pharmacy;12,95;true
15.01.2026;Groceries;Bakery;6,40;false
17.01.2026;Leisure;Concert;45,00;true
20.01.2026;Utilities;Electricity;64,20;false
22.01.2026;Groceries;Supermarket;37,12;true
25.01.2026;Transport;Bike repair;35,00;false
28.01.2026;Leisure;Books;19,99;true
31.01.2026;Utilities;Internet;34,99;false
02.02.2026;Groceries;Weekly market;27,50;true
04.02.2026;Transport;Monthly pass;58,00;true
05.02.2026;Rent;February;1.150,00;false
09.02.2026;Groceries;Supermarket;52,08;true
11.02.2026;Health;Dentist;;false
14.02.2026;Leisure;Dinner out;68,40;true
18.02.2026;Groceries;Bakery;5,90;false
` },
    json: { name: 'reading_list.json', text: JSON.stringify([
      { title: 'The Glass Orchard', author: 'Mira Holt', year: 2018, pages: 342, rating: 4.5, finished: true, tags: ['novel', 'family'] },
      { title: 'Signals from Station Nine', author: 'D. K. Brandt', year: 2021, pages: 410, rating: 4.0, finished: true, tags: ['science fiction'] },
      { title: 'A Short History of Salt', author: 'Ines Varga', year: 2015, pages: 288, rating: 3.5, finished: true, tags: ['history'] },
      { title: 'Quiet Machines', author: 'Tom Ellery', year: 2023, pages: 256, rating: null, finished: false, tags: ['essays', 'technology'] },
      { title: 'The Cartographer’s Notebook', author: 'Ana Ribeiro', year: 2019, pages: 198, rating: 5.0, finished: true, tags: ['biography'] },
      { title: 'Winter Harbour', author: 'Mira Holt', year: 2022, pages: 376, rating: null, finished: false, tags: ['novel', 'crime'] },
      { title: 'Learning to See Data', author: 'Priya Nair', year: 2020, pages: 230, rating: 4.0, finished: true, tags: ['nonfiction', 'statistics'] },
      { title: 'Bread and Stone', author: 'Jonas Weil', year: 2017, pages: 312, rating: 3.0, finished: true, tags: ['novel'] },
    ], null, 2) },
    sql: { name: 'recipes.sql', text: `-- Two related tables: recipes and their ingredients
CREATE TABLE recipes (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  minutes    INTEGER,
  vegetarian BOOLEAN DEFAULT 0
);
CREATE TABLE ingredients (
  recipe_id INTEGER NOT NULL REFERENCES recipes(id),
  item      TEXT NOT NULL,
  amount    TEXT
);
INSERT INTO recipes (name, minutes, vegetarian) VALUES
  ('Lentil soup', 40, 1),
  ('Spaghetti carbonara', 25, 0),
  ('Shakshuka', 30, 1),
  ('Chicken curry', 45, 0),
  ('Potato gratin', 70, 1);
INSERT INTO ingredients (recipe_id, item, amount) VALUES
  (1, 'red lentils', '250 g'), (1, 'carrots', '2'), (1, 'onion', '1'), (1, 'vegetable stock', '1 l'),
  (2, 'spaghetti', '400 g'), (2, 'eggs', '3'), (2, 'pecorino', '60 g'), (2, 'guanciale', '150 g'),
  (3, 'eggs', '4'), (3, 'tomatoes', '400 g'), (3, 'bell pepper', '1'), (3, 'onion', '1'),
  (4, 'chicken thighs', '500 g'), (4, 'coconut milk', '400 ml'), (4, 'curry paste', '2 tbsp'), (4, 'onion', '1'),
  (5, 'potatoes', '1 kg'), (5, 'cream', '200 ml'), (5, 'cheese', '100 g');
` },
  };
  const delimName = d => ({ ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' }[d] || 'comma');
  const defaultTarget = () => (active() && !active().builtin ? S.active : 'mine');
  const head = title => `<div class="modal-h"><h2 id="modal-title">${title}</h2><button class="icon-btn" type="button" data-imp="close" aria-label="Close">${icon('x')}</button></div>`;
  const targetSelect = () => `<label class="field">Import into<select id="imp-target">${[...S.dbs.values()].map(e => `<option value="${esc(e.id)}"${e.id === st.target ? ' selected' : ''}>${esc(e.name)}${e.builtin ? ' (sample)' : ''}</option>`).join('')}</select></label>`;

  function open() { st = null; renderPick(); }
  function renderPick(err) {
    const box = Modal.open(`${head('Import data')}
      <div class="modal-b">
        ${err ? `<div class="import-err">${err}</div>` : ''}
        <label class="drop" id="imp-drop">${icon('upload')}<strong>Drop a file here or choose one</strong><span class="formats">CSV, TSV or TXT · JSON · SQL script · SQLite database (.db, .sqlite)</span><span class="btn btn-sm" style="margin-top:6px">Choose a file</span><input type="file" id="imp-file" accept=".csv,.tsv,.txt,.json,.sql,.db,.sqlite,.sqlite3,.db3,text/csv,application/json,text/plain" hidden></label>
        <div class="or">or paste text</div>
        <textarea class="paste" id="imp-paste" placeholder="Paste CSV rows with a header line, a JSON list, or SQL statements" spellcheck="false"></textarea>
        <div class="samples">Try an example: <button class="btn btn-xs" type="button" data-sample="csv">Expenses (European CSV)</button><button class="btn btn-xs" type="button" data-sample="json">Reading list (JSON)</button><button class="btn btn-xs" type="button" data-sample="sql">Recipes (SQL script)</button></div>
      </div>
      <div class="modal-f"><span class="left">Files are read in your browser. Nothing is uploaded.</span><button class="btn" type="button" data-imp="close">Cancel</button><button class="btn btn-primary" type="button" data-imp="paste">Continue</button></div>`);
    const drop = $('#imp-drop', box);
    $('#imp-file', box).addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) readFile(f); });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('on'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('on'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('on'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readFile(f); });
    box.onclick = e => {
      const b = e.target.closest('[data-imp], [data-sample]');
      if (!b) return;
      if (b.dataset.sample) { const s = SAMPLES[b.dataset.sample]; fromText(s.text, s.name); return; }
      if (b.dataset.imp === 'close') Modal.close();
      else if (b.dataset.imp === 'paste') fromText($('#imp-paste', box).value, 'pasted data');
    };
  }
  function readFile(file) {
    const name = file.name || 'data';
    const ext = ((/\.([a-z0-9]+)$/i.exec(name) || [])[1] || '').toLowerCase();
    if (file.size > 80 * 1024 * 1024) { renderPick('That file is larger than 80 MB. Try a smaller extract.'); return; }
    const reader = new FileReader();
    reader.onerror = () => renderPick('The file couldn’t be read.');
    reader.onload = () => {
      const buf = new Uint8Array(reader.result);
      const isSqlite = buf.length >= 16 && String.fromCharCode(...buf.slice(0, 15)) === 'SQLite format 3';
      if (isSqlite || ['db', 'sqlite', 'sqlite3', 'db3'].includes(ext)) { fromSqlite(buf, name); return; }
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('windows-1252').decode(buf); }
      fromText(text, name, ext);
    };
    reader.readAsArrayBuffer(file);
  }
  function fromText(text, name, ext) {
    const t = String(text || '').replace(/^﻿/, '');
    if (!t.trim()) { renderPick('There is nothing to import yet. Choose a file or paste some text.'); return; }
    const head0 = t.trim();
    let kind;
    if (ext === 'json' || /^[[{]/.test(head0)) kind = 'json';
    else if (ext === 'sql' || /^(--|\/\*|CREATE\b|INSERT\b|BEGIN\b|PRAGMA\b|DROP\b|ALTER\b)/i.test(head0)) kind = 'sql';
    else kind = 'csv';
    if (kind === 'sql') { st = { kind, text: t, fileName: name, target: defaultTarget() }; renderSql(); return; }
    const base = QL.sanitizeName(name.replace(/\.[^.]+$/, ''), 'imported_data');
    st = { kind, text: t, fileName: name, delimMode: 'auto', hasHeader: true, name: /^pasted/.test(base) ? 'imported_data' : base, target: defaultTarget(), replace: false };
    try { parse(); } catch (err) { renderPick(esc(err.message || 'The data couldn’t be read.')); return; }
    renderTable();
  }
  function parse() {
    let header, rows;
    if (st.kind === 'json') {
      const r = QL.jsonToTable(st.text);
      header = r.header; rows = r.rows; st.delim = null;
    } else {
      const d = st.delimMode === 'auto' ? QL.detectDelimiter(st.text) : st.delimMode;
      st.delim = d;
      const all = QL.parseDelimited(st.text, d);
      if (!all.length) throw new Error('No rows found in the text.');
      const w0 = Math.max(...all.slice(0, 300).map(r => r.length));
      if (st.hasHeader) { header = all[0]; rows = all.slice(1); } else { header = Array.from({ length: w0 }, (_, i) => `column_${i + 1}`); rows = all; }
    }
    const width = Math.max(header.length, ...rows.slice(0, 500).map(r => r.length), 1);
    const used = new Set();
    st.cols = [];
    for (let i = 0; i < width; i++) {
      const base = QL.sanitizeName(header[i] || '', `column_${i + 1}`);
      let n = base, k = 2;
      while (used.has(n)) n = `${base}_${k++}`;
      used.add(n);
      const inf = QL.inferColumn(rows.slice(0, 3000).map(r => r[i]), st.delim || ',');
      st.cols.push({ name: n, type: inf.type, dc: !!(inf.info && inf.info.decimalComma), note: inf.note || '' });
    }
    st.rows = rows.map(r => { const x = r.slice(0, width); while (x.length < width) x.push(''); return x; });
  }
  const conv = c => QL.converter(c.type, { decimalComma: c.dc });
  function renderTable(err) {
    const cv = st.cols.map(conv);
    const preview = st.rows.slice(0, 8);
    const tgt = S.dbs.get(st.target);
    const box = Modal.open(`${head(`Import “${esc(st.fileName)}”`)}
      <div class="modal-b">
        ${err ? `<div class="import-err">${err}</div>` : ''}
        <div class="form-row">
          <label class="field grow">Table name<input type="text" id="imp-name" value="${esc(st.name)}" spellcheck="false"></label>
          ${st.kind === 'csv' ? `<label class="field">Separator<select id="imp-delim">${[['auto', `Detect (${delimName(st.delim)})`], [',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']].map(([v, l]) => `<option value="${esc(v)}"${st.delimMode === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
          ${targetSelect()}
        </div>
        <div class="form-row">${st.kind === 'csv' ? `<label class="chk"><input type="checkbox" id="imp-header"${st.hasHeader ? ' checked' : ''}> The first row has the column names</label>` : ''}<label class="chk"><input type="checkbox" id="imp-replace"${st.replace ? ' checked' : ''}> Replace a table with the same name</label></div>
        <div class="pv-wrap"><table class="pv"><thead><tr>${st.cols.map((c, i) => `<th><input type="text" data-col="${i}" value="${esc(c.name)}" aria-label="Name of column ${i + 1}" spellcheck="false"><br><select data-type="${i}" aria-label="Type of column ${i + 1}">${QL.TYPES.map(t => `<option${t === c.type ? ' selected' : ''}>${t}</option>`).join('')}</select>${c.note ? `<span class="conv">${esc(c.note)}</span>` : ''}</th>`).join('')}</tr></thead>
          <tbody>${preview.map(r => `<tr>${r.map((v, i) => { const x = cv[i](v); return x == null ? '<td><span class="null">NULL</span></td>' : `<td class="${typeof x === 'number' ? 'num' : ''}">${esc(String(x))}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="import-note">${fmtNum(st.rows.length)} rows and ${st.cols.length} columns. Empty cells become NULL. The preview shows the first rows the way they will be stored.${tgt && tgt.builtin ? ' Tables added to a sample database last until you reload the page. “My database” is kept in this browser.' : ''}</p>
      </div>
      <div class="modal-f"><button class="btn" type="button" data-imp="back">${icon('left', 'ic-sm')} Back</button><span class="top-spacer"></span><button class="btn" type="button" data-imp="close">Cancel</button><button class="btn btn-primary" type="button" data-imp="go">Import ${fmtNum(st.rows.length)} ${st.rows.length === 1 ? 'row' : 'rows'}</button></div>`);
    box.onclick = e => {
      const b = e.target.closest('[data-imp]');
      if (!b) return;
      if (b.dataset.imp === 'close') Modal.close();
      else if (b.dataset.imp === 'back') renderPick();
      else if (b.dataset.imp === 'go') doImport();
    };
    box.oninput = e => {
      const el = e.target;
      if (el.id === 'imp-name') st.name = el.value;
      else if (el.dataset.col != null) st.cols[+el.dataset.col].name = el.value;
    };
    box.onchange = e => {
      const el = e.target;
      if (el.id === 'imp-delim') { st.delimMode = el.value; parse(); renderTable(); }
      else if (el.id === 'imp-header') { st.hasHeader = el.checked; parse(); renderTable(); }
      else if (el.id === 'imp-target') { st.target = el.value; renderTable(); }
      else if (el.id === 'imp-replace') st.replace = el.checked;
      else if (el.dataset.type != null) { st.cols[+el.dataset.type].type = el.value; st.cols[+el.dataset.type].note = ''; renderTable(); }
    };
  }
  function doImport() {
    const e = ensureBuilt(st.target);
    const t = QL.sanitizeName(st.name || 'imported_data', 'imported_data');
    const used = new Set();
    const names = st.cols.map((c, i) => { const base = QL.sanitizeName(c.name, `column_${i + 1}`); let n = base, k = 2; while (used.has(n)) n = `${base}_${k++}`; used.add(n); return n; });
    if (e.schema.tables[t] && !st.replace) { renderTable(`A table called <code>${esc(t)}</code> already exists in “${esc(e.name)}”. Choose another name, or tick “Replace a table with the same name”.`); return; }
    if (e.tx) { renderTable('This database has an open transaction. Finish it with COMMIT or ROLLBACK in the editor first.'); return; }
    const cv = st.cols.map(conv);
    const db = e.db;
    try {
      db.exec('BEGIN');
      if (e.schema.tables[t]) db.exec(`DROP ${e.schema.tables[t].type === 'view' ? 'VIEW' : 'TABLE'} ${qi(t)}`);
      db.exec(`CREATE TABLE ${qi(t)} (\n  ${names.map((n, i) => `${qi(n)} ${st.cols[i].type}`).join(',\n  ')}\n)`);
      const stmt = db.prepare(`INSERT INTO ${qi(t)} VALUES (${names.map(() => '?').join(', ')})`);
      for (const r of st.rows) stmt.run(r.map((v, i) => cv[i](v)));
      stmt.free();
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch (x) { /* ignore */ }
      renderTable('The import failed: ' + esc(err.message));
      return;
    }
    finish(e, t, `Imported ${fmtNum(st.rows.length)} ${st.rows.length === 1 ? 'row' : 'rows'} into <code>${esc(t)}</code>.`);
  }
  function finish(e, table, msg) {
    Modal.close();
    e.schema = readSchema(e);
    if (e.builtin) e.dirty = true;
    persistSoon(e);
    if (table) S.openTables.add(e.id + ':' + table);
    if (S.active !== e.id) setActive(e.id);
    else { renderTopDs(); renderSchema(); Builder.revalidate(true); Editor.refresh(); }
    if (table && e.schema.tables[table]) previewTable(table);
    toast(msg, { icon: 'check' });
  }
  function renderSql(err) {
    const lines = st.text.split('\n');
    const preview = lines.slice(0, 80).join('\n') + (lines.length > 80 ? `\n-- … and ${lines.length - 80} more lines` : '');
    const box = Modal.open(`${head(`Run the SQL script “${esc(st.fileName)}”`)}
      <div class="modal-b">
        ${err ? `<div class="import-err">${err}</div>` : ''}
        <div class="form-row">${targetSelect().replace('Import into', 'Run it in')}</div>
        <pre class="sql sql-preview">${QL.highlight(preview, null)}</pre>
        <p class="import-note">${fmtNum(lines.length)} lines. The script runs as one transaction, so if a statement fails nothing is changed.</p>
      </div>
      <div class="modal-f"><button class="btn" type="button" data-imp="back">${icon('left', 'ic-sm')} Back</button><span class="top-spacer"></span><button class="btn" type="button" data-imp="close">Cancel</button><button class="btn btn-primary" type="button" data-imp="run">${icon('play', 'ic-sm')} Run script</button></div>`);
    box.onclick = e => {
      const b = e.target.closest('[data-imp]');
      if (!b) return;
      if (b.dataset.imp === 'close') Modal.close();
      else if (b.dataset.imp === 'back') renderPick();
      else if (b.dataset.imp === 'run') runScript();
    };
    box.onchange = e => { if (e.target.id === 'imp-target') st.target = e.target.value; };
    box.oninput = null;
  }
  function runScript() {
    const e = ensureBuilt(st.target);
    if (e.tx) { renderSql('This database has an open transaction. Finish it with COMMIT or ROLLBACK first.'); return; }
    const before = new Set(e.schema.order);
    const ownTx = /\b(BEGIN|COMMIT|ROLLBACK)\b/i.test(st.text);
    let r;
    if (!ownTx) {
      e.db.exec('BEGIN');
      r = QL.runSQL(e.db, st.text, { maxRows: 20 });
      if (r.error) { try { e.db.exec('ROLLBACK'); } catch (x) { /* ignore */ } renderSql(`Statement ${r.error.index} failed: ${esc(r.error.message)}. Nothing was changed.`); return; }
      e.db.exec('COMMIT');
    } else {
      r = QL.runSQL(e.db, st.text, { maxRows: 20 });
      Results.afterRun(e, r);
      if (r.error) { renderSql(`Statement ${r.error.index} failed: ${esc(r.error.message)}. The statements before it have run.`); return; }
    }
    e.schema = readSchema(e);
    const created = e.schema.order.filter(n => !before.has(n));
    finish(e, created[0] || null, `Ran ${fmtNum(r.count)} ${r.count === 1 ? 'statement' : 'statements'}${created.length ? `. New: ${created.map(n => `<code>${esc(n)}</code>`).join(', ')}` : ''}.`);
  }
  function fromSqlite(bytes, fileName) {
    let tables = [], counts = [];
    try {
      const db = new S.SQL.Database(bytes);
      const r = db.exec("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
      tables = r.length ? r[0].values.map(x => x[0]) : [];
      counts = tables.map(t => { try { return fmtNum(db.exec(`SELECT COUNT(*) FROM ${qi(t)}`)[0].values[0][0]); } catch (err) { return '?'; } });
      db.close();
    } catch (err) { renderPick('This file isn’t a SQLite database that can be read here.'); return; }
    st = { kind: 'sqlite', bytes, fileName, name: fileName.replace(/\.[^.]+$/, '') };
    const box = Modal.open(`${head(`Open “${esc(fileName)}”`)}
      <div class="modal-b">
        <div class="form-row"><label class="field grow">Name in Query Lab<input type="text" id="imp-dbname" value="${esc(st.name)}" spellcheck="false"></label></div>
        <div class="pv-wrap"><table class="pv"><thead><tr><th>Table</th><th>Rows</th></tr></thead><tbody>${tables.map((t, i) => `<tr><td>${esc(t)}</td><td class="num">${counts[i]}</td></tr>`).join('') || '<tr><td colspan="2">No tables</td></tr>'}</tbody></table></div>
        <p class="import-note">The database opens as its own entry under “Your data” and is kept in this browser.</p>
      </div>
      <div class="modal-f"><button class="btn" type="button" data-imp="back">${icon('left', 'ic-sm')} Back</button><span class="top-spacer"></span><button class="btn" type="button" data-imp="close">Cancel</button><button class="btn btn-primary" type="button" data-imp="open">Open database</button></div>`);
    box.onclick = e => {
      const b = e.target.closest('[data-imp]');
      if (!b) return;
      if (b.dataset.imp === 'close') Modal.close();
      else if (b.dataset.imp === 'back') renderPick();
      else if (b.dataset.imp === 'open') {
        const id = 'file-' + Date.now().toString(36);
        const name = (($('#imp-dbname', box).value || '').trim() || st.name).slice(0, 60);
        S.dbs.set(id, { id, name, icon: 'file', blurb: 'Opened from a file, kept in this browser', builtin: false, notes: {}, order: [], db: null, bytes: st.bytes, tx: false, schema: null });
        ensureBuilt(id);
        persistSoon(S.dbs.get(id));
        Modal.close();
        setActive(id, { announce: true });
      }
    };
    box.oninput = null; box.onchange = null;
  }

  function dump(db) {
    const out = [`-- Exported from Query Lab, ${new Date().toISOString().slice(0, 10)}`, 'PRAGMA foreign_keys = OFF;', 'BEGIN TRANSACTION;'];
    const r = db.exec("SELECT type, name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, rowid");
    for (const [type, name, sql] of (r.length ? r[0].values : [])) {
      out.push('', sql + ';');
      if (type !== 'table') continue;
      const d = db.exec(`SELECT * FROM ${qi(name)}`);
      if (!d.length) continue;
      const cols = d[0].columns.map(qi).join(', ');
      for (const row of d[0].values) out.push(`INSERT INTO ${qi(name)} (${cols}) VALUES (${row.map(QL.sqlValue).join(', ')});`);
    }
    out.push('', 'COMMIT;', '');
    return out.join('\n');
  }
  async function exportZip(e) {
    if (e.tx) { toast('Finish the open transaction first (COMMIT or ROLLBACK).'); return; }
    const slug = QL.sanitizeName(e.name, 'database');
    let bytes;
    try { bytes = e.db.export(); e.db.run('PRAGMA foreign_keys = ON'); } catch (err) { toast('The database couldn’t be exported.'); return; }
    const blob = QL.zip([
      { name: slug + '.sqlite', data: bytes },
      { name: slug + '.sql', data: dump(e.db) },
      { name: 'README.txt', data: `${e.name}\nExported from Query Lab on ${new Date().toISOString().slice(0, 10)}.\n\n${slug}.sqlite  A SQLite database file. Open it with any SQLite tool, for example DB Browser for SQLite or the sqlite3 command line.\n${slug}.sql     The same tables and rows as SQL statements (SQLite syntax).\n` },
    ]);
    if (await saveFile(slug + '.zip', blob)) toast(`Saved ${esc(slug)}.zip`, { icon: 'check' });
  }

  return { open, dump, exportZip };
})();
