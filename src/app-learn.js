/* ===== app-learn: lessons, checked exercises, reference, history, task strip ===== */
const Learn = (() => {
  const box = $('#side-learn');
  const L = QL.LESSONS;
  const index = [];
  L.forEach((les, li) => les.exercises.forEach((ex, i) => index.push({ les, li, ex, i })));
  const total = index.length;
  const hints = {}, sol = {}, fb = {}, expectedCache = {}, choiceSel = {}, revealed = {}, wrongPicks = {};
  const isChoice = ex => ex.kind === 'choice';
  const changesData = ex => !!(ex.verify || ex.asserts || ex.textAsserts);
  const hasExpected = ex => !isChoice(ex) && (!(ex.asserts || ex.textAsserts) || !!ex.show);
  const lessonBy = id => L.find(x => x.id === id);
  const lessonIndex = id => L.findIndex(x => x.id === id);
  const dsOf = (les, ex) => ex.db || les.db;
  const doneCount = () => index.filter(x => S.progress[x.ex.id]).length;
  const cur = () => { if (!S.lesson) return null; const les = lessonBy(S.lesson.id); return les ? { les, li: lessonIndex(les.id), ex: les.exercises[S.lesson.ex], i: S.lesson.ex } : null; };
  const taskText = ex => ex.task.replace(/<span class="ds-note">[\s\S]*?<\/span>/, '');
  const namesFor = dsId => { const e = S.dbs.get(dsId); return new Set(((e && e.schema && e.schema.order) || (dsMeta(dsId) || {}).order || []).map(x => x.toLowerCase())); };

  function render() {
    updateCount();
    if (S.lesson && cur()) renderLesson(); else { S.lesson = null; renderList(); }
    updateStrip();
  }
  function rerender() { const st = box.scrollTop; render(); box.scrollTop = st; }
  function updateCount() { $('#learn-count').textContent = `${doneCount()}/${total}`; }

  function renderList() {
    const done = doneCount();
    let html = `<div class="progress"><div class="progress-top"><span>Your progress</span><span>${done} of ${total} exercises</span></div><div class="bar"><span style="width:${(done / total * 100).toFixed(1)}%"></span></div></div>`;
    if (!S.prefs.welcomeDone) {
      html += `<div class="welcome"><button class="icon-btn icon-sm" type="button" data-act="dismiss" aria-label="Hide this note">${icon('x', 'ic-sm')}</button>
        <h3>Learn SQL by doing</h3>
        <p>${L.length} short lessons, from your first SELECT to normal forms and window functions. Every exercise is checked automatically and comes with hints.</p>
        <div class="row"><button class="btn btn-primary btn-sm" type="button" data-act="start">${icon('play', 'ic-sm')} Start lesson 1</button><button class="btn btn-sm" type="button" data-act="tour">${icon('help', 'ic-sm')} Quick tour</button></div></div>`;
    }
    for (const track of QL.TRACKS) {
      const items = L.filter(x => x.track === track);
      html += `<h3 class="track">${esc(track)}</h3><ol class="lessons">${items.map(les => {
        const d = les.exercises.filter(ex => S.progress[ex.id]).length;
        const all = d === les.exercises.length;
        return `<li><button class="lesson-btn${all ? ' done' : d ? ' part' : ''}" type="button" data-lesson="${les.id}"><span class="lnum">${all ? icon('check', 'ic-sm') : lessonIndex(les.id) + 1}</span><span class="ltitle">${esc(les.title)}</span><span class="lstat">${d}/${les.exercises.length}</span></button></li>`;
      }).join('')}</ol>`;
    }
    box.innerHTML = html;
  }
  function renderLesson() {
    const { les, li, ex, i } = cur();
    const e = S.dbs.get(les.db);
    let intro = '';
    les.intro.forEach((b, k) => {
      intro += typeof b === 'string' ? b
        : `<div class="example"><pre class="sql">${QL.highlight(b.sql, namesFor(les.db))}</pre><div class="ex-bar"><button class="btn btn-xs" type="button" data-act="ex-edit" data-k="${k}">${icon('code', 'ic-sm')} Copy to editor</button><button class="btn btn-xs btn-primary" type="button" data-act="ex-run" data-k="${k}">${icon('play', 'ic-sm')} Run</button></div></div>`;
    });
    const dots = les.exercises.map((x, k) => `<button class="ex-dot${S.progress[x.id] ? ' done' : ''}" type="button" data-ex="${k}" aria-label="Exercise ${k + 1}${S.progress[x.id] ? ' (solved)' : ''}" aria-current="${k === i}">${k + 1}</button>`).join('');
    const prev = L[li - 1], next = L[li + 1];
    box.innerHTML = `<button class="back" type="button" data-act="back">${icon('left', 'ic-sm')} All lessons</button>
      <div class="lesson-meta"><span>Lesson ${li + 1} of ${L.length}</span><span>·</span><span>${esc(les.track)}</span><span class="ds-chip">${icon(e.icon, 'ic-sm')} ${esc(e.name)}</span></div>
      <h2 class="lesson-title">${esc(les.title)}</h2>
      <div class="lesson-intro">${intro}</div>
      <div class="exercises"><div class="ex-nav"><span class="eyebrow">Exercises</span>${dots}</div>${exerciseHTML(les, li, ex, i)}</div>
      <div class="lesson-foot">${prev ? `<button class="btn btn-sm" type="button" data-lesson="${prev.id}">${icon('left', 'ic-sm')} Lesson ${li}</button>` : '<span></span>'}${next ? `<button class="btn btn-sm" type="button" data-lesson="${next.id}">Lesson ${li + 2}: ${esc(next.title)} ${icon('right', 'ic-sm')}</button>` : ''}</div>`;
  }
  function exerciseHTML(les, li, ex, i) {
    const done = S.progress[ex.id];
    const exHints = ex.hints || [];
    const hs = hints[ex.id] || 0;
    const more = hs < exHints.length;
    const solved = done ? `<span class="ds-chip" style="color:var(--ok);background:var(--ok-soft)">${icon('check', 'ic-sm')} solved</span>` : '';
    const hintBtn = more ? `<button class="btn btn-sm" type="button" data-act="hint">${icon('bulb', 'ic-sm')} ${hs ? `Hint ${hs + 1} of ${exHints.length}` : 'Hint'}</button>` : '';
    const hintList = hs ? `<div class="hints">${exHints.slice(0, hs).map((t, k) => `<div class="hint"><b>Hint ${k + 1}.</b> ${t}</div>`).join('')}</div>` : '';
    if (isChoice(ex)) {
      const multi = Array.isArray(ex.answer);
      const sel = choiceSel[ex.id] || new Set();
      const want = new Set([].concat(ex.answer));
      const rv = revealed[ex.id];
      const out = wrongPicks[ex.id] || new Set();
      const opts = ex.options.map((o, k) => {
        const cls = (sel.has(k) ? ' on' : '') + (rv && want.has(k) ? ' right' : '') + ((rv && sel.has(k) && !want.has(k)) || (!rv && out.has(k)) ? ' wrong' : '');
        return `<label class="choice${cls}"><input type="${multi ? 'checkbox' : 'radio'}" name="choice-${ex.id}" data-choice="${k}"${sel.has(k) ? ' checked' : ''}><span>${o}</span></label>`;
      }).join('');
      return `<div class="ex-card" id="ex-card">
        <div class="ex-head"><span>Exercise ${li + 1}.${i + 1}</span><span>· ${multi ? 'several answers' : 'one answer'}</span>${solved}</div>
        <p class="ex-task">${ex.task}</p>
        <div class="choices" role="${multi ? 'group' : 'radiogroup'}" aria-label="Answers">${opts}</div>
        <div class="ex-actions">
          <button class="btn btn-primary btn-sm" type="button" data-act="check">${icon('check', 'ic-sm')} Check answer</button>
          ${hintBtn}
          ${rv ? '' : '<button class="btn btn-sm btn-ghost" type="button" data-act="reveal">Show the answer</button>'}
        </div>
        ${hintList}
        <div aria-live="polite">${fb[ex.id] || ''}</div>
      </div>`;
    }
    return `<div class="ex-card" id="ex-card">
      <div class="ex-head"><span>Exercise ${li + 1}.${i + 1}</span>${solved}${changesData(ex) ? '<span>· changes data</span>' : ''}</div>
      <p class="ex-task">${ex.task}</p>
      <div class="ex-actions">
        <button class="btn btn-primary btn-sm" type="button" data-act="check">${icon('check', 'ic-sm')} Check answer</button>
        ${hintBtn}
        ${hasExpected(ex) ? '<button class="btn btn-sm btn-ghost" type="button" data-act="expected">Expected result</button>' : ''}
        <button class="btn btn-sm btn-ghost" type="button" data-act="solution">${sol[ex.id] ? 'Hide solution' : 'Solution'}</button>
        ${S.caps.sample ? `<button class="btn btn-sm btn-claude" type="button" data-act="nudge">${icon('sparkle', 'ic-sm')} Nudge from Claude</button>` : ''}
      </div>
      ${hintList}
      <div aria-live="polite">${fb[ex.id] || ''}</div>
      ${sol[ex.id] ? `<div class="solution"><pre class="sql">${QL.highlight(ex.solution, namesFor(dsOf(les, ex)))}</pre><div class="row"><button class="btn btn-xs" type="button" data-act="use-solution">${icon('code', 'ic-sm')} Put it in the editor</button></div></div>` : ''}
    </div>`;
  }
  function starter(les, ex) {
    const n = `${lessonIndex(les.id) + 1}.${les.exercises.indexOf(ex) + 1}`;
    const words = plain(taskText(ex)).replace(/\s+/g, ' ').trim().split(' ');
    const lines = [];
    let line = `-- Exercise ${n}:`;
    for (const w of words) {
      if ((line + ' ' + w).length > 76) { lines.push(line); line = '-- ' + w; } else line += ' ' + w;
    }
    lines.push(line);
    return lines.join('\n') + '\n\n';
  }
  function activate() {
    const { les, ex } = cur();
    const ds = dsOf(les, ex);
    if (S.active !== ds) {
      setActive(ds);
      toast(`This exercise uses the <b>${esc(S.dbs.get(ds).name)}</b> database.`, { icon: S.dbs.get(ds).icon });
    }
    if (ex.setup) {
      const e = active();
      const before = new Set(e.schema.order);
      const r = QL.runSQL(e.db, ex.setup);
      if (!r.error) {
        Results.afterRun(e, r);
        const added = e.schema.order.filter(n => !before.has(n));
        if (added.length) toast(`Created ${added.map(n => `<code>${esc(n)}</code>`).join(' and ')} so you can start this exercise.`, { icon: 'table' });
      }
    }
    if (isChoice(ex)) { Editor.setContext('ds:' + ds); return; }
    Editor.setContext('ex:' + ex.id, starter(les, ex));
    if (changesData(ex) && S.mode !== 'editor') setMode('editor');
  }
  function openLesson(id, exIdx) {
    const les = lessonBy(id);
    if (!les) return;
    let first = exIdx != null ? exIdx : les.exercises.findIndex(x => !S.progress[x.id]);
    if (first < 0) first = 0;
    S.lesson = { id, ex: first };
    activate();
    render();
    box.scrollTop = 0;
  }
  function openExercise(i) {
    if (!S.lesson) return;
    Editor.saveBuffer();
    S.lesson.ex = i;
    activate();
    rerender();
    const card = $('#ex-card');
    if (card) card.scrollIntoView({ block: 'nearest' });
  }
  function closeLesson() {
    Editor.saveBuffer();
    S.lesson = null;
    Editor.setContext('ds:' + S.active);
    render();
    box.scrollTop = 0;
  }
  function nextTarget() {
    const c = cur();
    if (!c) return null;
    if (c.i + 1 < c.les.exercises.length) return { label: 'Next exercise', go: () => openExercise(c.i + 1) };
    if (L[c.li + 1]) return { label: 'Next lesson', go: () => openLesson(L[c.li + 1].id, 0) };
    return null;
  }
  function expectedFor(les, ex) {
    if (expectedCache[ex.id]) return expectedCache[ex.id];
    const e = ensureBuilt(dsOf(les, ex));
    const r = QL.runCheck(S.SQL, e.pristine, ex, ex.solution);
    if (r.expected) expectedCache[ex.id] = r.expected;
    return r.expected || null;
  }

  function markSolved(ex) {
    const first = !S.progress[ex.id];
    S.progress[ex.id] = Date.now();
    store.set('progress', S.progress);
    return first;
  }
  function okBox(first, extra, compare) {
    const nx = nextTarget();
    return `<div class="fb ok"><div class="fb-title">${icon('check', 'ic-sm')} ${first ? 'Correct!' : 'Correct again.'}</div>${extra || ''}
      <div class="row">${nx ? `<button class="btn btn-sm btn-ok" type="button" data-act="next">${nx.label} ${icon('right', 'ic-sm')}</button>` : '<span>That was the last exercise. Well done.</span>'}${compare ? '<button class="btn btn-sm btn-ghost" type="button" data-act="solution">Compare with the model solution</button>' : ''}</div></div>`;
  }
  const hintButton = ex => (hints[ex.id] || 0) < (ex.hints || []).length ? `<button class="btn btn-xs" type="button" data-act="hint">${icon('bulb', 'ic-sm')} Get a hint</button>` : '';
  // After feedback was stored: redraw, celebrate, keep the feedback in view, and tell people who can't see the panel.
  function afterFeedback(c, status, msg) {
    rerender();
    updateCount();
    if (status === 'ok') {
      const dot = box.querySelector(`.ex-dot[data-ex="${c.i}"]`);
      if (dot) dot.classList.add('pop-in');
    }
    const fbEl = box.querySelector('#ex-card .fb');
    if (fbEl) {
      const br = box.getBoundingClientRect(), fr = fbEl.getBoundingClientRect();
      if (fr.bottom > br.bottom) box.scrollTop += fr.bottom - br.bottom + 12;
    }
    if (!sideVisible()) {
      if (status === 'ok') { const nx = nextTarget(); toast(`${icon('check', 'ic-sm')} Correct!`, nx ? { action: { label: nx.label, run: nx.go } } : {}); }
      else toast(status === 'fail' && msg ? `Not quite: ${msg}` : 'Not quite yet. Open the lesson for details.', { action: { label: 'Open lesson', run: showSide } });
    }
  }

  function checkChoice(c) {
    const { ex } = c;
    const multi = Array.isArray(ex.answer);
    const want = new Set([].concat(ex.answer));
    const sel = choiceSel[ex.id] || new Set();
    let html, status = 'fail', msg = '';
    if (!sel.size) {
      status = 'empty';
      html = `<div class="fb fail"><div class="fb-title">${icon('info', 'ic-sm')} Pick an answer first</div><div>${multi ? 'Tick every answer you think is right, then check.' : 'Choose one answer, then check.'}</div></div>`;
    } else {
      const wrong = [...sel].filter(k => !want.has(k)).length;
      const missing = [...want].filter(k => !sel.has(k)).length;
      if (!wrong && !missing) {
        status = 'ok';
        revealed[ex.id] = true;
        html = okBox(markSolved(ex), `<div>${ex.explain}</div>`, false);
      } else {
        const n = (k, one, many) => k === 1 ? one : `${k} ${many}`;
        if (!multi) msg = 'That’s not the best answer. Think it through once more.';
        else if (wrong && missing) msg = `${n(wrong, 'One of your ticks is', 'of your ticks are')} wrong, and ${n(missing, 'one right answer is', 'right answers are')} still missing.`;
        else if (wrong) msg = `You found every right answer, but ${n(wrong, 'one tick is', 'ticks are')} too many.`;
        else msg = `Everything you ticked is right, but ${n(missing, 'one more answer is', 'more answers are')} right too.`;
        if (!multi) (wrongPicks[ex.id] = wrongPicks[ex.id] || new Set()).add([...sel][0]);
        html = `<div class="fb fail"><div class="fb-title">${icon('alert', 'ic-sm')} Not quite</div><div>${msg}</div>${hintButton(ex) ? `<div class="row">${hintButton(ex)}</div>` : ''}</div>`;
      }
    }
    fb[ex.id] = html;
    afterFeedback(c, status, msg);
  }
  function revealChoice(c) {
    const { ex } = c;
    revealed[ex.id] = true;
    fb[ex.id] = `<div class="fb info"><div class="fb-title">${icon('info', 'ic-sm')} The answer</div><div>${ex.explain}</div><div class="muted">The right ${Array.isArray(ex.answer) ? 'answers are' : 'answer is'} marked in green.</div></div>`;
    rerender();
  }

  // The check failed because the editor lacks statements the learner already ran (a table or column it
  // mentions exists in the live database but not in a fresh copy).
  function builtEarlier(msg, e) {
    const m = /no such (table|column): (.+)$/.exec(msg || '');
    if (!m) return false;
    const name = m[2].trim().split('.').pop().toLowerCase();
    const sch = e.schema;
    if (m[1] === 'table') return sch.order.some(t => t.toLowerCase() === name);
    return sch.order.some(t => sch.tables[t].columns.some(col => col.name.toLowerCase() === name));
  }

  function check() {
    const c = cur();
    if (!c) return;
    const { les, ex } = c;
    if (isChoice(ex)) { checkChoice(c); return; }
    const ds = dsOf(les, ex);
    if (S.active !== ds) setActive(ds);
    const e = active();
    const sql = currentSQL();
    let r = QL.runCheck(S.SQL, e.pristine, ex, sql);
    if (r.status === 'error' && builtEarlier(r.error.message, e)) {
      const lr = QL.checkLive(S.SQL, e.pristine, ex, e.db, sql);
      if (lr) r = lr;
    }
    if (r.expected) expectedCache[ex.id] = r.expected;
    const liveNote = !r.live ? '' : `<div class="muted">${r.live === 'editor' ? 'Your editor holds only the last steps, so they were checked on top of what you ran before. Run them too, so your database has them.' : 'Your editor holds only part of the steps, so this checked your database as it is now.'}</div>`;
    let html;
    if (r.status === 'ok') {
      html = okBox(markSolved(ex), `${r.note ? `<div>${r.note}</div>` : ''}${r.tip ? `<div class="muted">${r.tip}</div>` : ''}${liveNote}`, true);
    } else if (r.status === 'error') {
      const x = QL.explainError(r.error.message, sql, errorContext());
      const fresh = changesData(ex) && /no such (table|column)/.test(r.error.message) ? '<div class="muted">The check runs everything in the editor on a fresh copy of the original data, so the editor needs every step.</div>' : '';
      html = `<div class="fb err"><div class="fb-title">${icon('alert', 'ic-sm')} ${x.title}</div><div style="font-family:var(--f-mono);font-size:12px;color:var(--err)">${esc(r.error.message)}</div>${x.hints.length ? `<ul>${x.hints.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}${fresh}</div>`;
    } else if (r.status === 'empty') {
      html = `<div class="fb fail"><div class="fb-title">${icon('info', 'ic-sm')} Nothing to check yet</div><div>${S.mode === 'builder' ? 'Put a table on the canvas and tick the columns you need, or switch to the SQL editor.' : 'Write your SQL in the editor, then check it.'}</div></div>`;
    } else if (r.status === 'internal') {
      html = `<div class="fb err"><div class="fb-title">This exercise has a problem</div><div>${esc(r.msg)}</div></div>`;
    } else {
      html = `<div class="fb fail"><div class="fb-title">${icon('alert', 'ic-sm')} Not quite</div><div>${r.msg}</div>${r.hint ? `<div class="muted">${r.hint}</div>` : ''}${liveNote}
        ${e.dirty && !changesData(ex) ? `<div class="muted" style="margin-top:6px">You changed this database earlier. Checks always use the original data, so your own result can differ. <button class="btn btn-xs" type="button" data-act="reset-db">Reset data</button></div>` : ''}
        <div class="row">${hasExpected(ex) ? '<button class="btn btn-xs" type="button" data-act="expected">Compare with the expected result</button>' : ''}${hintButton(ex)}</div></div>`;
    }
    fb[ex.id] = html;
    // main results panel
    if (r.status === 'error') {
      Results.show({ results: [], error: r.error, sql, source: S.mode, count: 1 });
    } else if (!changesData(ex) && (r.status === 'ok' || r.status === 'fail')) {
      Results.run(sql, { source: S.mode });
      if (r.status === 'fail' && r.expected) Results.addPanel({ id: 'expected', title: 'Expected', data: r.expected, label: 'what a correct answer returns' });
    } else if (changesData(ex) && (r.status === 'ok' || r.status === 'fail') && r.expected) {
      Results.showData({ title: 'Expected', data: r.expected, label: r.live ? 'what a correct database contains' : 'checked on a fresh copy of the data', other: r.got ? { title: r.live ? 'Your database' : 'After your SQL', data: r.got } : null, focus: 'y' });
    }
    afterFeedback(c, r.status, r.msg);
  }
  // Exercise setups (tables an exercise builds on) are created when it opens; put them back after a reset.
  function reapplySetup(id) {
    const c = cur();
    if (!c || !c.ex.setup || dsOf(c.les, c.ex) !== id) return;
    const e = S.dbs.get(id);
    const r = QL.runSQL(e.db, c.ex.setup);
    if (!r.error) e.schema = readSchema(e);
  }
  function showSide() { if (MQ_MID.matches) openDrawer('side'); else { S.prefs.sideOff = false; savePrefs(); applyLayout(); afterLayout(); } Side.setTab('learn'); }
  function showExpected() {
    const c = cur();
    if (!c) return;
    const data = expectedFor(c.les, c.ex);
    if (!data) return;
    const ds = dsOf(c.les, c.ex);
    if (S.active !== ds) setActive(ds);
    const changes = changesData(c.ex);
    if (Results.current() && !changes) Results.addPanel({ id: 'expected', title: 'Expected', data, label: 'what a correct answer returns' }, true);
    else Results.showData({ title: 'Expected result', data, label: changes ? 'the data after a correct solution' : 'what a correct answer returns' });
    if (MQ_MID.matches) closeDrawers();
    if (MQ_NARROW.matches) $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function exampleSql(k) { const c = cur(); return c && c.les.intro[k] && c.les.intro[k].sql; }

  box.addEventListener('click', e => {
    const a = e.target.closest('[data-act], [data-lesson], [data-ex]');
    if (!a) return;
    if (a.dataset.lesson) { openLesson(a.dataset.lesson); return; }
    if (a.dataset.ex != null && !a.dataset.act) { openExercise(+a.dataset.ex); return; }
    const c = cur();
    switch (a.dataset.act) {
      case 'dismiss': S.prefs.welcomeDone = true; savePrefs(); renderList(); break;
      case 'start': S.prefs.welcomeDone = true; savePrefs(); openLesson(L[0].id); break;
      case 'tour': Tour.start(); break;
      case 'back': closeLesson(); break;
      case 'ex-run': {
        const sql = exampleSql(+a.dataset.k);
        if (!sql) break;
        if (S.active !== c.les.db) setActive(c.les.db);
        Results.run(sql, { source: 'example', noHistory: true, title: 'Example', previewSql: sql });
        if (MQ_MID.matches) closeDrawers();
        if (MQ_NARROW.matches) $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'ex-edit': {
        const sql = exampleSql(+a.dataset.k);
        if (!sql) break;
        if (S.active !== c.les.db) setActive(c.les.db);
        Editor.appendBlock(sql);
        toast('Added to the editor and selected. Run it to see the result.', { icon: 'code' });
        if (MQ_MID.matches) closeDrawers();
        break;
      }
      case 'check': check(); break;
      case 'reveal': if (c && isChoice(c.ex)) revealChoice(c); break;
      case 'hint': if (c) { hints[c.ex.id] = (hints[c.ex.id] || 0) + 1; rerender(); } break;
      case 'expected': showExpected(); break;
      case 'solution': if (c) { sol[c.ex.id] = !sol[c.ex.id]; rerender(); } break;
      case 'use-solution': if (c) { setMode('editor'); Editor.replaceAll(c.ex.solution); toast('The model solution is in the editor. Run it or check it.', { icon: 'code' }); } break;
      case 'next': { const nx = nextTarget(); if (nx) nx.go(); break; }
      case 'reset-db': resetDataset(S.active); break;
      case 'nudge':
        if (c) Claude.ask('nudge', { task: plain(taskText(c.ex)), sql: currentSQL(), feedback: fb[c.ex.id] ? plain(fb[c.ex.id]).replace(/\s+/g, ' ').trim().slice(0, 400) : '' });
        break;
    }
  });

  box.addEventListener('change', e => {
    const inp = e.target.closest('[data-choice]');
    const c = cur();
    if (!inp || !c || !isChoice(c.ex)) return;
    const k = +inp.dataset.choice;
    if (Array.isArray(c.ex.answer)) {
      const sel = choiceSel[c.ex.id] = choiceSel[c.ex.id] || new Set();
      if (inp.checked) sel.add(k); else sel.delete(k);
    } else choiceSel[c.ex.id] = new Set([k]);
    const sel = choiceSel[c.ex.id];
    box.querySelectorAll('#ex-card .choice').forEach((lab, j) => lab.classList.toggle('on', sel.has(j)));
  });

  function updateStrip() {
    const strip = $('#task-strip');
    const c = cur();
    const vis = !!c && !sideVisible();
    strip.hidden = !vis;
    if (!vis) return;
    strip.innerHTML = `<span class="ts-num">${c.li + 1}.${c.i + 1}</span><span class="ts-text">${taskText(c.ex)}</span>${isChoice(c.ex)
      ? `<button class="btn btn-sm btn-primary" type="button" data-strip="open">Answer in the lesson</button>`
      : `<button class="btn btn-sm btn-primary" type="button" data-strip="check">${icon('check', 'ic-sm')} Check</button><button class="btn btn-sm" type="button" data-strip="open">Lesson</button>`}`;
  }
  $('#task-strip').addEventListener('click', e => {
    const b = e.target.closest('[data-strip]');
    if (!b) return;
    if (b.dataset.strip === 'check') check(); else showSide();
  });

  return { render, updateStrip, updateCount, openLesson, check, reapplySetup, total };
})();

const Side = (() => {
  function setTab(tab) {
    S.prefs.sideTab = tab; savePrefs();
    $$('.side-tabs [role="tab"]').forEach(b => b.setAttribute('aria-selected', b.dataset.side === tab));
    $('#side-learn').hidden = tab !== 'learn';
    $('#side-ref').hidden = tab !== 'ref';
    $('#side-hist').hidden = tab !== 'hist';
    if (tab === 'ref' && !$('#side-ref').dataset.ready) renderRef();
    if (tab === 'hist') renderHistory();
  }
  const REF = [
    { t: 'How a query is evaluated', html: '<p>You write the clauses in one order, but the database works through them in another:</p><ol class="steps"><li>FROM and JOIN</li><li>WHERE</li><li>GROUP BY</li><li>HAVING</li><li>SELECT</li><li>ORDER BY</li><li>LIMIT</li></ol><p>That is why WHERE can’t use a name you gave a column in SELECT, but ORDER BY can.</p>' },
    { t: 'Filter rows', items: [['Compare', "WHERE price >= 20"], ['Several conditions', "WHERE country = 'Germany' AND newsletter = 1"], ['Text pattern', "WHERE name LIKE 'S%'"], ['List of values', "WHERE status IN ('shipped', 'delivered')"], ['Range (inclusive)', "WHERE order_date BETWEEN '2026-01-01' AND '2026-03-31'"], ['Missing values', 'WHERE phone IS NULL']] },
    { t: 'Sort and limit', items: [['Sort', 'ORDER BY price DESC, name'], ['First rows only', 'LIMIT 10'], ['Skip rows (paging)', 'LIMIT 10 OFFSET 20'], ['Unique rows', 'SELECT DISTINCT country FROM customers;']] },
    { t: 'Summaries', items: [['Count rows', 'SELECT COUNT(*) FROM orders;'], ['Count different values', 'COUNT(DISTINCT customer_id)'], ['Total and average', 'SUM(quantity), ROUND(AVG(price), 2)'], ['One row per group', 'SELECT country, COUNT(*) FROM customers\nGROUP BY country;'], ['Filter groups', 'HAVING COUNT(*) > 5']] },
    { t: 'Joins', joins: true, items: [['Only matching rows', 'SELECT * FROM orders\nJOIN customers ON orders.customer_id = customers.id;'], ['All rows of the left table', 'SELECT * FROM customers\nLEFT JOIN orders ON orders.customer_id = customers.id;'], ['All rows of the right table', 'RIGHT JOIN orders ON orders.customer_id = customers.id'], ['All rows of both', 'FULL OUTER JOIN orders ON orders.customer_id = customers.id'], ['Every combination', 'CROSS JOIN categories']] },
    { t: 'Subqueries and WITH', items: [['A single value', 'WHERE price > (SELECT AVG(price) FROM products)'], ['A list of values', 'WHERE id IN (SELECT customer_id FROM orders)'], ['Exists', 'WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = customers.id)'], ['Named step (CTE)', 'WITH free_shipping AS (\n  SELECT * FROM orders WHERE shipping_cost = 0\n)\nSELECT COUNT(*) FROM free_shipping;']] },
    { t: 'Change data', items: [['Insert', "INSERT INTO categories (name) VALUES ('Pet Supplies');"], ['Update', 'UPDATE products SET stock = stock - 1 WHERE id = 3;'], ['Delete', "DELETE FROM orders WHERE status = 'cancelled';"], ['All or nothing', 'BEGIN;\nUPDATE products SET stock = stock - 1 WHERE id = 3;\nCOMMIT;']] },
    { t: 'Create and change tables', items: [['Create', 'CREATE TABLE notes (\n  id      INTEGER PRIMARY KEY,\n  text    TEXT NOT NULL,\n  created DATE DEFAULT CURRENT_DATE\n);'], ['Add a column', 'ALTER TABLE notes ADD COLUMN pinned BOOLEAN DEFAULT 0;'], ['Rename', 'ALTER TABLE notes RENAME TO memos;'], ['Delete a table', 'DROP TABLE memos;'], ['Saved query (view)', 'CREATE VIEW big_orders AS\nSELECT * FROM orders WHERE shipping_cost = 0;'], ['Index', 'CREATE INDEX idx_orders_date ON orders (order_date);']] },
    { t: 'Text functions', items: [['Join text', "first_name || ' ' || last_name"], ['Upper / lower case', 'UPPER(city), LOWER(email)'], ['Part of a text', 'SUBSTR(name, 1, 3)'], ['Length', 'LENGTH(name)'], ['Replace', "REPLACE(phone, ' ', '')"], ['Trim spaces', 'TRIM(name)']] },
    { t: 'Dates', items: [['Today', "date('now')"], ['Year, month', "strftime('%Y', order_date), strftime('%m', order_date)"], ['Add days', "date(loan_date, '+28 days')"], ['Days between', 'julianday(return_date) - julianday(loan_date)'], ['German format', "strftime('%d.%m.%Y', order_date)"]] },
    { t: 'Logic and numbers', items: [['If / then', "CASE WHEN stock = 0 THEN 'sold out' ELSE 'available' END"], ['Fallback for NULL', "COALESCE(phone, '–')"], ['Round', 'ROUND(price * 1.19, 2)'], ['Convert type', 'CAST(price AS INTEGER)'], ['Decimal division', 'SUM(seconds_played) / 3600.0']] },
    { t: 'Window functions', items: [['Number rows', 'ROW_NUMBER() OVER (ORDER BY price DESC)'], ['Rank per group', 'RANK() OVER (PARTITION BY department_id ORDER BY salary DESC)'], ['Running total', 'SUM(quantity) OVER (ORDER BY order_id)'], ['Previous row', 'LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date)']] },
    { t: 'SQLite compared with MySQL', html: `<table class="cmp"><thead><tr><th>Task</th><th>MySQL</th><th>SQLite (here)</th></tr></thead><tbody>
      <tr><td>Year of a date</td><td><code>YEAR(d)</code></td><td><code>strftime('%Y', d)</code></td></tr>
      <tr><td>Current time</td><td><code>NOW()</code></td><td><code>datetime('now')</code></td></tr>
      <tr><td>Join text</td><td><code>CONCAT(a, b)</code></td><td><code>a || b</code> (CONCAT works too)</td></tr>
      <tr><td>Auto-numbered id</td><td><code>AUTO_INCREMENT</code></td><td><code>INTEGER PRIMARY KEY</code></td></tr>
      <tr><td>True / false</td><td><code>TRUE</code>, <code>FALSE</code></td><td>stored as <code>1</code>, <code>0</code></td></tr>
      <tr><td>First n rows</td><td><code>LIMIT n</code></td><td><code>LIMIT n</code> (no <code>TOP n</code>)</td></tr>
      <tr><td>Column types</td><td>strict</td><td>flexible: VARCHAR(50) is stored as TEXT</td></tr></tbody></table>` },
    { t: 'Keyboard shortcuts', html: `<table class="cmp"><tbody>
      <tr><td><kbd>${MOD}</kbd> + <kbd>Enter</kbd></td><td>Run the query (or only the selected part)</td></tr>
      <tr><td><kbd>Ctrl</kbd> + <kbd>Space</kbd></td><td>Show suggestions</td></tr>
      <tr><td><kbd>Tab</kbd> / <kbd>Enter</kbd></td><td>Accept a suggestion</td></tr>
      <tr><td><kbd>${MOD}</kbd> + <kbd>/</kbd></td><td>Comment lines in or out</td></tr>
      <tr><td><kbd>${MOD}</kbd> + <kbd>Z</kbd></td><td>Undo</td></tr></tbody></table>` },
  ];
  function renderRef() {
    const box = $('#side-ref');
    box.dataset.ready = '1';
    const venns = [VENN(false, false, true), VENN(true, false), VENN(false, true), VENN(true, true), VENN(true, true)];
    box.innerHTML = `<p class="muted" style="margin:0 0 6px">Patterns to copy. “Insert” puts the snippet into the SQL editor at the cursor.</p>` + REF.map((sec, si) => `<details class="ref-sec"${si === 0 ? ' open' : ''}><summary>${icon('chev', 'ic-sm')}${esc(sec.t)}</summary><div class="ref-body">${sec.html || ''}${(sec.items || []).map((it, ii) => `<div class="ref-item"><div class="ref-item-h">${sec.joins ? `<span style="color:var(--table)">${venns[ii]}</span>` : ''}<span>${esc(it[0])}</span><button class="btn btn-xs" type="button" data-ref="${si}:${ii}">Insert</button></div><pre class="sql">${QL.highlight(it[1], tableSet())}</pre></div>`).join('')}</div></details>`).join('');
  }
  $('#side-ref').addEventListener('click', e => {
    const b = e.target.closest('[data-ref]');
    if (!b) return;
    const [si, ii] = b.dataset.ref.split(':').map(Number);
    const snippet = REF[si].items[ii][1];
    if (/;\s*$/.test(snippet)) Editor.insertBlock(snippet, true); else Editor.insertSmart(snippet);
    if (MQ_MID.matches) closeDrawers();
  });
  const ago = t => {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  function renderHistory() {
    const box = $('#side-hist');
    if (box.hidden) return;
    if (!S.history.length) { box.innerHTML = '<p class="muted">Queries you run appear here, newest first. Click one to load it into the editor.</p>'; return; }
    box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="eyebrow">Recent queries</span><button class="btn btn-xs" type="button" data-h="clear">${icon('trash', 'ic-sm')} Clear</button></div>
      <ul class="hist-list">${S.history.map((x, i) => `<li><button class="hist-item" type="button" data-h="${i}"><div class="hist-meta"><span>${ago(x.t)}</span><span>·</span><span>${esc((S.dbs.get(x.db) || {}).name || x.db)}</span>${x.err ? '<span class="err">· error</span>' : ''}</div><pre class="hist-sql sql">${QL.highlight(x.sql.slice(0, 400), null)}</pre></button></li>`).join('')}</ul>`;
  }
  $('#side-hist').addEventListener('click', e => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    if (b.dataset.h === 'clear') {
      const snap = S.history.slice();
      S.history = []; store.set('history', S.history); renderHistory();
      toast('History cleared.', { action: { label: 'Undo', run: () => { S.history = snap; store.set('history', S.history); renderHistory(); } } });
      return;
    }
    const x = S.history[+b.dataset.h];
    if (!x) return;
    if (x.db !== S.active && S.dbs.has(x.db)) setActive(x.db);
    setMode('editor');
    Editor.replaceAll(x.sql);
    if (MQ_MID.matches) closeDrawers();
    toast('Loaded into the editor. Undo with ' + MOD + '+Z.', { icon: 'code' });
  });
  $$('.side-tabs [role="tab"]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.side)));
  return { setTab, renderRef, renderHistory };
})();
