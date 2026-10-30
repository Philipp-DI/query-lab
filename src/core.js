/* Query Lab — core logic (no DOM): SQL tokens, builder → SQL, error hints, import parsing, result checks. */
(function (G) {
  'use strict';
  const QL = G.QL || (G.QL = {});

  // ---------------------------------------------------------------- utils
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const code = s => `<code>${esc(s)}</code>`;
  QL.esc = esc;

  // words SQLite refuses as bare column/table names (measured against the engine)
  const RESERVED = new Set('ADD ALL ALTER AND AS AUTOINCREMENT BETWEEN CASE CAST CHECK COLLATE COMMIT CONSTRAINT CREATE DEFAULT DEFERRABLE DELETE DISTINCT DROP ELSE ESCAPE EXCEPT EXISTS FOREIGN FROM GROUP HAVING IN INDEX INSERT INTERSECT INTO IS ISNULL JOIN LIMIT NOT NOTHING NOTNULL NULL ON OR ORDER PRIMARY RAISE REFERENCES RETURNING SELECT SET TABLE THEN TO TRANSACTION UNION UNIQUE UPDATE USING VALUES WHEN WHERE'.split(' '));
  const KEYWORDS = new Set([...RESERVED, ...'ABORT ACTION AFTER ANALYZE ASC ATTACH BEFORE BEGIN BY CASCADE COLUMN CONFLICT CROSS CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP DATABASE DEFERRED DESC DETACH DO EACH END EXCLUSIVE EXPLAIN FAIL FILTER FIRST FOLLOWING FOR FULL GLOB IF IGNORE IMMEDIATE INDEXED INITIALLY INNER INSTEAD KEY LAST LEFT LIKE MATCH NATURAL NO NULLS OF OFFSET OUTER OVER PARTITION PLAN PRAGMA PRECEDING QUERY RANGE RECURSIVE REGEXP REINDEX RELEASE RENAME REPLACE RESTRICT RIGHT ROLLBACK ROW ROWS SAVEPOINT TEMP TEMPORARY TIES TRIGGER UNBOUNDED VACUUM VIEW VIRTUAL WINDOW WITH WITHOUT TRUE FALSE INTEGER REAL TEXT BLOB NUMERIC VARCHAR CHAR DECIMAL DATE DATETIME BOOLEAN INT FLOAT DOUBLE'.split(' ')]);
  const FUNCTIONS = new Set('COUNT SUM AVG MIN MAX TOTAL GROUP_CONCAT ROUND ABS CEIL FLOOR POWER SQRT MOD RANDOM UPPER LOWER LENGTH SUBSTR SUBSTRING TRIM LTRIM RTRIM REPLACE INSTR CONCAT CONCAT_WS PRINTF FORMAT COALESCE IFNULL NULLIF IIF CAST DATE TIME DATETIME JULIANDAY STRFTIME UNIXEPOCH ROW_NUMBER RANK DENSE_RANK NTILE LAG LEAD FIRST_VALUE LAST_VALUE PERCENT_RANK CUME_DIST TYPEOF HEX QUOTE CHAR UNICODE SIGN'.split(' '));
  QL.KEYWORDS = KEYWORDS; QL.FUNCTIONS = FUNCTIONS;
  // keywords offered by autocomplete, most useful first
  QL.AC_KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS NULL', 'IS NOT NULL', 'LIKE', 'BETWEEN', 'AS', 'DISTINCT', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'ASC', 'DESC', 'UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NOT NULL', 'UNIQUE', 'DEFAULT', 'CHECK', 'ALTER TABLE', 'ADD COLUMN', 'DROP TABLE', 'CREATE VIEW', 'WITH', 'OVER', 'PARTITION BY', 'INTEGER', 'TEXT', 'REAL', 'VARCHAR', 'DECIMAL', 'DATE', 'BOOLEAN', 'NULL', 'BEGIN', 'COMMIT', 'ROLLBACK'];

  QL.qi = name => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !RESERVED.has(String(name).toUpperCase())) ? name : '"' + String(name).replace(/"/g, '""') + '"';
  QL.strLit = v => "'" + String(v).replace(/'/g, "''") + "'";
  QL.typeClass = t => {
    t = String(t || '').toUpperCase();
    if (/BOOL/.test(t)) return 'bool';
    if (/DATE|TIME/.test(t)) return 'date';
    if (/INT|REAL|FLOA|DOUB|DEC|NUM/.test(t)) return 'num';
    return 'text';
  };
  const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
  QL.lit = (v, cls) => {
    const s = String(v).trim();
    if (cls === 'bool') {
      if (/^(true|yes|ja|wahr)$/i.test(s)) return '1';
      if (/^(false|no|nein|falsch)$/i.test(s)) return '0';
    }
    if ((cls === 'num' || cls === 'bool') && NUM_RE.test(s)) return s.replace(/^\+/, '');
    return QL.strLit(s);
  };

  QL.lev = (a, b) => {
    a = String(a).toLowerCase(); b = String(b).toLowerCase();
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  };
  QL.closest = (word, cands, max) => {
    const lim = max != null ? max : Math.max(1, Math.min(3, Math.floor(String(word).length / 3)));
    let best = null, bd = Infinity;
    for (const c of cands) {
      const d = QL.lev(word, c);
      if (d > 0 && d <= lim && d < bd) { bd = d; best = c; }
    }
    return best;
  };

  // ---------------------------------------------------------------- tokens & highlighting
  const TOK = /(--[^\n]*)|(\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?|`[^`\n]*`?|\[[^\]\n]*\]?)|(\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|\.\d+)|([A-Za-z_À-￿][A-Za-z0-9_$À-￿]*)|(\s+)|(<>|<=|>=|!=|==|\|\||[-+*\/%<>=~&|])|([(),;.])|([\s\S])/g;
  QL.tokenize = function (sql) {
    const out = [];
    let m;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(sql))) {
      let t;
      if (m[1] !== undefined || m[2] !== undefined) t = 'com';
      else if (m[3] !== undefined) t = 'str';
      else if (m[4] !== undefined) t = 'qid';
      else if (m[5] !== undefined) t = 'num';
      else if (m[6] !== undefined) t = 'word';
      else if (m[7] !== undefined) t = 'ws';
      else if (m[8] !== undefined) t = 'op';
      else if (m[9] !== undefined) t = 'punc';
      else t = 'other';
      out.push({ t, v: m[0], i: m.index });
    }
    return out;
  };
  QL.highlight = function (sql, tables) {
    const toks = QL.tokenize(sql);
    const nextSig = new Array(toks.length);
    let nx = null;
    for (let k = toks.length - 1; k >= 0; k--) { nextSig[k] = nx; if (toks[k].t !== 'ws' && toks[k].t !== 'com') nx = toks[k]; }
    let html = '';
    for (let k = 0; k < toks.length; k++) {
      const { t, v } = toks[k];
      let cls = null;
      if (t === 'com') cls = 'c';
      else if (t === 'str') cls = 's';
      else if (t === 'num') cls = 'n';
      else if (t === 'qid') cls = 'q';
      else if (t === 'op' || t === 'punc') cls = 'p';
      else if (t === 'word') {
        const U = v.toUpperCase();
        const paren = nextSig[k] && nextSig[k].v === '(';
        if (paren && FUNCTIONS.has(U)) cls = 'f';
        else if (KEYWORDS.has(U)) cls = 'k';
        else if (tables && tables.has(v.toLowerCase())) cls = 't';
        else if (paren) cls = 'f';
        else cls = 'i';
      }
      html += cls ? `<span class="${cls}">${esc(v)}</span>` : esc(v);
    }
    return html;
  };
  // replace an identifier everywhere it appears as a name (never inside strings)
  QL.replaceIdent = function (sql, find, replace) {
    const f = String(find).toLowerCase();
    return QL.tokenize(sql).map(tk => {
      if (tk.t === 'word' && tk.v.toLowerCase() === f) return replace;
      if (tk.t === 'qid' && tk.v.startsWith('"') && tk.v.slice(1, -1).toLowerCase() === f) return replace;
      return tk.v;
    }).join('');
  };
  QL.removeCommaBefore = function (sql, kw) {
    const toks = QL.tokenize(sql);
    const K = String(kw).toUpperCase();
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].v.toUpperCase() !== K) continue;
      let j = i - 1;
      while (j >= 0 && (toks[j].t === 'ws' || toks[j].t === 'com')) j--;
      if (j >= 0 && toks[j].v === ',') { toks[j] = { t: 'ws', v: '' }; return toks.map(t => t.v).join(''); }
    }
    return sql;
  };
  QL.tablesIn = function (sql, tables) {
    const set = new Map(tables.map(t => [t.toLowerCase(), t]));
    const found = [];
    for (const tk of QL.tokenize(sql)) {
      if (tk.t !== 'word' && tk.t !== 'qid') continue;
      const name = (tk.t === 'qid' ? tk.v.slice(1, -1) : tk.v).toLowerCase();
      if (set.has(name) && !found.includes(set.get(name))) found.push(set.get(name));
    }
    return found;
  };
  // FROM/JOIN table [AS] alias → map alias → table (for autocomplete)
  QL.aliases = function (sql, tables) {
    const set = new Map(tables.map(t => [t.toLowerCase(), t]));
    const toks = QL.tokenize(sql).filter(t => t.t !== 'ws' && t.t !== 'com');
    const map = {};
    for (let i = 0; i < toks.length - 1; i++) {
      const U = toks[i].v.toUpperCase();
      if (U !== 'FROM' && U !== 'JOIN' && U !== 'UPDATE' && U !== 'INTO' && toks[i].v !== ',') continue;
      const tn = toks[i + 1];
      const name = (tn.t === 'qid' ? tn.v.slice(1, -1) : tn.v).toLowerCase();
      if (!set.has(name)) continue;
      const table = set.get(name);
      map[name] = table;
      let a = toks[i + 2];
      if (a && a.v.toUpperCase() === 'AS') a = toks[i + 3];
      if (a && a.t === 'word' && !KEYWORDS.has(a.v.toUpperCase())) map[a.v.toLowerCase()] = table;
    }
    return map;
  };

  // ---------------------------------------------------------------- running SQL
  QL.runSQL = function (db, sql, opts) {
    opts = opts || {};
    const maxRows = opts.maxRows || 5000;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const t0 = now();
    const results = [];
    let n = 0;
    try {
      for (const st of db.iterateStatements(sql)) {
        n++;
        const text = st.getSQL().trim();
        try {
          const cols = st.getColumnNames();
          if (cols.length) {
            const values = [];
            let truncated = false;
            while (st.step()) {
              if (values.length >= maxRows) { truncated = true; break; }
              values.push(st.get());
            }
            results.push({ kind: 'rows', columns: cols, values, truncated, sql: text });
          } else {
            while (st.step()) { /* run */ }
            const verb = ((text.replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '').match(/^\w+/) || [''])[0]).toUpperCase();
            const isDml = /^(INSERT|UPDATE|DELETE|REPLACE)$/.test(verb);
            results.push({ kind: 'ok', verb, sql: text, changes: isDml ? db.getRowsModified() : null });
          }
        } finally { st.free(); }
      }
    } catch (e) {
      return { results, error: { message: String(e && e.message || e), index: n }, ms: now() - t0, count: n };
    }
    return { results, ms: now() - t0, count: n };
  };
  QL.lastRows = r => { if (!r || !r.results) return null; for (let i = r.results.length - 1; i >= 0; i--) if (r.results[i].kind === 'rows') return r.results[i]; return null; };

  // ---------------------------------------------------------------- visual builder → SQL
  const AGG_NAME = { COUNT: 'count', COUNT_DISTINCT: 'count_distinct', SUM: 'sum', AVG: 'avg', MIN: 'min', MAX: 'max' };
  const AGG_WORD = { COUNT: 'number of', COUNT_DISTINCT: 'number of different', SUM: 'total', AVG: 'average', MIN: 'lowest', MAX: 'highest' };
  QL.OPS = [['=', '='], ['<>', '≠'], ['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤'], ['contains', 'contains'], ['starts', 'starts with'], ['ends', 'ends with'], ['in', 'is one of'], ['between', 'between'], ['null', 'is empty'], ['notnull', 'is not empty']];
  const OP_WORD = { '=': 'is', '<>': 'is not', '>': 'is greater than', '>=': 'is at least', '<': 'is less than', '<=': 'is at most' };

  QL.buildQuery = function (st, schema) {
    const out = { sql: '', english: [], notes: [], warnings: [], valid: false, order: [] };
    const tables = (st && st.tables) || [];
    if (!tables.length) return out;
    const qi = QL.qi;
    const byUid = {};
    tables.forEach(t => { byUid[t.uid] = t; });
    const multi = tables.length > 1;
    const colInfo = (t, c) => { const tb = schema.tables[t.name]; return tb ? tb.columns.find(x => x.name === c) : null; };
    const colType = (t, c) => { const ci = colInfo(t, c); return ci ? ci.type : ''; };
    const colRef = (uid, c) => multi ? `${qi(byUid[uid].alias)}.${qi(c)}` : qi(c);
    const colName = (uid, c) => multi ? `${byUid[uid].alias}.${c}` : c;
    const tableSql = t => (t.alias && t.alias !== t.name) ? `${qi(t.name)} AS ${qi(t.alias)}` : qi(t.name);
    const fields = ((st && st.fields) || []).filter(f => byUid[f.uid] && (f.col === '*' || colInfo(byUid[f.uid], f.col)));
    const isAgg = f => !!f.agg && (f.col !== '*' || f.agg === 'COUNT');
    const exprOf = f => {
      const t = byUid[f.uid];
      if (f.col === '*') return f.agg === 'COUNT' ? 'COUNT(*)' : (multi ? `${qi(t.alias)}.*` : '*');
      const base = colRef(f.uid, f.col);
      if (!isAgg(f)) return base;
      if (f.agg === 'COUNT_DISTINCT') return `COUNT(DISTINCT ${base})`;
      return `${f.agg}(${base})`;
    };
    const wordOf = f => {
      if (f.col === '*') return isAgg(f) ? 'number of rows' : `all columns${multi ? ' of ' + byUid[f.uid].alias : ''}`;
      const n = colName(f.uid, f.col);
      if (!isAgg(f)) return n;
      return f.agg === 'COUNT' ? `number of ${n} values` : `${AGG_WORD[f.agg]} ${n}`;
    };

    // aliases for shown fields (aggregates get a readable one automatically)
    const shown = fields.filter(f => f.show !== false);
    const used = new Set();
    const alias = new Map();
    for (const f of shown) {
      let a = String(f.alias || '').trim();
      if (!a && isAgg(f)) {
        a = f.col === '*' ? 'row_count' : `${AGG_NAME[f.agg]}_${f.col}`;
        if (used.has(a.toLowerCase())) a = `${AGG_NAME[f.agg]}_${byUid[f.uid].alias}_${f.col}`;
      }
      if (a) { used.add(a.toLowerCase()); alias.set(f, a); }
    }
    const anyAgg = fields.some(isAgg);

    // SELECT
    const selPrefix = st.distinct ? 'SELECT DISTINCT ' : 'SELECT ';
    let items = shown.map(f => exprOf(f) + (alias.get(f) ? ` AS ${qi(alias.get(f))}` : ''));
    if (!items.length) items = ['*'];
    const lines = [selPrefix + items.join(',\n' + ' '.repeat(selPrefix.length))];
    if (shown.length) out.english.push(`Show ${shown.map(f => `<b>${esc(wordOf(f))}</b>${alias.get(f) && isAgg(f) ? ` as ${code(alias.get(f))}` : ''}`).join(', ')}`);
    else out.english.push('Show <b>all columns</b>');

    // FROM / JOIN
    const joins = ((st && st.joins) || []).filter(j => byUid[j.a.uid] && byUid[j.b.uid] && j.a.uid !== j.b.uid
      && colInfo(byUid[j.a.uid], j.a.col) && colInfo(byUid[j.b.uid], j.b.col));
    const inQuery = new Set([tables[0].uid]);
    out.order.push(tables[0].uid);
    lines.push(`FROM ${tableSql(tables[0])}`);
    out.english.push(`from <b>${esc(tables[0].alias)}</b>`);
    let outer = false;
    while (inQuery.size < tables.length) {
      let next = null, links = null;
      for (const t of tables) {
        if (inQuery.has(t.uid)) continue;
        const l = joins.filter(j => (j.a.uid === t.uid && inQuery.has(j.b.uid)) || (j.b.uid === t.uid && inQuery.has(j.a.uid)));
        if (l.length) { next = t; links = l; break; }
      }
      if (!next) {
        next = tables.find(t => !inQuery.has(t.uid));
        lines.push(`CROSS JOIN ${tableSql(next)}`);
        out.english.push(`combined with every row of <b>${esc(next.alias)}</b> (cross join)`);
        out.warnings.push(`<b>${esc(next.alias)}</b> isn't connected to the other tables, so every row is paired with every row (a cross join). Drag a column's dot onto the matching column of another table to join them.`);
        inQuery.add(next.uid);
        out.order.push(next.uid);
        continue;
      }
      const j = links[0];
      const newIsA = j.a.uid === next.uid;
      const keep = j.keep || 'match';
      let kw = 'JOIN';
      if (keep === 'all') kw = 'FULL OUTER JOIN';
      else if (keep === 'a') kw = newIsA ? 'RIGHT JOIN' : 'LEFT JOIN';
      else if (keep === 'b') kw = newIsA ? 'LEFT JOIN' : 'RIGHT JOIN';
      if (kw !== 'JOIN') outer = true;
      const conds = links.map(l => {
        const ns = l.a.uid === next.uid ? l.a : l.b;
        const os = l.a.uid === next.uid ? l.b : l.a;
        const tA = QL.typeClass(colType(byUid[ns.uid], ns.col)), tB = QL.typeClass(colType(byUid[os.uid], os.col));
        if ((tA === 'num') !== (tB === 'num')) out.warnings.push(`${code(colName(ns.uid, ns.col))} and ${code(colName(os.uid, os.col))} hold different kinds of data, so they will rarely match. Joins usually connect a foreign key to the id it points to.`);
        return `${colRef(ns.uid, ns.col)} = ${colRef(os.uid, os.col)}`;
      });
      lines.push(`${kw} ${tableSql(next)} ON ${conds.join('\n   AND ')}`);
      const oldT = byUid[newIsA ? j.b.uid : j.a.uid];
      const how = kw === 'JOIN' ? 'only rows that have a match'
        : kw === 'LEFT JOIN' ? `keeping all <b>${esc(oldT.alias)}</b> rows, even without a match`
        : kw === 'RIGHT JOIN' ? `keeping all <b>${esc(next.alias)}</b> rows, even without a match` : 'keeping all rows from both sides';
      out.english.push(`matched with <b>${esc(next.alias)}</b> where ${links.map(l => `${code(colName(l.a.uid, l.a.col))} = ${code(colName(l.b.uid, l.b.col))}`).join(' and ')} (${how})`);
      inQuery.add(next.uid);
      out.order.push(next.uid);
    }

    // WHERE / HAVING
    const where = [], having = [];
    for (const f of fields) {
      if (!f.op || f.col === '*' && !isAgg(f)) continue;
      const t = byUid[f.uid];
      const agg = isAgg(f);
      const expr = exprOf(f);
      let cls = f.col === '*' ? 'num' : QL.typeClass(colType(t, f.col));
      if (agg && (f.agg === 'COUNT' || f.agg === 'COUNT_DISTINCT' || f.agg === 'SUM' || f.agg === 'AVG')) cls = 'num';
      const L = v => QL.lit(v, cls === 'date' ? 'text' : cls);
      const val = String(f.val == null ? '' : f.val), val2 = String(f.val2 == null ? '' : f.val2);
      const name = esc(alias.get(f) && agg ? alias.get(f) : wordOf(f));
      const needs = f.op !== 'null' && f.op !== 'notnull';
      if (needs && !val.trim()) { out.notes.push(`The filter on <b>${name}</b> has no value yet, so it is ignored.`); continue; }
      let c = null;
      switch (f.op) {
        case 'contains': c = { sql: `${expr} LIKE ${QL.strLit('%' + val + '%')}`, en: `${name} contains “${esc(val)}”` }; break;
        case 'starts': c = { sql: `${expr} LIKE ${QL.strLit(val + '%')}`, en: `${name} starts with “${esc(val)}”` }; break;
        case 'ends': c = { sql: `${expr} LIKE ${QL.strLit('%' + val)}`, en: `${name} ends with “${esc(val)}”` }; break;
        case 'in': {
          const list = val.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
          c = { sql: `${expr} IN (${list.map(L).join(', ')})`, en: `${name} is one of ${list.map(x => '“' + esc(x) + '”').join(', ')}` };
          break;
        }
        case 'between':
          if (!val2.trim()) { out.notes.push(`The “between” filter on <b>${name}</b> needs two values.`); continue; }
          c = { sql: `${expr} BETWEEN ${L(val)} AND ${L(val2)}`, en: `${name} is between ${esc(val)} and ${esc(val2)}` };
          break;
        case 'null': c = { sql: `${expr} IS NULL`, en: `${name} is empty (NULL)` }; break;
        case 'notnull': c = { sql: `${expr} IS NOT NULL`, en: `${name} is not empty` }; break;
        default:
          if (!OP_WORD[f.op]) continue;
          c = { sql: `${expr} ${f.op} ${L(val)}`, en: `${name} ${OP_WORD[f.op]} ${esc(val)}` };
      }
      (agg ? having : where).push(c);
    }
    const joiner = st.match === 'OR' ? 'OR' : 'AND';
    if (where.length) {
      lines.push('WHERE ' + where.map(c => c.sql).join(`\n  ${joiner} `));
      out.english.push(`only rows where ${where.map(c => c.en).join(joiner === 'OR' ? ' <i>or</i> ' : ' <i>and</i> ')}`);
    }

    // GROUP BY
    let groupFields = [];
    if (anyAgg) {
      groupFields = shown.filter(f => !isAgg(f) && f.col !== '*');
      for (const f of fields) if (f.show === false && f.sort && !isAgg(f) && f.col !== '*' && !groupFields.includes(f)) groupFields.push(f);
      if (shown.some(f => f.col === '*' && !isAgg(f))) out.warnings.push(`“All columns” can't be combined with a summary such as COUNT or SUM. Untick <b>*</b> and pick the columns you want per group.`);
    }
    if (groupFields.length) {
      lines.push('GROUP BY ' + groupFields.map(exprOf).join(', '));
      out.english.push(`one result row per ${groupFields.map(f => `<b>${esc(wordOf(f))}</b>`).join(' + ')}`);
      const aggs = [...new Set(fields.filter(isAgg).map(f => f.agg === 'COUNT_DISTINCT' ? 'COUNT' : f.agg))];
      out.notes.push(`${code('GROUP BY')} was added because you used ${aggs.map(code).join(', ')}: every column you show next to a summary becomes a group.`);
    } else if (anyAgg) {
      out.english.push('summarized into a single row');
    }
    if (having.length) {
      lines.push('HAVING ' + having.map(c => c.sql).join(`\n   ${joiner} `));
      out.english.push(`only groups where ${having.map(c => c.en).join(joiner === 'OR' ? ' <i>or</i> ' : ' <i>and</i> ')}`);
      out.notes.push(`Filters on summaries go into ${code('HAVING')}: ${code('WHERE')} runs before rows are grouped, ${code('HAVING')} after.`);
    }

    // ORDER BY / LIMIT
    const sorted = fields.filter(f => f.sort && (f.col !== '*' || isAgg(f)));
    if (sorted.length) {
      lines.push('ORDER BY ' + sorted.map(f => `${alias.get(f) ? qi(alias.get(f)) : exprOf(f)} ${f.sort === 'DESC' ? 'DESC' : 'ASC'}`).join(', '));
      out.english.push('sorted by ' + sorted.map(f => `<b>${esc(alias.get(f) || wordOf(f))}</b> (${f.sort === 'DESC' ? 'highest / Z first' : 'lowest / A first'})`).join(', then '));
    }
    const lim = parseInt(st.limit, 10);
    if (lim > 0) { lines.push('LIMIT ' + lim); out.english.push(`only the first ${lim} row${lim === 1 ? '' : 's'}`); }
    if (st.distinct) out.english.push('duplicate rows removed');
    if (outer) out.notes.push('Rows without a partner get NULL in the other table’s columns.');
    if (multi) out.notes.push('Columns are written as <code>table.column</code> because several tables are involved.');
    out.sql = lines.join('\n') + ';';
    out.valid = true;
    return out;
  };

  // ---------------------------------------------------------------- friendly errors
  const FN_ALT = {
    YEAR: `Use ${code("strftime('%Y', order_date)")} for the year as text, or ${code("CAST(strftime('%Y', order_date) AS INTEGER)")} for a number.`,
    MONTH: `Use ${code("strftime('%m', order_date)")} for the month (01–12).`,
    DAY: `Use ${code("strftime('%d', order_date)")} for the day of the month.`,
    HOUR: `Use ${code("strftime('%H', played_at)")} for the hour (00–23).`,
    NOW: `Use ${code("datetime('now')")} for the current date and time, or ${code("date('now')")} for today.`,
    CURDATE: `Use ${code("date('now')")} for today's date.`,
    GETDATE: `Use ${code("datetime('now')")}.`,
    SYSDATE: `Use ${code("datetime('now')")}.`,
    DATEDIFF: `Subtract Julian day numbers: ${code('julianday(return_date) - julianday(loan_date)')} gives the difference in days.`,
    DATE_ADD: `Use date modifiers: ${code("date(loan_date, '+28 days')")}.`,
    DATEADD: `Use date modifiers: ${code("date(loan_date, '+28 days')")}.`,
    ADDDATE: `Use date modifiers: ${code("date(loan_date, '+28 days')")}.`,
    DATE_FORMAT: `Use ${code("strftime('%d.%m.%Y', order_date)")}.`,
    TO_CHAR: `Use ${code("strftime('%d.%m.%Y', order_date)")} or ${code('printf()')}.`,
    LEN: `Use ${code('LENGTH(text)')}.`,
    LEFT: `Use ${code('substr(text, 1, 3)')} for the first 3 characters.`,
    RIGHT: `Use ${code('substr(text, -3)')} for the last 3 characters.`,
    ISNULL: `Use ${code('COALESCE(value, fallback)')} or ${code('IFNULL(value, fallback)')}.`,
    NVL: `Use ${code('COALESCE(value, fallback)')}.`,
    CHARINDEX: `Use ${code("instr(text, 'part')")}.`,
    LOCATE: `Use ${code("instr(text, 'part')")}.`,
    POSITION: `Use ${code("instr(text, 'part')")}.`,
    TRUNCATE: `Use ${code('CAST(x AS INTEGER)')} to cut off decimals.`,
    TRUNC: `Use ${code('CAST(x AS INTEGER)')} to cut off decimals.`,
    TO_DATE: `Store dates as ${code("'YYYY-MM-DD'")} text; SQLite's date functions read that format directly.`,
    STR_TO_DATE: `Store dates as ${code("'YYYY-MM-DD'")} text; SQLite's date functions read that format directly.`,
    MEDIAN: 'SQLite has no MEDIAN. Sort the values and pick the middle one with LIMIT and OFFSET.',
    STDDEV: 'SQLite has no built-in standard deviation.',
  };
  function clauseOrderBroken(sql) {
    const rank = { SELECT: 0, FROM: 1, WHERE: 2, GROUP: 3, HAVING: 4, ORDER: 5, LIMIT: 6 };
    let depth = 0, last = -1;
    for (const tk of QL.tokenize(sql)) {
      if (tk.v === '(') depth++;
      else if (tk.v === ')') depth--;
      else if (tk.v === ';') last = -1;
      else if (depth === 0 && tk.t === 'word') {
        const U = tk.v.toUpperCase();
        if (U === 'UNION' || U === 'EXCEPT' || U === 'INTERSECT') { last = -1; continue; }
        if (U in rank) { if (rank[U] < last) return true; last = rank[U]; }
      }
    }
    return false;
  }
  QL.explainError = function (msg, sql, ctx) {
    ctx = ctx || { tables: [], columns: {} };
    const res = { title: 'The database reported an error', hints: [], fixes: [] };
    const allTables = ctx.tables || [];
    const usedTables = QL.tablesIn(sql, allTables);
    const colsOf = ts => [...new Set(ts.flatMap(t => ctx.columns[t] || []))];
    const usedCols = colsOf(usedTables.length ? usedTables : allTables);
    const allCols = colsOf(allTables);
    let m;
    if ((m = /no such column: (.+)$/.exec(msg))) {
      const raw = m[1].trim();
      const parts = raw.split('.');
      const name = parts.pop();
      const prefix = parts.join('.');
      res.title = `There's no column called ${code(raw)}`;
      const near = QL.closest(name, usedCols) || QL.closest(name, allCols);
      const looksLikeValue = new RegExp(`(=|<>|!=|<|>|\\bLIKE|\\bIN\\s*\\(|\\bTHEN|\\bELSE|\\bVALUES\\s*\\(|,)\\s*"?${escRe(raw)}\\b`, 'i').test(sql);
      if (!prefix && !near && looksLikeValue && !allCols.some(c => c.toLowerCase() === name.toLowerCase())) {
        res.hints.push(`Text values need single quotes: ${code("'" + name + "'")}. Without them, SQL looks for a column named ${code(name)}.`);
        res.fixes.push({ label: `Write '${name}'`, find: name, replace: QL.strLit(name) });
      } else if (near) {
        res.hints.push(`Did you mean ${code(near)}?`);
        res.fixes.push({ label: `Use ${near}`, find: name, replace: near });
      }
      if (prefix) {
        res.hints.push(`Before the dot must be a table or alias from your FROM/JOIN, and that table needs a column ${code(name)}.`);
        const owners = Object.keys(ctx.columns).filter(t => (ctx.columns[t] || []).includes(name));
        if (owners.length) res.hints.push(`${code(name)} exists in ${owners.map(code).join(', ')}.`);
      }
      if (usedTables.length) res.hints.push(`Columns of ${usedTables.map(code).join(', ')}: ${usedCols.slice(0, 40).map(code).join(' ')}`);
      return res;
    }
    if ((m = /no such table: (.+)$/.exec(msg))) {
      const name = m[1].trim().replace(/^main\./, '');
      res.title = `There's no table called ${code(name)}`;
      const near = QL.closest(name, allTables, 3);
      if (near) { res.hints.push(`Did you mean ${code(near)}?`); res.fixes.push({ label: `Use ${near}`, find: name, replace: near }); }
      res.hints.push(allTables.length ? `Tables in this database: ${allTables.map(code).join(' ')}` : 'This database has no tables yet. Create one with CREATE TABLE, or import data.');
      return res;
    }
    if ((m = /ambiguous column name: (.+)$/.exec(msg))) {
      const name = m[1].trim();
      const owners = usedTables.filter(t => (ctx.columns[t] || []).includes(name));
      res.title = `${code(name)} is ambiguous`;
      res.hints.push(`More than one table in your query has a column ${code(name)}${owners.length ? ` (${owners.map(code).join(', ')})` : ''}. Put the table name in front, like ${code((owners[0] || 'table') + '.' + name)}.`);
      return res;
    }
    if (/misuse of aggregate/.test(msg)) {
      res.title = 'Aggregate function in the wrong place';
      res.hints.push(`${code('COUNT')}, ${code('SUM')}, ${code('AVG')} and friends can't go in ${code('WHERE')}, because WHERE checks single rows before anything is grouped.`);
      res.hints.push(`To filter on a group total, use ${code('GROUP BY …')} and then ${code('HAVING COUNT(*) > 5')}. To compare with an overall average, use a subquery: ${code('WHERE price > (SELECT AVG(price) FROM products)')}.`);
      return res;
    }
    if (/HAVING clause on a non-aggregate query|GROUP BY clause is required before HAVING/.test(msg)) {
      res.title = 'HAVING without groups';
      res.hints.push(`${code('HAVING')} filters groups, so it needs ${code('GROUP BY')} before it. To filter single rows, use ${code('WHERE')}.`);
      return res;
    }
    if ((m = /no such function: ([\w$]+)/i.exec(msg))) {
      const fn = m[1].toUpperCase();
      res.title = `SQLite has no function ${code(fn)}`;
      if (FN_ALT[fn]) res.hints.push(FN_ALT[fn]);
      else { const near = QL.closest(fn, [...FUNCTIONS]); if (near) { res.hints.push(`Did you mean ${code(near)}?`); res.fixes.push({ label: `Use ${near}`, find: m[1], replace: near }); } }
      res.hints.push('This playground runs SQLite. Function names differ a little between databases such as MySQL, PostgreSQL and SQL Server.');
      return res;
    }
    if (/incomplete input/.test(msg)) {
      res.title = 'The statement ends too early';
      const clean = QL.tokenize(sql).filter(t => t.t !== 'com');
      const quotes = clean.filter(t => t.t === 'str' && (t.v.length < 2 || !t.v.endsWith("'"))).length;
      let depth = 0;
      clean.forEach(t => { if (t.v === '(') depth++; else if (t.v === ')') depth--; });
      if (quotes) res.hints.push(`A text value is missing its closing quote ${code("'")}.`);
      if (depth > 0) res.hints.push(`${depth === 1 ? 'A bracket is' : depth + ' brackets are'} opened but not closed: add ${code(')'.repeat(depth))}.`);
      const sig = clean.filter(t => t.t !== 'ws' && t.v !== ';');
      const last = sig.length ? sig[sig.length - 1].v.toUpperCase() : '';
      if (/^(WHERE|AND|OR|ON|BY|SET|FROM|JOIN|SELECT|HAVING|NOT|IN|LIKE|AS|=|<|>|<=|>=|<>|,)$/.test(last)) res.hints.push(`Something is missing after the last word, ${code(last)}.`);
      if (!res.hints.length) res.hints.push('Check that every bracket and quote is closed and that the last clause is complete.');
      return res;
    }
    if ((m = /unrecognized token: "(.*)"/.exec(msg))) {
      const tok = m[1];
      res.title = 'Something here isn’t valid SQL';
      if (tok.startsWith("'")) res.hints.push(`A text value is missing its closing single quote: ${code(tok)}.`);
      else res.hints.push(`SQLite can't read ${code(tok)}. Look for a stray character.`);
      return res;
    }
    if ((m = /near "([^"]*)": syntax error/.exec(msg))) {
      const tok = m[1];
      const U = tok.toUpperCase();
      res.title = `Syntax error near ${code(tok)}`;
      const toks = QL.tokenize(sql).filter(t => t.t !== 'ws' && t.t !== 'com');
      const idx = toks.findIndex(t => t.v.toUpperCase() === U);
      const prev = idx > 0 ? toks[idx - 1] : null;
      const clauses = ['FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT'];
      if (prev && prev.v === ',' && (clauses.includes(U) || U === ')')) {
        res.hints.push(`Remove the comma before ${code(tok)}. The last item of a list has no comma after it.`);
        res.fixes.push({ label: 'Remove the comma', removeCommaBefore: tok });
      } else if (clauses.includes(U) && clauseOrderBroken(sql)) {
        res.hints.push(`Clauses must come in this order: ${code('SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT')}.`);
      } else if (U === 'TOP' || (prev && prev.v.toUpperCase() === 'TOP')) {
        res.hints.push(`SQLite doesn't know ${code('TOP n')}. Put ${code('LIMIT n')} at the end of the query instead.`);
      } else if (prev && (prev.t === 'word' || prev.t === 'qid') && !KEYWORDS.has(prev.v.toUpperCase()) && (idx > 1 && (toks[idx - 2].t === 'word' || toks[idx - 2].t === 'qid') && !KEYWORDS.has(toks[idx - 2].v.toUpperCase()))) {
        res.hints.push(`Is a comma missing between ${code(toks[idx - 2].v)}, ${code(prev.v)} and ${code(tok)}? Separate columns with commas.`);
      } else {
        const near = /^[A-Za-z]+$/.test(tok) ? QL.closest(tok, ['SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'AND', 'NOT', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'DISTINCT', 'BETWEEN', 'LIKE', 'NULL', 'WHEN', 'THEN', 'ELSE', 'CASE', 'UNION', 'OFFSET', 'DESC'], 2) : null;
        if (near && near !== U) {
          res.hints.push(`Did you mean ${code(near)}?`);
          res.fixes.push({ label: `Use ${near}`, find: tok, replace: near });
        }
        if (U === '(' && prev && /^(SUM|COUNT|AVG|MIN|MAX)$/i.test(prev.v)) { /* fine: nested function issue */ }
      }
      if (!res.hints.length) res.hints.push(`SQLite stopped reading at ${code(tok)}. The mistake is usually just before it: a missing or extra comma, a misspelled keyword or a missing bracket.`);
      return res;
    }
    if ((m = /UNIQUE constraint failed: (\S+)/.exec(msg))) {
      const c = m[1].split(',')[0].split('.').pop();
      res.title = `Duplicate value in ${code(m[1])}`;
      if (/\bINSERT\b[\s\S]*\bSELECT\b/i.test(sql)) res.hints.push(`Your SELECT returns the same ${code(c)} more than once. ${code('SELECT DISTINCT')} copies each value only once.`);
      res.hints.push(`${code(c)} must be unique and the value already exists. For an ${code('INTEGER PRIMARY KEY')} you can leave the column out of an INSERT: SQLite then picks the next free number.`);
      return res;
    }
    if ((m = /NOT NULL constraint failed: (\S+)/.exec(msg))) {
      res.title = `${code(m[1])} can't be empty`;
      res.hints.push(`The column is ${code('NOT NULL')}, so every row needs a value for it. Add it to the column list and to VALUES.`);
      return res;
    }
    if (/FOREIGN KEY constraint failed/.test(msg)) {
      res.title = 'This would break a link between tables';
      res.hints.push('A foreign key must point to a row that exists. Either the id you inserted doesn’t exist in the referenced table, or you tried to delete or change a row that other rows still point to.');
      return res;
    }
    if ((m = /CHECK constraint failed: (.+)$/.exec(msg))) {
      res.title = 'A value breaks a rule of the table';
      res.hints.push(`The table only accepts values where ${code(m[1])} is true.`);
      return res;
    }
    if (/datatype mismatch/.test(msg)) {
      res.title = 'Wrong kind of value';
      res.hints.push(`An ${code('INTEGER PRIMARY KEY')} column only accepts whole numbers.`);
      return res;
    }
    if ((m = /table (\S+) has (\d+) columns? but (\d+) values were supplied/.exec(msg))) {
      res.title = 'Number of values doesn’t match';
      res.hints.push(`${code(m[1])} has ${m[2]} columns but you gave ${m[3]} values. Name the columns you fill: ${code(`INSERT INTO ${m[1]} (col1, col2) VALUES (…, …)`)}.`);
      return res;
    }
    if ((m = /(\d+) values for (\d+) columns/.exec(msg))) {
      res.title = 'Number of values doesn’t match';
      res.hints.push(`You listed ${m[2]} column(s) but gave ${m[1]} value(s). They must match one to one.`);
      return res;
    }
    if ((m = /(table|index|view) (\S+) already exists/.exec(msg))) {
      res.title = `A ${m[1]} called ${code(m[2])} already exists`;
      res.hints.push(`Pick another name, remove the old one first (${code(`DROP ${m[1].toUpperCase()} ${m[2]};`)}), or write ${code(`CREATE ${m[1].toUpperCase()} IF NOT EXISTS …`)}.`);
      if (/\b(INSERT|UPDATE|ALTER)\b/i.test(sql)) res.hints.push('Created it a moment ago? Then select only the statements after the CREATE and run just those.');
      return res;
    }
    if (/do not have the same number of result columns/.test(msg)) {
      res.title = 'Both sides must have the same columns';
      res.hints.push(`Every SELECT combined with ${code('UNION')}, ${code('EXCEPT')} or ${code('INTERSECT')} must return the same number of columns.`);
      return res;
    }
    if (/ORDER BY term out of range/.test(msg)) {
      res.title = 'ORDER BY points to a missing column';
      res.hints.push(`A number in ${code('ORDER BY')} means a column position (${code('ORDER BY 2')} = second column), and your SELECT doesn't have that many columns.`);
      return res;
    }
    if (/sub-select returns \d+ columns - expected 1|row value misused/.test(msg)) {
      res.title = 'The subquery returns too many columns';
      res.hints.push(`A subquery used with ${code('IN')} or ${code('=')} must return exactly one column. Select only the column you compare with.`);
      return res;
    }
    if (/cannot commit - no transaction is active/.test(msg)) {
      res.title = 'No transaction to commit';
      res.hints.push(`Start one with ${code('BEGIN;')} first, or leave ${code('COMMIT')} out: each statement is saved on its own.`);
      return res;
    }
    if (/cannot start a transaction within a transaction/.test(msg)) {
      res.title = 'A transaction is already open';
      res.hints.push(`Finish it with ${code('COMMIT;')} or ${code('ROLLBACK;')} first.`);
      return res;
    }
    if ((m = /no such (index|view|trigger): (.+)$/.exec(msg))) {
      res.title = `There's no ${m[1]} called ${code(m[2])}`;
      return res;
    }
    res.hints.push('The part of the message in quotes usually shows where SQLite got stuck.');
    return res;
  };

  // gentle warnings for queries that run but probably don't do what was meant
  QL.lint = function (sql, ctx) {
    const notes = [];
    const seen = new Set();
    const add = (key, html) => { if (!seen.has(key)) { seen.add(key); notes.push(html); } };
    const toks = QL.tokenize(sql).filter(t => t.t !== 'ws' && t.t !== 'com');
    const ident = (ctx && ctx.identSet) || new Set();
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const U = t.v.toUpperCase();
      if ((t.v === '=' || t.v === '<>' || t.v === '!=') && toks[i + 1] && toks[i + 1].v.toUpperCase() === 'NULL') {
        add('eqnull', `${code(t.v + ' NULL')} is never true, because NULL means “unknown”. Use ${code(t.v === '=' ? 'IS NULL' : 'IS NOT NULL')}.`);
      }
      if (t.t === 'qid' && t.v.startsWith('"') && t.v.length > 1) {
        const inner = t.v.slice(1, -1).replace(/""/g, '"');
        const prevU = (toks[i - 1] && toks[i - 1].v.toUpperCase()) || '';
        if (!ident.has(inner.toLowerCase()) && !['AS', 'TABLE', 'INTO', 'EXISTS', 'VIEW', 'INDEX', 'COLUMN', '(', ','].includes(prevU)) {
          add('dq', `${code(t.v)} is in double quotes. SQL uses double quotes for names and single quotes for text, so write ${code("'" + inner + "'")}. SQLite guessed what you meant, but other databases won't.`);
        }
      }
      if (U === 'JOIN') {
        const pU = toks[i - 1] ? toks[i - 1].v.toUpperCase() : '';
        if (pU === 'CROSS' || pU === 'NATURAL') continue;
        let j = i + 1;
        if (toks[j] && toks[j].v === '(') continue;
        j++;
        if (toks[j] && toks[j].v === '.') j += 2;
        if (toks[j] && toks[j].v.toUpperCase() === 'AS') j += 2;
        else if (toks[j] && (toks[j].t === 'word' || toks[j].t === 'qid') && !KEYWORDS.has(toks[j].v.toUpperCase())) j++;
        const nx = toks[j] ? toks[j].v.toUpperCase() : '';
        if (nx !== 'ON' && nx !== 'USING') add('joinon', `A ${code('JOIN')} without ${code('ON')} pairs every row with every row of the other table. Add ${code('ON table1.column = table2.column')}.`);
      }
    }
    return notes;
  };

  // ---------------------------------------------------------------- import: CSV / JSON
  function countOutside(line, d) {
    let n = 0, q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch === d) n++; }
    return n;
  }
  QL.detectDelimiter = function (text) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()).slice(0, 12);
    let best = ',', bestScore = -1;
    for (const d of [',', ';', '\t', '|']) {
      const counts = lines.map(l => countOutside(l, d));
      if (!counts.length) continue;
      const min = Math.min(...counts), max = Math.max(...counts);
      if (min === 0) continue;
      const score = min * 10 - (max - min) * 3;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  };
  QL.parseDelimited = function (text, delim) {
    text = text.replace(/^﻿/, '');
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
        continue;
      }
      if (ch === '"' && field.trim() === '') { q = true; field = ''; continue; }
      if (ch === delim) { row.push(field); field = ''; continue; }
      if (ch === '\r') continue;
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
      field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
  };
  const deUmlaut = s => String(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss');
  QL.sanitizeName = function (s, fallback) {
    let n = deUmlaut(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
    n = n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!n) n = fallback || 'column';
    if (/^\d/.test(n)) n = 'c_' + n;
    if (RESERVED.has(n.toUpperCase())) n += '_';
    return n.slice(0, 60);
  };
  const stripCur = v => v.replace(/^[€$£]\s*|\s*[€$£]$|\s*(EUR|USD|GBP)$/i, '');
  QL.TYPES = ['INTEGER', 'REAL', 'TEXT', 'DATE', 'DATETIME', 'BOOLEAN'];
  // converters per type; `info.decimalComma` changes how REAL is read
  QL.converter = function (type, info) {
    const empty = v => v == null || String(v).trim() === '';
    const dc = info && info.decimalComma;
    switch (type) {
      case 'INTEGER': return v => { if (empty(v)) return null; const s = stripCur(String(v).trim()); return /^[-+]?\d+$/.test(s) ? parseInt(s, 10) : s; };
      case 'REAL': return v => {
        if (empty(v)) return null;
        let s = stripCur(String(v).trim());
        if (dc) s = s.replace(/\./g, '').replace(',', '.');
        const x = Number(s);
        return s !== '' && isFinite(x) ? x : String(v).trim();
      };
      case 'DATE': return v => {
        if (empty(v)) return null;
        const s = String(v).trim();
        const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
        return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
      };
      case 'DATETIME': return v => {
        if (empty(v)) return null;
        const s = String(v).trim();
        const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')} ${m[4].padStart(2, '0')}:${m[5]}:${m[6] || '00'}`;
        return s.replace('T', ' ').replace(/(\.\d+)?Z$/, '');
      };
      case 'BOOLEAN': return v => {
        if (empty(v)) return null;
        const s = String(v).trim().toLowerCase();
        if (/^(true|yes|ja|wahr|y|1)$/.test(s)) return 1;
        if (/^(false|no|nein|falsch|n|0)$/.test(s)) return 0;
        return String(v).trim();
      };
      default: return v => (empty(v) ? null : String(v));
    }
  };
  QL.inferColumn = function (values, delim) {
    const vals = values.map(v => (v == null ? '' : String(v).trim())).filter(v => v !== '');
    if (!vals.length) return { type: 'TEXT', info: {}, note: 'empty' };
    const all = re => vals.every(v => re.test(v));
    const curr = vals.map(stripCur);
    const allC = re => curr.every(v => re.test(v));
    const leadingZero = curr.some(v => /^[-+]?0\d/.test(v));
    if (allC(/^[-+]?\d+$/) && !leadingZero && curr.every(v => v.replace(/^[-+]/, '').length <= 15)) return { type: 'INTEGER', info: {} };
    if (allC(/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/) && !leadingZero) return { type: 'REAL', info: {} };
    if (delim !== ',' && allC(/^[-+]?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/) && curr.some(v => v.includes(','))) return { type: 'REAL', info: { decimalComma: true }, note: 'decimal commas read as decimal points' };
    if (all(/^\d{4}-\d{2}-\d{2}$/)) return { type: 'DATE', info: {} };
    if (all(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) return { type: 'DATE', info: {}, note: 'DD.MM.YYYY converted to YYYY-MM-DD' };
    if (all(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?$/)) return { type: 'DATETIME', info: {} };
    if (all(/^\d{1,2}\.\d{1,2}\.\d{4}[ T]\d{1,2}:\d{2}(:\d{2})?$/)) return { type: 'DATETIME', info: {}, note: 'DD.MM.YYYY hh:mm converted to ISO format' };
    if (all(/^(true|false)$/i)) return { type: 'BOOLEAN', info: {}, note: 'true/false stored as 1/0' };
    return { type: 'TEXT', info: {} };
  };
  QL.jsonToTable = function (text) {
    let data = JSON.parse(text);
    if (!Array.isArray(data) && data && typeof data === 'object') {
      const arr = Object.values(data).find(v => Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object');
      data = arr || [data];
    }
    if (!Array.isArray(data) || !data.length) throw new Error('Expected a list of records, like [{"name": "Anna", "age": 31}, …].');
    const cell = v => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
    if (Array.isArray(data[0])) return { header: data[0].map(String), rows: data.slice(1).map(r => (Array.isArray(r) ? r : [r]).map(cell)) };
    const keys = [], seen = new Set();
    for (const r of data) if (r && typeof r === 'object') for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
    if (!keys.length) throw new Error('The JSON has no fields to turn into columns.');
    return { header: keys, rows: data.map(r => keys.map(k => cell(r && typeof r === 'object' ? r[k] : null))) };
  };

  // ---------------------------------------------------------------- exercise checks
  const isNumLike = v => typeof v === 'number' || (typeof v === 'string' && NUM_RE.test(v.trim()));
  function cellEq(a, b, tol) {
    if (a === null || b === null || a === undefined || b === undefined) return (a == null) && (b == null);
    if (typeof a === 'number' || typeof b === 'number') {
      if (isNumLike(a) && isNumLike(b)) return Math.abs(Number(a) - Number(b)) <= tol;
      return false;
    }
    if (a instanceof Uint8Array || b instanceof Uint8Array) return String(a) === String(b);
    return String(a) === String(b);
  }
  function rowsEq(r1, r2, tol) { for (let i = 0; i < r1.length; i++) if (!cellEq(r1[i], r2[i], tol)) return false; return true; }
  function matchUnordered(exp, got, tol) {
    const n = exp.length;
    if (n > 3000) {
      const key = r => r.map(v => (v == null ? '\u0000' : isNumLike(v) ? (Math.round(Number(v) * 100) / 100).toFixed(2) : String(v))).join('\u0001');
      const a = exp.map(key).sort(), b = got.map(key).sort();
      return a.every((k, i) => k === b[i]);
    }
    const usedG = new Uint8Array(got.length);
    outer: for (const r of exp) {
      for (let j = 0; j < got.length; j++) if (!usedG[j] && rowsEq(r, got[j], tol)) { usedG[j] = 1; continue outer; }
      return false;
    }
    return true;
  }
  function columnPermutation(exp, got) {
    // try to map each expected column to a got column with the same multiset of values
    const sig = (vals, c) => vals.map(r => { const v = r[c]; return v == null ? '\u0000' : isNumLike(v) ? (Math.round(Number(v) * 100) / 100).toFixed(2) : String(v); }).sort().join('\u0001');
    const n = exp.columns.length;
    const es = [], gs = [];
    for (let c = 0; c < n; c++) { es.push(sig(exp.values, c)); gs.push(sig(got.values, c)); }
    const usedG = new Array(n).fill(false);
    const perm = [];
    for (let c = 0; c < n; c++) {
      let found = -1;
      for (let d = 0; d < n; d++) if (!usedG[d] && gs[d] === es[c]) { found = d; break; }
      if (found < 0) return null;
      usedG[found] = true; perm.push(found);
    }
    return perm;
  }
  QL.compareResults = function (exp, got, ordered) {
    const ec = exp.columns.length, gc = got.columns.length;
    if (ec !== gc) {
      return { ok: false, msg: `Your result has ${gc} column${gc === 1 ? '' : 's'}, the expected one has ${ec}: ${exp.columns.map(code).join(', ')}.` };
    }
    const er = exp.values.length, gr = got.values.length;
    if (er !== gr) {
      return { ok: false, msg: `You got ${gr} row${gr === 1 ? '' : 's'}, the expected result has ${er}.`,
        hint: gr > er ? 'Too many rows: is a filter missing, or does a JOIN repeat rows?' : 'Too few rows: is a filter too strict, or should a LEFT JOIN keep rows without a match?' };
    }
    const tol = 0.0051;
    const tryWith = (g, note) => {
      if (ordered) {
        if (g.every((r, i) => rowsEq(exp.values[i], r, tol))) return { ok: true, note };
        if (matchUnordered(exp.values, g, tol)) return { ok: false, msg: 'Right rows, but in a different order. Check your ORDER BY.' };
        return null;
      }
      return matchUnordered(exp.values, g, tol) ? { ok: true, note } : null;
    };
    let r = tryWith(got.values);
    if (!r) {
      const perm = columnPermutation(exp, got);
      if (perm && perm.some((p, i) => p !== i)) {
        const g2 = got.values.map(row => perm.map(p => row[p]));
        r = tryWith(g2, 'Your columns are in a different order than in the model solution, which is fine.');
      }
    }
    if (r) {
      if (r.ok) {
        const tips = [];
        exp.columns.forEach((c, i) => {
          if (/^[a-z_][a-z0-9_]*$/i.test(c) && got.columns[i] && c.toLowerCase() !== got.columns[i].toLowerCase() && !/\(/.test(c) && /\(|\*|\s/.test(got.columns[i])) tips.push(`Name the calculated column with ${code('AS ' + c)} to make the result easier to read.`);
        });
        if (tips.length) r.tip = tips[0];
      }
      return r;
    }
    // near miss on numbers (rounding)?
    const loose = 0.51;
    const nearOrdered = ordered ? got.values.every((row, i) => rowsEq(exp.values[i], row, loose)) : matchUnordered(exp.values, got.values, loose);
    if (nearOrdered) return { ok: false, msg: 'Almost: the numbers differ only slightly. Check the rounding the task asks for, e.g. ROUND(x, 2).' };
    return { ok: false, msg: 'The number of rows and columns is right, but some values differ from the expected result.', hint: 'Compare your result with the expected result below.' };
  };
  const hasStatement = sql => !!String(sql || '').trim() && QL.tokenize(sql).some(t => t.t !== 'ws' && t.t !== 'com');
  const withoutComments = sql => QL.tokenize(sql).filter(t => t.t !== 'com').map(t => t.v).join('');
  const sameValue = (v, want) => {
    if (want === null) return v == null;
    if (typeof want === 'number') return v != null && isNumLike(v) && Math.abs(Number(v) - want) < 1e-9;
    return v != null && String(v) === String(want);
  };
  // Structural checks for design exercises: every assertion is a query with either an expected value (eq)
  // or a result that must match the model solution's database. The first failing assertion explains what's missing.
  // Runs every assertion against udb; assertions without eq compare with the model solution's database sdb.
  function evalAsserts(ex, sdb, udb) {
    for (const a of ex.asserts || []) {
      const u = QL.runSQL(udb, a.q, { maxRows: 20000 });
      const ures = u.error ? null : QL.lastRows(u);
      let ok;
      if ('eq' in a) {
        const v = ures && ures.values.length ? ures.values[0][0] : null;
        ok = !u.error && sameValue(v, a.eq);
      } else {
        const s = QL.runSQL(sdb, a.q, { maxRows: 20000 });
        if (s.error) return { internal: 'A check query failed on the model solution: ' + s.error.message };
        ok = !u.error && !!ures && QL.compareResults(QL.lastRows(s), ures, !!a.ordered).ok;
      }
      if (!ok) return { failed: a };
    }
    return null;
  }
  const openWith = (SQL, bytes, ex) => { const db = new SQL.Database(bytes); db.exec('PRAGMA foreign_keys = ON'); if (ex.setup) db.exec(ex.setup); return db; };
  const shownIn = (ex, db) => { if (!ex.show) return null; const r = QL.runSQL(db, ex.show, { maxRows: 20000 }); return r.error ? null : QL.lastRows(r); };
  function runAssertCheck(SQL, bytes, ex, userSql) {
    if (!hasStatement(userSql)) return { status: 'empty', msg: 'Write your SQL first, then check it.' };
    const clean = withoutComments(userSql);
    const sdb = openWith(SQL, bytes, ex), udb = openWith(SQL, bytes, ex);
    try {
      const sr = QL.runSQL(sdb, ex.solution, { maxRows: 20000 });
      if (sr.error) return { status: 'internal', msg: 'The model solution failed: ' + sr.error.message };
      const expected = shownIn(ex, sdb);
      const ur = QL.runSQL(udb, userSql, { maxRows: 20000 });
      if (ur.error) return { status: 'error', error: ur.error, expected };
      for (const t of ex.textAsserts || []) {
        if (!new RegExp(t.re, 'i').test(clean)) return { status: 'fail', msg: t.msg, expected, got: shownIn(ex, udb) };
      }
      const bad = evalAsserts(ex, sdb, udb);
      if (bad && bad.internal) return { status: 'internal', msg: bad.internal };
      if (bad) return { status: 'fail', msg: bad.failed.msg, hint: bad.failed.hint, expected, got: shownIn(ex, udb) };
      return { status: 'ok', expected, got: shownIn(ex, udb) };
    } finally { sdb.close(); udb.close(); }
  }
  // Does any statement start a transaction or savepoint of its own?
  const controlsTx = sql => {
    let start = true;
    for (const t of QL.tokenize(sql)) {
      if (t.t === 'ws' || t.t === 'com') continue;
      if (t.v === ';') { start = true; continue; }
      if (start && t.t === 'word' && /^(BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE)$/i.test(t.v)) return true;
      start = false;
    }
    return false;
  };
  // The same structural checks on the learner's own database, for answers built step by step whose
  // editor holds only the last statements. First the editor's SQL is tried on top of the live database
  // inside a savepoint that is always rolled back; then the database is judged as it is. Never changes it.
  QL.checkLive = function (SQL, bytes, ex, db, userSql) {
    if (!ex.asserts || ex.textAsserts) return null;
    const sdb = openWith(SQL, bytes, ex);
    try {
      const sr = QL.runSQL(sdb, ex.solution, { maxRows: 20000 });
      if (sr.error) return null;
      const expected = shownIn(ex, sdb);
      const judge = how => {
        const bad = evalAsserts(ex, sdb, db);
        if (bad && bad.internal) return null;
        const got = shownIn(ex, db);
        return bad ? { status: 'fail', live: how, msg: bad.failed.msg, hint: bad.failed.hint, expected, got } : { status: 'ok', live: how, expected, got };
      };
      let withEditor = null;
      if (hasStatement(userSql) && !controlsTx(userSql)) {
        db.exec('SAVEPOINT qlab_check');
        try {
          const ur = QL.runSQL(db, userSql, { maxRows: 1 });
          if (!ur.error) withEditor = judge('editor');
        } finally {
          try { db.exec('ROLLBACK TO qlab_check'); db.exec('RELEASE qlab_check'); } catch (err) { /* already ended */ }
        }
        if (withEditor && withEditor.status === 'ok') return withEditor;
      }
      const asIs = judge('as-is');
      if (asIs && asIs.status === 'ok') return asIs;
      return withEditor || asIs;
    } finally { sdb.close(); }
  };
  QL.runCheck = function (SQL, bytes, ex, userSql) {
    if (ex.asserts || ex.textAsserts) return runAssertCheck(SQL, bytes, ex, userSql);
    const exec = sql => {
      const db = new SQL.Database(bytes);
      try {
        db.exec('PRAGMA foreign_keys = ON');
        if (ex.setup) db.exec(ex.setup);
        const r = QL.runSQL(db, sql, { maxRows: 20000 });
        if (r.error) return { error: r.error, ran: r };
        if (ex.verify) {
          const v = QL.runSQL(db, ex.verify, { maxRows: 20000 });
          if (v.error) return { verifyError: v.error, ran: r };
          return { res: QL.lastRows(v), ran: r };
        }
        return { res: QL.lastRows(r), ran: r };
      } finally { db.close(); }
    };
    const exp = exec(ex.solution);
    if (exp.error || exp.verifyError) return { status: 'internal', msg: 'The model solution failed: ' + (exp.error || exp.verifyError).message };
    if (!String(userSql || '').trim() || !QL.tokenize(userSql).some(t => t.t !== 'ws' && t.t !== 'com')) return { status: 'empty', msg: 'Write a query first, then check it.' };
    const got = exec(userSql);
    if (got.error) return { status: 'error', error: got.error, expected: exp.res };
    if (got.verifyError) return { status: 'fail', msg: `Your SQL ran, but the result can't be checked: ${esc(got.verifyError.message)}.`, expected: exp.res };
    if (!got.res) return { status: 'fail', msg: ex.verify ? 'Your SQL ran, but the data isn’t in the expected state.' : 'Your SQL ran, but it didn’t return a table. This task needs a SELECT query.', expected: exp.res };
    const cmp = QL.compareResults(exp.res, got.res, !!ex.ordered);
    if (!cmp.ok && ex.verify) cmp.msg = 'After running your SQL, the data doesn’t match what was asked. ' + cmp.msg;
    return Object.assign({ status: cmp.ok ? 'ok' : 'fail', expected: exp.res, got: got.res }, cmp);
  };

  // ---------------------------------------------------------------- tiny markdown for Claude's answers
  function mdInline(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<i>$2</i>');
  }
  function mdBlocks(s) {
    let html = '', list = null, para = [];
    const flush = () => { if (para.length) { html += `<p>${mdInline(para.join(' '))}</p>`; para = []; } };
    const close = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const line of s.split('\n')) {
      let m;
      if (!line.trim()) { flush(); close(); continue; }
      if ((m = /^\s*[-*•]\s+(.*)/.exec(line))) { flush(); if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${mdInline(m[1])}</li>`; continue; }
      if ((m = /^\s*\d+[.)]\s+(.*)/.exec(line))) { flush(); if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${mdInline(m[1])}</li>`; continue; }
      if ((m = /^#{1,4}\s+(.*)/.exec(line))) { flush(); close(); html += `<h4>${mdInline(m[1])}</h4>`; continue; }
      close(); para.push(line.trim());
    }
    flush(); close();
    return html;
  }
  QL.md = function (text, tables) {
    const parts = String(text).split(/```([\w-]*)[^\n]*\n?([\s\S]*?)(?:```|$)/g);
    let html = '';
    for (let i = 0; i < parts.length; i += 3) {
      html += mdBlocks(parts[i] || '');
      if (i + 2 < parts.length) {
        const lang = parts[i + 1] || '';
        const src = (parts[i + 2] || '').replace(/\n+$/, '');
        if (src.trim()) html += `<pre class="sql md-code" data-sql="${esc(src)}">${(!lang || /sql/i.test(lang)) ? QL.highlight(src, tables) : esc(src)}</pre>`;
      }
    }
    return html;
  };

  // ---------------------------------------------------------------- export helpers
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  QL.zip = function (files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  };
  QL.sqlValue = v => {
    if (v == null) return 'NULL';
    if (typeof v === 'number') return isFinite(v) ? String(v) : 'NULL';
    if (v instanceof Uint8Array) return "X'" + Array.from(v, b => b.toString(16).padStart(2, '0')).join('') + "'";
    return QL.strLit(v);
  };
  QL.toCSV = function (columns, values, delim) {
    delim = delim || ',';
    const cell = v => {
      if (v == null) return '';
      const s = v instanceof Uint8Array ? `[BLOB ${v.length} bytes]` : String(v);
      return /["\n\r]/.test(s) || s.includes(delim) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [columns.map(cell).join(delim), ...values.map(r => r.map(cell).join(delim))].join('\r\n');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = QL;
})(typeof window !== 'undefined' ? window : globalThis);
