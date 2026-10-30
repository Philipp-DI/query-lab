// Shared test helper: build datasets into sql.js databases
const initSqlJs = require('sql.js/dist/sql-asm.js');
const QL = require('../src/data.js');
async function loadAll() {
  const SQL = await initSqlJs();
  const out = {};
  for (const ds of QL.DATASETS) {
    const t0 = Date.now();
    const spec = ds.build();
    const db = new SQL.Database();
    db.exec(spec.ddl);
    db.exec('BEGIN');
    for (const t of spec.tables) {
      const st = db.prepare(`INSERT INTO ${t.name} (${t.columns.join(',')}) VALUES (${t.columns.map(() => '?').join(',')})`);
      for (const r of t.rows) st.run(r);
      st.free();
    }
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    const fkErr = db.exec('PRAGMA foreign_key_check');
    out[ds.id] = { db, bytes: db.export(), ms: Date.now() - t0, fkErr };
    out[ds.id].db.exec('PRAGMA foreign_keys = ON');
  }
  return { SQL, QL, dbs: out };
}
module.exports = { loadAll };
