const { loadAll } = require('./load.js');
const q = (db, sql) => { const r = db.exec(sql); return r.length ? r[0].values : []; };
loadAll().then(({ dbs }) => {
  for (const [id, { db, ms, fkErr, bytes }] of Object.entries(dbs)) {
    const tables = q(db, "select name from sqlite_schema where type='table'").map(r => r[0]);
    console.log(`\n== ${id} (${ms} ms, ${bytes.length} bytes, fk violations: ${fkErr.length ? fkErr[0].values.length : 0})`);
    for (const t of tables) console.log('  ', t, q(db, `select count(*) from ${t}`)[0][0]);
  }
  const s = dbs.shop.db, l = dbs.library.db, c = dbs.company.db, m = dbs.music.db;
  console.log('\nshop sample customers', q(s, 'select * from customers limit 5'));
  console.log('countries', q(s, 'select country, count(*) from customers group by 1 order by 2 desc'));
  console.log('berlin', q(s, "select count(*) from customers where city='Berlin'"));
  console.log('no phone', q(s, 'select count(*) from customers where phone is null'));
  console.log('never ordered', q(s, 'select count(*) from customers where id not in (select customer_id from orders)'));
  console.log('status', q(s, 'select status, count(*) from orders group by 1'));
  console.log('orders/date range', q(s, 'select min(order_date), max(order_date) from orders'));
  console.log('dec 2025 orders', q(s, "select count(*) from orders where order_date between '2025-12-01' and '2025-12-31'"));
  console.log('never ordered products', q(s, 'select name from products where id not in (select product_id from order_items)'));
  console.log('stock0', q(s, 'select name from products where stock=0'));
  console.log('cheap in stock', q(s, 'select count(*) from products where price < 20 and stock > 0'));
  console.log('rev by cat', q(s, "select c.name, round(sum(oi.quantity*oi.unit_price),2) r from order_items oi join products p on p.id=oi.product_id join categories c on c.id=p.category_id join orders o on o.id=oi.order_id where o.status not in ('cancelled','returned') group by c.id order by r desc"));
  console.log('top signups', q(s, 'select first_name,last_name,signup_date from customers order by signup_date desc limit 12'));
  console.log('\nlibrary books sample', q(l, 'select * from books limit 4'));
  console.log('genres', q(l, 'select genre, count(*) from books group by 1'));
  console.log('never loaned', q(l, 'select count(*) from books where id not in (select book_id from loans)'));
  console.log('out now', q(l, 'select count(*) from loans where return_date is null'));
  console.log('overdue', q(l, "select count(*) from loans where return_date is null and due_date < '2026-10-15'"));
  console.log('top books', q(l, 'select b.title, count(*) n from loans join books b on b.id=loans.book_id group by b.id order by n desc limit 7'));
  console.log('members never borrowed', q(l, 'select count(*) from members where id not in (select member_id from loans)'));
  console.log('\ncompany sample', q(c, 'select * from employees limit 6'));
  console.log('per dept', q(c, 'select department_id, count(*), avg(salary) from employees group by 1'));
  console.log('hamburg', q(c, "select count(*) from employees where department_id in (select id from departments where location='Hamburg')"));
  console.log('data platform', q(c, "select e.first_name,e.last_name,pa.role from employees e join project_assignments pa on pa.employee_id=e.id join projects p on p.id=pa.project_id where p.name='Data Platform'"));
  console.log('2+ projects', q(c, 'select count(*) from (select employee_id from project_assignments group by 1 having count(*)>=2)'));
  console.log('\nmusic top artists', q(m, 'select a.name, count(*) n from plays p join tracks t on t.id=p.track_id join albums al on al.id=t.album_id join artists a on a.id=al.artist_id group by a.id order by n desc limit 7'));
  console.log('hours', q(m, "select strftime('%H', played_at) h, count(*) n from plays group by h order by n desc limit 5"));
  console.log('plan hours', q(m, 'select u.plan, round(sum(p.seconds_played)/3600.0,1) from plays p join users u on u.id=p.user_id group by u.plan'));
  console.log('users sample', q(m, 'select * from users limit 5'));
});
