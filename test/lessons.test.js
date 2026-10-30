const { loadAll } = require('./load.js');
const QL = require('../src/core.js');
require('../src/lessons.js');
let fails = 0;
const bad = (...a) => { fails++; console.log('FAIL', ...a); };
loadAll().then(({ SQL, dbs }) => {
  let n = 0;
  for (const L of QL.LESSONS) {
    // intro examples must run
    for (const b of L.intro) if (typeof b === 'object') {
      const db = new SQL.Database(dbs[L.db].bytes);
      const r = QL.runSQL(db, b.sql); if (r.error) bad(L.id, 'example', r.error.message, b.sql);
      db.close();
    }
    for (const ex of L.exercises) {
      n++;
      const dsId = ex.db || L.db;
      if (ex.kind === 'choice') {
        const ans = [].concat(ex.answer);
        if (!ex.options || ans.some(a => a < 0 || a >= ex.options.length) || !ex.explain) bad(ex.id, 'bad choice exercise');
        console.log(ex.id.padEnd(9), 'choice', ans.join(','), '/', ex.options.length);
        continue;
      }
      const r = QL.runCheck(SQL, dbs[dsId].bytes, ex, ex.solution);
      if (r.status !== 'ok') { bad(ex.id, r.status, r.msg || (r.error && r.error.message)); continue; }
      const rows = r.expected ? r.expected.values.length : -1;
      if (!rows) bad(ex.id, 'empty expected result');
      console.log(ex.id.padEnd(9), dsId.padEnd(8), String(rows).padStart(4), 'rows', JSON.stringify(r.expected.values.slice(0, 2)).slice(0, 110));
    }
  }
  console.log('\nexercises:', n);
  // tie checks for ordered top-N
  const db = new SQL.Database(dbs.shop.bytes);
  const t = (dbx, sql) => QL.runSQL(dbx, sql).results[0].values;
  console.log('sort-1 next after 5:', t(db, 'select name, price from products order by price desc limit 7'));
  console.log('sort-3 around 10:', t(db, 'select signup_date from customers order by signup_date desc limit 11').map(r => r[0]).join(' '));
  const mdb = new SQL.Database(dbs.music.bytes);
  console.log('prac-3 top 6:', t(mdb, 'SELECT artists.name, COUNT(*) FROM plays JOIN tracks ON plays.track_id = tracks.id JOIN albums ON tracks.album_id = albums.id JOIN artists ON albums.artist_id = artists.id GROUP BY artists.id ORDER BY 2 DESC LIMIT 6'));
  console.log('prac-5 top 4:', t(mdb, "SELECT strftime('%H', played_at) h, COUNT(*) c FROM plays GROUP BY h ORDER BY c DESC LIMIT 4"));
  const cdb = new SQL.Database(dbs.company.bytes);
  console.log('win-3:', t(cdb, 'SELECT department_id, first_name, last_name, salary FROM (SELECT *, RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS r FROM employees) WHERE r = 1'));
  console.log('self-1 count:', t(cdb, "SELECT count(*) FROM employees e JOIN employees m ON e.manager_id = m.id WHERE m.job_title = 'Engineering Manager'"));
  // alternative correct answers should pass, wrong ones fail
  const find = id => { for (const L of QL.LESSONS) for (const ex of L.exercises) if (ex.id === id) return [ex, ex.db || L.db]; };
  const expect = (id, sql, want) => {
    const [ex, ds] = find(id);
    const r = QL.runCheck(SQL, dbs[ds].bytes, ex, sql);
    const ok = r.status === want;
    if (!ok) bad(id, 'expected', want, 'got', r.status, r.msg || (r.error && r.error.message), '\n   ', sql);
    else console.log('ok', id, want, (r.msg || r.note || '').slice(0, 90));
  };
  expect('select-1', 'select price, name from products', 'ok');                      // column order swapped
  expect('select-1', 'select name from products', 'fail');
  expect('select-3', 'select name, stock, stock*price from products', 'ok');
  expect('where-1', "select * from customers where city = 'berlin'", 'fail');          // case-sensitive =
  expect('where-1', "select * from customers where city like 'berlin'", 'ok');
  expect('where-1', 'select * from customers where city = Berlin', 'error');
  expect('where-3', "select first_name, last_name, country from customers where country in ('Austria','Switzerland')", 'ok');
  expect('sort-1', 'select name, price from products order by price limit 5', 'fail');
  expect('sort-1', 'select name, price from products order by price desc', 'fail');
  expect('agg-2', 'select min(price), max(price), avg(price) from products', 'ok');      // tolerance on rounding
  expect('null-2', "select first_name, last_name, ifnull(phone, 'no phone') from customers", 'ok');
  expect('join-1', 'select o.id, o.order_date, c.first_name, c.last_name from orders o join customers c on o.customer_id = c.id', 'ok');
  expect('join-3', "SELECT c.name, round(sum(oi.quantity*oi.unit_price),2) r FROM order_items oi JOIN products p ON oi.product_id=p.id JOIN categories c ON p.category_id=c.id JOIN orders o ON oi.order_id=o.id WHERE o.status NOT IN ('cancelled','returned') GROUP BY c.name ORDER BY r", 'fail');
  expect('left-1', 'select first_name, last_name from customers where id not in (select customer_id from orders)', 'ok');
  expect('left-2', 'select categories.name, count(*) from categories left join products on products.category_id = categories.id group by categories.id', 'fail');
  expect('sub-3', 'select first_name, last_name, salary from employees where salary > (select avg(salary) from employees)', 'fail');
  expect('dml-1', "insert into categories (id, name) values (42, 'Pet Supplies')", 'ok');
  expect('dml-1', "select * from categories", 'fail');
  expect('dml-2', 'update products set price = price * 1.1 where category_id = 2', 'ok');
  expect('dml-2', 'update products set price = price * 1.1', 'fail');
  expect('dml-3', 'delete from customers where not exists (select 1 from orders where orders.customer_id = customers.id)', 'ok');
  expect('ddl-1', 'create table reviews (id integer primary key, product_id integer, rating integer not null, comment text)', 'fail');
  expect('ddl-1', 'create table reviews (id integer primary key, product_id int not null, rating int not null, comment text, foreign key (product_id) references products(id))', 'ok');
  expect('ddl-2', "insert into reviews values (null, 3, 5, 'Great value')", 'ok');
  expect('ddl-3', 'alter table customers add column vip boolean default false', 'ok');
  expect('ddl-3', 'alter table customers add vip int', 'fail');
  expect('case-2', "select case when price < 20 then 'budget' when price < 100 then 'standard' else 'premium' end b, count(*) from products group by 1", 'ok');
  expect('prac-4', 'SELECT users.plan, SUM(plays.seconds_played) / 3600 FROM plays JOIN users ON plays.user_id = users.id GROUP BY users.plan', 'fail');
  expect('prac-5', "SELECT CAST(strftime('%H', played_at) AS INTEGER) AS hour, COUNT(*) AS plays FROM plays GROUP BY hour ORDER BY plays DESC LIMIT 3", 'ok');
  expect('win-2', 'select last_name, salary, round(avg(salary) over (partition by department_id), 0) from employees', 'ok');
  expect('agg-1', '', 'empty');
  // design exercises: alternative correct answers pass, typical mistakes fail with the right message
  const expectMsg = (id, sql, want, frag) => {
    const [ex, ds] = find(id);
    const r = QL.runCheck(SQL, dbs[ds].bytes, ex, sql);
    const ok = r.status === want && (!frag || String(r.msg || (r.error && r.error.message) || '').includes(frag));
    if (!ok) bad(id, 'expected', want, frag || '', 'got', r.status, r.msg || (r.error && r.error.message), '\n   ', sql);
    else console.log('ok', id, want, (r.msg || '').replace(/<[^>]+>/g, '').slice(0, 100));
  };
  expectMsg('tx-2', "UPDATE orders SET status='cancelled' WHERE id=242; UPDATE products SET stock=stock+1 WHERE id IN (6,7,25);", 'fail', 'BEGIN');
  expectMsg('tx-2', "BEGIN; UPDATE orders SET status='cancelled' WHERE id=242; UPDATE products SET stock=stock+1 WHERE id IN (6,7,25); COMMIT;", 'ok');
  expectMsg('tx-2', "BEGIN; UPDATE orders SET status='cancelled' WHERE id=242; UPDATE products SET stock=stock+1; COMMIT;", 'fail', 'stock');
  expectMsg('tx-2', "BEGIN; UPDATE orders SET status='cancelled' WHERE id=242; COMMIT;", 'fail', 'stock');
  expectMsg('tx-3', "DELETE FROM order_items; BEGIN; ROLLBACK;", 'fail', 'lost rows');
  expectMsg('tx-3', "begin transaction; delete from order_items; select count(*) from order_items; rollback;", 'ok');
  expectMsg('key-3', "CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, product_id INTEGER REFERENCES products(id));", 'fail', 'many');
  expectMsg('key-3', "CREATE TABLE Suppliers (ID integer primary key, Name varchar(80) not null); ALTER TABLE products ADD supplier_id INT REFERENCES suppliers;", 'ok');
  expectMsg('key-3', "CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT); ALTER TABLE products ADD COLUMN supplier_id INTEGER;", 'fail', 'foreign key');
  expectMsg('key-4', "CREATE TABLE wishlist (customer_id INTEGER REFERENCES customers(id), product_id INTEGER REFERENCES products(id), added_on DATE);", 'fail', 'PRIMARY KEY');
  expectMsg('key-4', "CREATE TABLE wishlist (product_id INT, customer_id INT, added_on TEXT, PRIMARY KEY (product_id, customer_id), FOREIGN KEY (customer_id) REFERENCES customers(id), FOREIGN KEY (product_id) REFERENCES products(id));", 'ok');
  expectMsg('nf1-3', "ALTER TABLE contacts_raw ADD COLUMN first_name TEXT; ALTER TABLE contacts_raw ADD COLUMN last_name TEXT;", 'fail', 'filled');
  expectMsg('nf1-3', "ALTER TABLE contacts_raw ADD first_name TEXT; ALTER TABLE contacts_raw ADD last_name TEXT; UPDATE contacts_raw SET first_name = substr(full_name, 1, instr(full_name, ' ')-1), last_name = trim(substr(full_name, instr(full_name, ' ')));", 'ok');
  expectMsg('nf1-4', "CREATE TABLE contact_phones (contact_id INTEGER REFERENCES contacts_raw(id), phone TEXT, PRIMARY KEY (contact_id, phone)); INSERT INTO contact_phones SELECT id, phone1 FROM contacts_raw UNION ALL SELECT id, phone2 FROM contacts_raw UNION ALL SELECT id, phone3 FROM contacts_raw;", 'fail', 'empty');
  expectMsg('nf1-4', "CREATE TABLE contact_phones (contact_id INTEGER REFERENCES contacts_raw(id), phone TEXT, PRIMARY KEY (contact_id, phone)); INSERT INTO contact_phones SELECT id, phone1 FROM contacts_raw WHERE phone1 IS NOT NULL;", 'fail', 'missing');
  expectMsg('nf2-2', "CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO students SELECT student_id, student_name FROM enrollments;", 'error', 'UNIQUE');
  expectMsg('nf2-2', "CREATE TABLE students (id INTEGER, name TEXT); INSERT INTO students SELECT DISTINCT student_id, student_name FROM enrollments;", 'fail', 'PRIMARY KEY');
  expectMsg('nf2-3', "CREATE TABLE courses (id TEXT PRIMARY KEY, title TEXT, teacher TEXT); INSERT INTO courses SELECT DISTINCT course_id, course_title, teacher FROM enrollments;", 'ok');
  expectMsg('nf2-4', "CREATE TABLE grades (student_id INTEGER REFERENCES students(id), course_id TEXT REFERENCES courses(id), student_name TEXT, score INTEGER, PRIMARY KEY (student_id, course_id)); INSERT INTO grades SELECT student_id, course_id, student_name, score FROM enrollments;", 'fail', 'only keep');
  expectMsg('nf2-4', "CREATE TABLE grades (course_id TEXT REFERENCES courses(id), student_id INTEGER REFERENCES students(id), score INTEGER, PRIMARY KEY (course_id, student_id)); INSERT INTO grades (course_id, student_id, score) SELECT course_id, student_id, score FROM enrollments;", 'ok');
  expectMsg('nf2-4', "CREATE TABLE grades (student_id INTEGER REFERENCES students(id), course_id TEXT REFERENCES courses(id), score INTEGER, PRIMARY KEY (student_id, course_id)); INSERT INTO grades SELECT student_id, course_id, score FROM enrollments WHERE score > 60;", 'fail', '21');
  expectMsg('nf3-3', "CREATE TABLE staff (emp_id INTEGER PRIMARY KEY, name TEXT, dept_id TEXT REFERENCES departments(id), dept_name TEXT); INSERT INTO staff SELECT emp_id, name, dept_id, dept_name FROM staff_raw;", 'fail', 'department data');
  expectMsg('nf3-3', "CREATE TABLE staff (emp_id INTEGER PRIMARY KEY, name TEXT NOT NULL, dept_id TEXT REFERENCES departments); INSERT INTO staff SELECT emp_id, name, dept_id FROM staff_raw;", 'ok');
  expectMsg('nf3-2', "", 'empty');
  // step by step: earlier statements ran on the live database, the editor holds only the last one
  const live = (id, steps, last, wantFresh, wantLive, frag) => {
    const [ex, ds] = find(id);
    const db = new SQL.Database(dbs[ds].bytes);
    db.exec('PRAGMA foreign_keys = ON');
    if (ex.setup) db.exec(ex.setup);
    for (const st of steps) { const r = QL.runSQL(db, st); if (r.error) bad(id, 'step failed', r.error.message, st); }
    const fresh = QL.runCheck(SQL, dbs[ds].bytes, ex, last);
    const before = QL.runSQL(db, "SELECT group_concat(name) FROM sqlite_schema").results[0].values[0][0];
    const lr = QL.checkLive(SQL, dbs[ds].bytes, ex, db, last);
    const after = QL.runSQL(db, "SELECT group_concat(name) FROM sqlite_schema").results[0].values[0][0];
    if (before !== after) bad(id, 'checkLive changed the database', before, after);
    const ok = fresh.status === wantFresh && lr && lr.status === wantLive && lr.live && (!frag || String(lr.msg || '').includes(frag));
    if (!ok) bad(id, 'live: expected', wantFresh, wantLive, 'got', fresh.status, lr && lr.status, lr && lr.msg);
    else console.log('ok live', id, fresh.status, '->', lr.status, (lr.msg || '').replace(/<[^>]+>/g, '').slice(0, 70));
    db.close();
  };
  const NF22c = 'CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL);';
  const NF22i = 'INSERT INTO students (id, name) SELECT DISTINCT student_id, student_name FROM enrollments;';
  live('nf2-2', [NF22c, NF22i], NF22i, 'error', 'ok');
  live('nf2-2', [NF22c], NF22i, 'error', 'ok');                          // written, not yet run
  live('nf2-2', [NF22c], 'INSERT INTO students (id, name) SELECT student_id, student_name FROM enrollments;', 'error', 'fail', 'student');
  live('nf2-2', [NF22c], 'SELECT 1;', 'fail', 'fail', 'student');          // nothing new in the editor
  { // the probe never leaves anything behind, even inside an open transaction
    const [ex, ds] = find('nf2-2');
    const db = new SQL.Database(dbs[ds].bytes);
    db.exec('BEGIN; ' + NF22c);
    const lr = QL.checkLive(SQL, dbs[ds].bytes, ex, db, NF22i);
    const n = QL.runSQL(db, 'SELECT COUNT(*) FROM students').results[0].values[0][0];
    if (!lr || lr.status !== 'ok' || n !== 0) bad('nf2-2', 'probe inside a transaction', lr && lr.status, n);
    db.exec('ROLLBACK');
    const gone = QL.runSQL(db, "SELECT COUNT(*) FROM sqlite_schema WHERE name = 'students'").results[0].values[0][0];
    if (gone !== 0) bad('nf2-2', 'outer transaction broken'); else console.log('ok live probe inside a transaction');
  }
  const NF13a = "ALTER TABLE contacts_raw ADD COLUMN first_name TEXT; ALTER TABLE contacts_raw ADD COLUMN last_name TEXT;";
  const NF13u = "UPDATE contacts_raw SET first_name = substr(full_name, 1, instr(full_name, ' ') - 1), last_name = substr(full_name, instr(full_name, ' ') + 1);";
  live('nf1-3', [NF13a, NF13u], NF13u, 'error', 'ok');
  if (QL.checkLive(SQL, dbs.shop.bytes, find('tx-2')[0], new SQL.Database(dbs.shop.bytes)) !== null) bad('tx-2', 'checkLive must skip text-checked exercises');
  // explainError: re-running a script whose CREATE already ran
  const ae = QL.explainError('table students already exists', NF22c + '\n' + NF22i, { tables: [], columns: {} });
  if (!ae.hints.some(h => /select only the statements after/i.test(h))) bad('explainError', 'missing re-run hint'); else console.log('ok explainError re-run hint');
  console.log(fails ? `\n${fails} FAILURES` : '\nall good');
});
