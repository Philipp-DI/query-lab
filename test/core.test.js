const { loadAll } = require('./load.js');
const QL = require('../src/core.js');
const fs = require('fs');
loadAll().then(({ SQL, dbs }) => {
  const db = dbs.shop.db;
  // schema like the app builds it
  const schema = { tables: {} };
  for (const [name] of db.exec("select name from sqlite_schema where type='table'")[0].values) {
    const cols = db.exec(`select name, type, pk from pragma_table_info('${name}')`)[0].values.map(([n, t, pk]) => ({ name: n, type: t, pk }));
    schema.tables[name] = { columns: cols };
  }
  const run = (st, label) => {
    const q = QL.buildQuery(st, schema);
    console.log(`\n--- ${label}\n${q.sql}`);
    console.log('EN:', q.english.join(' · ').replace(/<[^>]+>/g, ''));
    if (q.notes.length) console.log('NOTES:', q.notes.join(' | ').replace(/<[^>]+>/g, ''));
    if (q.warnings.length) console.log('WARN:', q.warnings.join(' | ').replace(/<[^>]+>/g, ''));
    const r = QL.runSQL(db, q.sql);
    console.log(r.error ? 'ERROR ' + r.error.message : `rows: ${QL.lastRows(r).values.length} first: ${JSON.stringify(QL.lastRows(r).values[0])}`);
  };
  run({ tables: [{ uid: 't1', name: 'customers', alias: 'customers' }], fields: [
    { uid: 't1', col: 'first_name', show: true }, { uid: 't1', col: 'country', show: false, op: 'in', val: 'Germany, Austria' },
    { uid: 't1', col: 'last_name', show: true, sort: 'ASC' }], limit: '5' }, 'single table filter');
  run({ tables: [{ uid: 't1', name: 'customers', alias: 'customers' }, { uid: 't2', name: 'orders', alias: 'orders' }],
    joins: [{ a: { uid: 't2', col: 'customer_id' }, b: { uid: 't1', col: 'id' }, keep: 'b' }],
    fields: [{ uid: 't1', col: 'last_name', show: true }, { uid: 't2', col: 'id', agg: 'COUNT', show: true, sort: 'DESC', op: '>=', val: '5' }] }, 'left join + count + having');
  run({ tables: [{ uid: 't1', name: 'order_items', alias: 'order_items' }, { uid: 't2', name: 'products', alias: 'products' }, { uid: 't3', name: 'categories', alias: 'categories' }],
    joins: [{ a: { uid: 't1', col: 'product_id' }, b: { uid: 't2', col: 'id' } }, { a: { uid: 't2', col: 'category_id' }, b: { uid: 't3', col: 'id' } }],
    fields: [{ uid: 't3', col: 'name', show: true }, { uid: 't1', col: 'quantity', agg: 'SUM', show: true, sort: 'DESC' }, { uid: 't2', col: 'name', show: false, op: 'contains', val: "Chef's" }], distinct: false }, '3 tables, quote in value');
  run({ tables: [{ uid: 't1', name: 'customers', alias: 'customers' }, { uid: 't2', name: 'products', alias: 'products' }], fields: [{ uid: 't1', col: '*', agg: 'COUNT', show: true }] }, 'cross join count');
  run({ tables: [{ uid: 't1', name: 'products', alias: 'products' }], fields: [{ uid: 't1', col: 'price', show: true, op: 'between', val: '10', val2: '20' }, { uid: 't1', col: 'name', show: true, op: 'starts', val: 'S' }], match: 'OR' }, 'OR filters');
  const cdb = dbs.company.db;
  const cschema = { tables: {} };
  for (const [name] of cdb.exec("select name from sqlite_schema where type='table'")[0].values) cschema.tables[name] = { columns: cdb.exec(`select name, type, pk from pragma_table_info('${name}')`)[0].values.map(([n, t, pk]) => ({ name: n, type: t, pk })) };
  const q = QL.buildQuery({ tables: [{ uid: 'a', name: 'employees', alias: 'employees' }, { uid: 'b', name: 'employees', alias: 'manager' }],
    joins: [{ a: { uid: 'a', col: 'manager_id' }, b: { uid: 'b', col: 'id' }, keep: 'a' }],
    fields: [{ uid: 'a', col: 'last_name', show: true }, { uid: 'b', col: 'last_name', show: true, alias: 'manager_name' }] }, cschema);
  console.log('\n--- self join\n' + q.sql); const sr = QL.runSQL(cdb, q.sql); console.log(sr.error ? sr.error.message : QL.lastRows(sr).values.slice(0, 3));

  // errors
  const ctx = { tables: Object.keys(schema.tables), columns: Object.fromEntries(Object.entries(schema.tables).map(([k, v]) => [k, v.columns.map(c => c.name)])) };
  const errs = ["select frist_name from customers", "select * from customers where city = Berlin", "select * from customer", "select id from orders join customers on orders.customer_id = customers.id",
    "select name, from products", "select name from products where count(*) > 1", "select year(order_date) from orders", "select * from products where price > 10 order by price where stock > 1",
    "selct * from products", "select name price stock from products", "select 'abc from products", "select (1 from products", "insert into categories (id, name) values (1, 'x')", "select top 5 * from products",
    "select * from products where name = 'x' and", "select customer_id, count(*) from orders having count(*) > 1 where status='x'", "select name from products having price > 1", "select left(name, 3) from products"];
  for (const s of errs) {
    const r = QL.runSQL(db, s);
    const e = QL.explainError(r.error.message, s, ctx);
    console.log(`\n[${r.error.message}] ${s}\n  ${e.title.replace(/<[^>]+>/g, '')}\n  ${e.hints.map(h => h.replace(/<[^>]+>/g, '')).join('\n  ')}${e.fixes.length ? '\n  FIX: ' + JSON.stringify(e.fixes) : ''}`);
    for (const f of e.fixes) {
      const fixed = f.removeCommaBefore ? QL.removeCommaBefore(s, f.removeCommaBefore) : QL.replaceIdent(s, f.find, f.replace);
      const r2 = QL.runSQL(db, fixed); console.log('  after fix:', fixed, '→', r2.error ? 'ERR ' + r2.error.message : 'ok');
    }
  }
  // lint
  const ident = new Set([...ctx.tables, ...Object.values(ctx.columns).flat()].map(s => s.toLowerCase()));
  for (const s of ['select * from customers where phone = NULL', 'select * from customers where city = "Berlin"', 'select * from orders join customers', 'select * from orders o join customers c on o.customer_id=c.id', 'select "first_name" from customers'])
    console.log('\nLINT', s, '=>', QL.lint(s, { identSet: ident }).map(h => h.replace(/<[^>]+>/g, '')));
  // CSV
  const csv = 'Datum;Kategorie;Beschreibung;Betrag;Bezahlt\n03.01.2026;Lebensmittel;"Markt; Bio";23,80;true\n05.01.2026;Miete;Januar;1.150,00;false\n;;;;\n07.01.2026;Kino;"Film ""X""";12,50;true\n';
  const d = QL.detectDelimiter(csv); const rows = QL.parseDelimited(csv, d);
  console.log('\nCSV delim', JSON.stringify(d), rows);
  const header = rows[0];
  header.forEach((h, i) => { const col = rows.slice(1).map(r => r[i]); const inf = QL.inferColumn(col, d); const conv = QL.converter(inf.type, inf.info); console.log(QL.sanitizeName(h), inf.type, inf.note || '', JSON.stringify(col.map(conv))); });
  console.log(QL.sanitizeName('Order Date'), QL.sanitizeName('customerID'), QL.sanitizeName('Preis (€)'), QL.sanitizeName('2024 Umsatz'), QL.sanitizeName('from'), QL.sanitizeName('Größe'));
  const csv2 = 'id,zip,price,when\n1,01234,1.5,2025-01-01T10:00:00Z\n2,10115,2,2025-01-02 11:30:00\n';
  const r2 = QL.parseDelimited(csv2, QL.detectDelimiter(csv2)); r2[0].forEach((h, i) => console.log(h, JSON.stringify(QL.inferColumn(r2.slice(1).map(r => r[i]), ','))));
  console.log(QL.jsonToTable('[{"a":1,"b":{"x":2}},{"a":2,"c":true}]'));
  console.log(QL.jsonToTable('{"data":[{"n":"x"}]}'));
  // md
  console.log(QL.md('Try **this**:\n\n```sql\nSELECT * FROM customers;\n```\n- one `code`\n- two\n\nDone *now*.', new Set(['customers'])));
  // zip
  const blob = QL.zip([{ name: 'shop.sqlite', data: dbs.shop.bytes }, { name: 'shop.sql', data: 'CREATE TABLE x(a);' }]);
  blob.arrayBuffer().then(buf => { fs.writeFileSync(require('os').tmpdir() + '/t.zip', Buffer.from(buf)); console.log('zip bytes', buf.byteLength); });
  console.log(QL.highlight("SELECT c.name, COUNT(*) FROM customers c -- hi\nWHERE x = 'a''b' AND y >= 2.5", new Set(['customers'])));
});
