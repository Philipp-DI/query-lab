/* ===== app-claude: optional help from Claude (only where the viewer allows it) ===== */
const Claude = (() => {
  const sheet = $('#sheet');
  let ctl = null;
  let lastKind = null;

  function init() {
    if (!window.claude || typeof window.claude.use !== 'function') {
      // Outside Claude (e.g. GitHub Pages): plain browser downloads, no Claude help.
      S.caps.downloads = {
        save: async ({ filename, data }) => {
          const blob = data instanceof Blob ? data : new Blob([data]);
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        },
      };
      capsChanged();
      return;
    }
    try {
      window.claude.use('sample').then(s => { S.caps.sample = s || null; capsChanged(); }).catch(() => {});
      window.claude.use('downloads').then(d => { S.caps.downloads = d || null; capsChanged(); }).catch(() => {});
    } catch (e) { /* capabilities not available */ }
  }
  function capsChanged() {
    renderTools();
    Learn.render();
    if (Results.current()) Results.refresh();
  }
  function schemaText() {
    const sch = active().schema;
    return sch.order.map(n => {
      const t = sch.tables[n];
      const cols = t.columns.map(c => `${c.name} ${c.type || ''}${c.pk ? ' PRIMARY KEY' : ''}`.trim());
      const fks = t.fks.map(f => `${f.from} -> ${f.table}.${f.to}`);
      return `${t.type === 'view' ? 'VIEW ' : ''}${n}(${cols.join(', ')})${fks.length ? '  -- references: ' + fks.join('; ') : ''}${t.count != null ? `  -- ${t.count} rows` : ''}`;
    }).join('\n').slice(0, 12000);
  }
  const BASE = 'You are a patient SQL tutor inside "Query Lab", a learning app that runs SQLite 3.45 in the browser. The learner is a beginner or intermediate. Be concrete and brief. Use SQLite syntax. Format with short paragraphs or a short list, `inline code`, and at most one ```sql code block.';

  function open(title, src) {
    sheet.innerHTML = `<div class="sheet-h">${icon('sparkle')}<h2>${esc(title)}</h2><button class="icon-btn icon-sm" type="button" data-cl="close" aria-label="Close">${icon('x', 'ic-sm')}</button></div>
      <div class="sheet-b">${src ? `<pre class="sheet-src sql">${QL.highlight(src.slice(0, 1500), tableSet())}</pre>` : ''}<div id="cl-out"></div></div>
      <div class="sheet-f" id="cl-foot"></div>`;
    sheet.hidden = false;
  }
  function footer(kind, busy) {
    const f = $('#cl-foot');
    if (!f) return;
    if (busy) { f.innerHTML = `<span class="thinking"><i></i><i></i><i></i> Claude is thinking</span><span class="top-spacer"></span><button class="btn btn-sm" type="button" data-cl="stop">${icon('stop', 'ic-sm')} Stop</button>`; return; }
    if (kind === 'write') f.innerHTML = `<input type="text" id="cl-q" placeholder="e.g. customers from Austria with more than 3 orders" aria-label="What should the query find?"><button class="btn btn-sm btn-primary" type="button" data-cl="ask">Write SQL</button>`;
    else f.innerHTML = `<span class="muted" style="font-size:12px">Answers can contain mistakes. Run the SQL to check it.</span><span class="top-spacer"></span><button class="btn btn-sm" type="button" data-cl="close">Close</button>`;
  }
  function decorate(out) {
    out.querySelectorAll('pre.md-code').forEach(pre => {
      if (pre.nextElementSibling && pre.nextElementSibling.classList.contains('use-row')) return;
      const row = h(`<div class="use-row"><button class="btn btn-xs" type="button" data-cl="use">${icon('code', 'ic-sm')} Use in editor</button></div>`);
      pre.after(row);
    });
  }
  function promptFor(kind, p) {
    const schema = `Database schema:\n${schemaText()}`;
    switch (kind) {
      case 'explain': return `${BASE}\n\nExplain what this query does, step by step, in at most 150 words. Point out anything that probably does not do what the author intended. Only include a corrected query if there is a real mistake.\n\n${schema}\n\nQuery:\n\`\`\`sql\n${p.sql}\n\`\`\``;
      case 'error': return `${BASE}\n\nThis query fails with the SQLite error: "${p.message}". In at most 120 words, explain in plain language why, then show the corrected query in one sql code block.\n\n${schema}\n\nQuery:\n\`\`\`sql\n${p.sql}\n\`\`\``;
      case 'nudge': return `${BASE}\n\nThe learner is working on this exercise:\n"${p.task}"\n\nTheir current SQL:\n\`\`\`sql\n${p.sql && p.sql.trim() ? p.sql : '(nothing written yet)'}\n\`\`\`\n${p.feedback ? `The automatic check said: "${p.feedback}"\n` : ''}\nGive one short, encouraging hint of at most 60 words that moves them one step forward. Do not write the complete solution query.\n\n${schema}`;
      case 'write': return `${BASE}\n\nWrite one SQLite query for this request: "${p.question}". Use only the tables and columns below. Reply with one or two sentences about the approach, then the query in one sql code block.\n\n${schema}`;
      default: return '';
    }
  }
  const TITLES = { explain: 'Claude explains your query', error: 'Why did this fail?', nudge: 'A nudge from Claude', write: 'Write SQL with Claude' };

  async function ask(kind, p) {
    const sample = S.caps.sample;
    if (!sample) { toast('Claude isn’t available on this page.'); return; }
    lastKind = kind;
    if (kind === 'write' && !(p && p.question)) {
      open(TITLES.write, null);
      $('#cl-out').innerHTML = `<p>Describe what you want to find in <b>${esc(active().name)}</b>. Claude writes the query; you run it and check the result.</p>`;
      footer('write', false);
      setTimeout(() => { const q = $('#cl-q'); if (q) q.focus(); }, 50);
      return;
    }
    if (kind === 'explain' && !(p.sql || '').trim()) { toast('Write a query first.'); return; }
    if (kind !== 'write' || !$('#cl-out')) open(TITLES[kind], kind === 'write' ? null : p.sql);
    const out = $('#cl-out');
    if (kind === 'write') out.innerHTML = `<p class="muted">“${esc(p.question)}”</p><div id="cl-ans"></div>`;
    else out.innerHTML = '<div id="cl-ans"></div>';
    const ans = $('#cl-ans');
    footer(kind, true);
    if (ctl) ctl.abort();
    const my = ctl = new AbortController();
    try {
      const res = await sample(promptFor(kind, p), {
        modelTier: kind === 'write' ? 'default' : 'quick',
        signal: my.signal,
        onText: ({ text }) => { ans.innerHTML = QL.md(text, tableSet()); decorate(ans); },
      });
      ans.innerHTML = QL.md(res.text, tableSet());
      decorate(ans);
      if (res.truncated) ans.append(h('<p class="muted">The answer was cut short.</p>'));
    } catch (e) {
      const code = e && e.code;
      const keep = e && e.text ? QL.md(e.text, tableSet()) : '';
      if (code === 'cancelled') ans.innerHTML = keep || '<p class="muted">Stopped.</p>';
      else if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
        ans.innerHTML = '<p>Claude isn’t available on this page, so the help buttons are hidden now. Everything else keeps working.</p>';
        S.caps.sample = null;
        capsChanged();
      } else if (code === 'rate_limited') ans.innerHTML = keep + '<p class="muted">Claude is busy or a usage limit was reached. Try again in a little while.</p>';
      else if (code === 'refused') ans.innerHTML = '<p>Claude didn’t answer this one. Try asking differently.</p>';
      else if (code === 'session_expired') ans.innerHTML = '<p>Your session has expired. Sign in again to ask Claude.</p>';
      else ans.innerHTML = keep + '<p class="muted">Something went wrong. Try again.</p>';
      decorate(ans);
    } finally {
      if (ctl === my) { ctl = null; footer(kind, false); }
    }
  }
  sheet.addEventListener('click', e => {
    const b = e.target.closest('[data-cl]');
    if (!b) return;
    const a = b.dataset.cl;
    if (a === 'close') close();
    else if (a === 'stop') { if (ctl) ctl.abort(); }
    else if (a === 'use') {
      const pre = b.closest('.use-row').previousElementSibling;
      const sql = pre && pre.dataset.sql;
      if (sql) { Editor.appendBlock(sql); toast('Added to the editor and selected. Run it to check.', { icon: 'code' }); }
    } else if (a === 'ask') submitWrite();
  });
  sheet.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'cl-q') { e.preventDefault(); submitWrite(); } });
  function submitWrite() {
    const q = $('#cl-q');
    const question = q && q.value.trim();
    if (!question) { if (q) q.focus(); return; }
    ask('write', { question });
  }
  function close() { if (ctl) ctl.abort(); sheet.hidden = true; sheet.innerHTML = ''; }
  return { init, ask, close, isOpen: () => !sheet.hidden };
})();
