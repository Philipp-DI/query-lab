/* Query Lab — sample datasets. Seeded generators, so every visitor gets identical data. */
(function (G) {
  'use strict';
  const QL = G.QL || (G.QL = {});

  // ---------- seeded random helpers ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rand(seed) {
    const r = mulberry32(seed);
    const R = {
      r,
      int: (a, b) => a + Math.floor(r() * (b - a + 1)),
      pick: arr => arr[Math.floor(r() * arr.length)],
      chance: p => r() < p,
      weighted(items) {
        let total = 0;
        for (const it of items) total += it[1];
        let x = r() * total;
        for (const it of items) { x -= it[1]; if (x < 0) return it[0]; }
        return items[items.length - 1][0];
      },
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
        return a;
      },
    };
    return R;
  }
  const DAY = 86400000;
  const toDay = s => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY);
  const fromDay = d => new Date(d * DAY).toISOString().slice(0, 10);
  const monthOf = d => new Date(d * DAY).getUTCMonth() + 1;
  const pad = n => String(n).padStart(2, '0');
  const round2 = x => Math.round(x * 100) / 100;
  const ascii = s => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/[ıİ]/g, 'i').replace(/ø/g, 'o').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  const END = toDay('2026-10-15'); // data snapshot date

  // ---------- names & places ----------
  const REGIONS = {
    de: { m: ['Lukas', 'Jonas', 'Felix', 'Paul', 'Leon', 'Noah', 'Elias', 'Ben', 'Finn', 'Tim', 'Max', 'Jan', 'Tom', 'Moritz', 'Jakob', 'Niklas', 'Stefan', 'Michael'],
          f: ['Anna', 'Sophie', 'Lea', 'Emma', 'Mia', 'Hannah', 'Lina', 'Clara', 'Marie', 'Laura', 'Julia', 'Lisa', 'Katharina', 'Greta', 'Frieda', 'Sabine', 'Johanna', 'Nele'],
          last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz', 'Braun', 'Zimmermann', 'Krüger', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Lehmann', 'Huber', 'Mayer', 'Gruber', 'Steiner', 'Keller', 'Vogel'] },
    tr: { m: ['Mehmet', 'Yusuf', 'Emre', 'Can', 'Murat'], f: ['Elif', 'Aylin', 'Zeynep', 'Deniz', 'Selin'], last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk'] },
    fr: { m: ['Hugo', 'Louis', 'Gabriel', 'Jules', 'Antoine'], f: ['Chloé', 'Inès', 'Camille', 'Léa', 'Manon'], last: ['Dubois', 'Martin', 'Bernard', 'Lefèvre', 'Moreau', 'Laurent', 'Girard', 'Roux'] },
    it: { m: ['Marco', 'Luca', 'Matteo', 'Alessandro', 'Davide'], f: ['Giulia', 'Sofia', 'Francesca', 'Chiara', 'Alessia'], last: ['Rossi', 'Russo', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Esposito', 'Greco'] },
    es: { m: ['Mateo', 'Pablo', 'Javier', 'Diego', 'Álvaro'], f: ['Lucía', 'Carmen', 'Elena', 'Marta', 'Paula'], last: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz'] },
    pt: { m: ['João', 'Pedro', 'Tiago', 'Rui'], f: ['Inês', 'Beatriz', 'Mariana', 'Ana'], last: ['Silva', 'Santos', 'Costa', 'Ferreira', 'Oliveira', 'Pereira'] },
    nl: { m: ['Daan', 'Sem', 'Bram', 'Thijs', 'Ruben'], f: ['Fleur', 'Noor', 'Lotte', 'Sanne', 'Eva'], last: ['Jansen', 'de Vries', 'Bakker', 'Visser', 'Smit', 'de Jong', 'Mulder'] },
    nordic: { m: ['Oskar', 'Emil', 'Lars', 'Nils', 'Erik'], f: ['Ingrid', 'Alva', 'Freya', 'Astrid', 'Maja'], last: ['Andersson', 'Nilsson', 'Larsen', 'Hansen', 'Johansson', 'Berg', 'Lindqvist', 'Nielsen'] },
    pl: { m: ['Jakub', 'Kacper', 'Tomasz', 'Piotr'], f: ['Zofia', 'Natalia', 'Agnieszka', 'Maja'],
          last: ['Kowalski', 'Nowak', 'Lewandowski', 'Wójcik', 'Kamiński', 'Zieliński'], lastF: ['Kowalska', 'Nowak', 'Lewandowska', 'Wójcik', 'Kamińska', 'Zielińska'] },
    cz: { m: ['Tomáš', 'Jan', 'Ondřej', 'Jiří'], f: ['Petra', 'Tereza', 'Lucie', 'Jana'],
          last: ['Novák', 'Svoboda', 'Dvořák', 'Černý', 'Procházka', 'Kučera'], lastF: ['Nováková', 'Svobodová', 'Dvořáková', 'Černá', 'Procházková', 'Kučerová'] },
    uk: { m: ['Liam', 'Oliver', 'Jack', 'Sean', 'Harry', 'George'], f: ['Olivia', 'Amelia', 'Grace', 'Aoife', 'Isla', 'Emily'], last: ['Smith', 'Jones', 'Taylor', 'Brown', "O'Brien", 'Murphy', 'Kelly', 'Walsh', 'Evans', 'Wilson'] },
  };
  // country, weight, name regions, cities (first = largest), phone prefix
  const COUNTRIES = [
    ['Germany', 40, [['de', 85], ['tr', 15]], ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Leipzig', 'Stuttgart', 'Düsseldorf', 'Dresden', 'Bremen', 'Hanover', 'Nuremberg', 'Potsdam'], '+49'],
    ['Austria', 8, [['de', 100]], ['Vienna', 'Graz', 'Linz', 'Salzburg'], '+43'],
    ['Switzerland', 6, [['de', 70], ['fr', 20], ['it', 10]], ['Zurich', 'Basel', 'Bern', 'Geneva'], '+41'],
    ['France', 7, [['fr', 100]], ['Paris', 'Lyon', 'Marseille', 'Toulouse'], '+33'],
    ['Italy', 5, [['it', 100]], ['Milan', 'Rome', 'Turin', 'Bologna'], '+39'],
    ['Spain', 5, [['es', 100]], ['Madrid', 'Barcelona', 'Valencia', 'Seville'], '+34'],
    ['Portugal', 2, [['pt', 100]], ['Lisbon', 'Porto'], '+351'],
    ['Netherlands', 6, [['nl', 100]], ['Amsterdam', 'Rotterdam', 'Utrecht'], '+31'],
    ['Sweden', 3, [['nordic', 100]], ['Stockholm', 'Gothenburg'], '+46'],
    ['Denmark', 3, [['nordic', 100]], ['Copenhagen', 'Aarhus'], '+45'],
    ['Poland', 5, [['pl', 100]], ['Warsaw', 'Kraków', 'Wrocław'], '+48'],
    ['Czechia', 3, [['cz', 100]], ['Prague', 'Brno'], '+420'],
    ['United Kingdom', 5, [['uk', 100]], ['London', 'Manchester', 'Edinburgh'], '+44'],
    ['Ireland', 2, [['uk', 100]], ['Dublin', 'Cork'], '+353'],
  ];
  const cityWeights = cities => cities.map((c, i) => [c, Math.max(1, 4 - i)]);

  function personPicker(R, used) {
    return function (regionKey) {
      const reg = REGIONS[regionKey];
      for (let tries = 0; tries < 200; tries++) {
        const female = R.chance(0.5);
        const first = R.pick(female ? reg.f : reg.m);
        const last = R.pick(female && reg.lastF ? reg.lastF : reg.last);
        const key = first + ' ' + last;
        if (!used.has(key)) { used.add(key); return { first, last, female }; }
      }
      throw new Error('name pool exhausted');
    };
  }
  function phoneFor(R, prefix) {
    if (prefix === '+49') return `+49 ${R.int(151, 179)} ${R.int(1000000, 9999999)}`;
    return `${prefix} ${R.int(600, 799)} ${R.int(100, 999)} ${R.int(100, 999)}`;
  }
  function emailFor(R, first, last, domains, usedEmails) {
    const f = ascii(first), l = ascii(last);
    const variants = [
      [`${f}.${l}`, 60], [`${f[0]}.${l}`, 22], [`${f}${R.int(70, 99)}`, 10], [`${l}.${f}`, 8],
    ];
    for (let tries = 0; tries < 50; tries++) {
      const local = R.weighted(variants);
      const email = `${local}@${R.pick(domains)}`;
      if (!usedEmails.has(email)) { usedEmails.add(email); return email; }
    }
    const email = `${f}.${l}${usedEmails.size}@${domains[0]}`;
    usedEmails.add(email);
    return email;
  }

  // =====================================================================
  // 1) ONLINE SHOP
  // =====================================================================
  function buildShop() {
    const R = rand(20261);
    const categories = [
      [1, 'Electronics'], [2, 'Books'], [3, 'Home & Kitchen'], [4, 'Sports & Outdoors'], [5, 'Clothing'],
      [6, 'Office'], [7, 'Garden'], [8, 'Toys & Games'], [9, 'Gift Cards'],
    ];
    // name, category, current price, popularity (0 = never ordered)
    const P = [
      ['Wireless Mouse', 1, 24.99, 8], ['Mechanical Keyboard', 1, 89.90, 5], ['USB-C Hub', 1, 34.50, 9], ['27" Monitor', 1, 249.00, 3],
      ['Noise-Cancelling Headphones', 1, 199.00, 4], ['Webcam 1080p', 1, 49.99, 4], ['Portable SSD 1TB', 1, 109.00, 3],
      ['Learning SQL Step by Step', 2, 34.90, 6], ['The Quiet Lighthouse', 2, 14.99, 5], ['A Short History of Bread', 2, 22.00, 3],
      ['Practical Home Repairs', 2, 27.50, 2], ['Midnight in the Archive', 2, 12.99, 4], ['The Garden Year', 2, 19.95, 0],
      ['French Press', 3, 27.50, 5], ["Chef's Knife", 3, 59.00, 4], ['Cast Iron Pan', 3, 44.95, 4], ['Electric Kettle', 3, 39.99, 6], ['Spice Rack', 3, 19.90, 0],
      ['Yoga Mat', 4, 25.00, 6], ['Dumbbell Set 2x5kg', 4, 49.00, 3], ['Running Socks (3-pack)', 4, 14.99, 7], ['Water Bottle 1L', 4, 18.50, 8], ['Resistance Bands Set', 4, 22.00, 4],
      ['Hoodie', 5, 49.95, 6], ['Rain Jacket', 5, 89.00, 3], ['Beanie', 5, 19.99, 5], ['T-Shirt Basic', 5, 15.00, 8], ['Sneakers', 5, 79.90, 4],
      ['Notebook A5', 6, 6.50, 9], ['Gel Pens (10-pack)', 6, 9.99, 7], ['Desk Lamp', 6, 34.90, 4], ['Ergonomic Chair', 6, 289.00, 2], ['Monitor Stand', 6, 39.00, 3],
      ['Watering Can', 7, 16.90, 3], ['Pruning Shears', 7, 24.50, 2], ['Plant Pot Set', 7, 21.00, 3], ['Seed Starter Kit', 7, 12.99, 0],
      ['Board Game Classic Edition', 8, 34.99, 4], ['Puzzle 1000 Pieces', 8, 17.99, 5], ['Card Game Party Pack', 8, 12.50, 4], ['Building Blocks Set', 8, 44.00, 3],
    ];
    const products = P.map((p, i) => [i + 1, p[0], p[1], p[2], R.chance(0.12) ? 0 : R.int(4, 240)]);

    // customers
    const usedNames = new Set(), usedEmails = new Set(), usedDates = new Set();
    const pickPerson = personPicker(R, usedNames);
    const customers = [];
    for (let id = 1; id <= 80; id++) {
      const c = R.weighted(COUNTRIES.map(x => [x, x[1]]));
      const p = pickPerson(R.weighted(c[2]));
      let sd;
      do { sd = R.int(toDay('2024-03-01'), toDay('2026-09-30')); } while (usedDates.has(sd));
      usedDates.add(sd);
      customers.push({
        id, first: p.first, last: p.last,
        email: emailFor(R, p.first, p.last, ['example.com', 'example.org', 'example.net', 'example.de'], usedEmails),
        phone: R.chance(0.72) ? phoneFor(R, c[4]) : null,
        city: R.weighted(cityWeights(c[3])), country: c[0], signup: sd, newsletter: R.chance(0.42) ? 1 : 0,
      });
    }
    // signup ids should follow signup order, like a real auto-increment
    customers.sort((a, b) => a.signup - b.signup).forEach((c, i) => { c.id = i + 1; });

    // orders
    const seasonal = [0, 0.8, 0.75, 0.85, 0.85, 0.9, 0.85, 0.8, 0.85, 0.95, 1.0, 1.5, 1.8];
    const raw = [];
    for (const c of customers) {
      const buyProb = c.signup > toDay('2026-08-01') ? 0.45 : 0.9;
      if (!R.chance(buyProb)) continue;
      const n = R.weighted([[1, 20], [2, 22], [3, 18], [4, 12], [5, 9], [6, 7], [8, 6], [10, 4], [13, 2]]);
      for (let k = 0; k < n; k++) {
        let d;
        for (let t = 0; t < 40; t++) {
          d = R.int(c.signup, END);
          if (R.r() * 1.8 < seasonal[monthOf(d)]) break;
        }
        raw.push({ customer: c.id, day: d });
      }
    }
    raw.sort((a, b) => a.day - b.day || a.customer - b.customer);
    const orders = [], items = [];
    const popular = P.map((p, i) => [i, p[3]]).filter(x => x[1] > 0);
    raw.forEach((o, idx) => {
      const id = idx + 1;
      const age = END - o.day;
      let status;
      if (age <= 2) status = R.weighted([['processing', 70], ['shipped', 30]]);
      else if (age <= 7) status = R.weighted([['shipped', 70], ['delivered', 25], ['processing', 5]]);
      else status = R.weighted([['delivered', 91], ['cancelled', 5], ['returned', 4]]);
      const nItems = R.weighted([[1, 45], [2, 30], [3, 17], [4, 8]]);
      const chosen = new Set();
      let subtotal = 0;
      while (chosen.size < nItems) chosen.add(R.weighted(popular));
      for (const pi of chosen) {
        const price = P[pi][2];
        const qty = price < 15 ? R.weighted([[1, 50], [2, 30], [3, 12], [5, 8]]) : R.weighted([[1, 80], [2, 16], [3, 4]]);
        const unit = o.day < toDay('2026-01-01') ? round2(price * 0.95) : price;
        subtotal += unit * qty;
        items.push([id, pi + 1, qty, unit]);
      }
      orders.push([id, o.customer, fromDay(o.day), status, subtotal >= 50 ? 0 : 4.9]);
    });

    return {
      ddl: `CREATE TABLE categories (
  id   INTEGER PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE
);
CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  price       DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE customers (
  id          INTEGER PRIMARY KEY,
  first_name  VARCHAR(50) NOT NULL,
  last_name   VARCHAR(50) NOT NULL,
  email       VARCHAR(100) NOT NULL UNIQUE,
  phone       VARCHAR(30),
  city        VARCHAR(50) NOT NULL,
  country     VARCHAR(50) NOT NULL,
  signup_date DATE NOT NULL,
  newsletter  BOOLEAN NOT NULL DEFAULT 0
);
CREATE TABLE orders (
  id            INTEGER PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  order_date    DATE NOT NULL,
  status        VARCHAR(20) NOT NULL,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0
);
CREATE TABLE order_items (
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);`,
      tables: [
        { name: 'categories', columns: ['id', 'name'], rows: categories },
        { name: 'products', columns: ['id', 'name', 'category_id', 'price', 'stock'], rows: products },
        { name: 'customers', columns: ['id', 'first_name', 'last_name', 'email', 'phone', 'city', 'country', 'signup_date', 'newsletter'],
          rows: customers.map(c => [c.id, c.first, c.last, c.email, c.phone, c.city, c.country, fromDay(c.signup), c.newsletter]) },
        { name: 'orders', columns: ['id', 'customer_id', 'order_date', 'status', 'shipping_cost'], rows: orders },
        { name: 'order_items', columns: ['order_id', 'product_id', 'quantity', 'unit_price'], rows: items },
      ],
    };
  }

  // =====================================================================
  // 2) CITY LIBRARY
  // =====================================================================
  function buildLibrary() {
    const R = rand(4242);
    const AUTHORS = [
      ['Margarete Holm', 'Germany', 1951, ['Fiction', 'History']], ['Tobias Lindqvist', 'Sweden', 1978, ['Crime']],
      ['Amara Okafor', 'Nigeria', 1985, ['Fiction']], ['Hiroshi Tanabe', 'Japan', 1962, ['Science Fiction']],
      ['Clara Vidal', 'Spain', 1990, ['Fantasy']], ['Samuel Whitlock', 'United Kingdom', 1944, ['History', 'Biography']],
      ['Ingrid Falk', 'Norway', 1969, ['Crime']], ['Marco Bellini', 'Italy', 1958, ['Cooking']],
      ['Léa Fontaine', 'France', 1987, ['Fiction', 'Children']], ['Daniel Novak', 'Czechia', 1975, ['Science Fiction']],
      ['Priya Raman', 'India', 1983, ['Science']], ['Elena Petrova', 'Bulgaria', 1972, ['Fantasy']],
      ['Jonas Brandt', 'Germany', 1980, ['Crime', 'Fiction']], ['Aisha Rahman', 'United Kingdom', 1991, ['Science']],
      ['Felix Arendt', 'Germany', 1966, ['History']], ['Sofia Marques', 'Portugal', 1977, ['Cooking']],
      ['Henrik Dahl', 'Denmark', 1960, ['Biography']], ['Mei Lin', 'Taiwan', 1988, ['Children']],
      ['Oliver Grant', 'United States', 1955, ['Science Fiction', 'Fiction']], ['Nora Castell', 'Austria', 1982, ['Fiction']],
      ['Ruth Ellery', 'Ireland', null, ['Fiction', 'Children']], ['Yusuf Demir', 'Turkey', 1979, ['Crime']],
      ['Anouk Visser', 'Netherlands', 1993, ['Fantasy', 'Children']], ['Grace Achieng', 'Kenya', null, ['Science', 'Biography']],
    ];
    const W = {
      adj: ['Silent', 'Glass', 'Hidden', 'Last', 'Burning', 'Paper', 'Northern', 'Forgotten', 'Crimson', 'Quiet', 'Hollow', 'Golden', 'Distant', 'Broken', 'Secret', 'Winter', 'Iron', 'Wild', 'Salt', 'Silver'],
      noun: ['Orchard', 'Harbor', 'Archive', 'Lighthouse', 'Garden', 'Kingdom', 'River', 'Station', 'Library', 'Map', 'Island', 'Clock', 'Forest', 'Mountain', 'House', 'Bridge', 'Machine', 'Valley', 'Lantern', 'Tide'],
      place: ['Ostend', 'Valdorf', 'Bremerhaven', 'Kilmore', 'Lake Ruhn', 'Port Ellis', 'Saint-Aubin', 'Marrow Hill', 'Old Harbor', 'Grenzdorf'],
      plural: ['Stars', 'Cells', 'Rivers', 'Maps', 'Bees', 'Clouds', 'Machines', 'Forests', 'Bridges', 'Letters', 'Volcanoes', 'Owls'],
      greek: ['Kappa', 'Sigma', 'Theta', 'Omega', 'Delta'],
      job: ['Engineer', 'Gardener', 'Cartographer', 'Midwife', 'Composer', 'Lighthouse Keeper'],
      material: ['Salt', 'Silk', 'Copper', 'Amber', 'Spice'],
    };
    const GENRES = {
      'Fiction': { t: ['The {adj} {noun}', 'The {noun} of {place}', 'Summer in {place}', 'The {noun} Keeper'], pages: [220, 480] },
      'Crime': { t: ['Death at {place}', 'The {place} Murders', 'A Body in the {noun}', 'The {adj} Witness'], pages: [260, 420] },
      'Science Fiction': { t: ['The {adj} Signal', 'Beyond the {noun}', 'Station {greek}', 'The {noun} Protocol'], pages: [280, 560] },
      'Fantasy': { t: ['The {adj} Crown', 'Daughter of the {noun}', 'The {noun} Throne', 'Song of the {adj} Sea'], pages: [340, 720] },
      'Biography': { t: ['A Life in {plural}', 'Letters from {place}', "The {job}'s Notebook"], pages: [240, 460] },
      'History': { t: ['Empires of {material}', 'The {adj} Century', 'A History of {plural}'], pages: [280, 620] },
      'Science': { t: ['How {plural} Work', 'The Hidden Life of {plural}', 'The Physics of {plural}'], pages: [200, 380] },
      'Cooking': { fixed: ['Everyday Soups', 'One-Pan Dinners', 'The Bread Book', 'Vegetarian Basics', 'Fermenting at Home', 'Weeknight Pasta', 'Coastal Kitchen', 'Sunday Baking'], pages: [140, 300] },
      'Children': { t: ['Pip and the {noun}', 'The Brave Little {noun}', 'Ten Sleepy {plural}'], pages: [24, 120] },
    };
    const usedTitles = new Set();
    const cookingQueue = R.shuffle(GENRES.Cooking.fixed);
    function title(genre) {
      if (genre === 'Cooking') return cookingQueue.pop();
      for (let i = 0; i < 100; i++) {
        const t = R.pick(GENRES[genre].t).replace(/\{(\w+)\}/g, (_, k) => R.pick(W[k]));
        if (!usedTitles.has(t)) { usedTitles.add(t); return t; }
      }
      throw new Error('titles exhausted');
    }
    function isbn() {
      const d = [9, 7, 8]; for (let i = 0; i < 9; i++) d.push(R.int(0, 9));
      const sum = d.reduce((s, x, i) => s + x * (i % 2 ? 3 : 1), 0);
      d.push((10 - sum % 10) % 10);
      return d.join('');
    }
    const authors = AUTHORS.map((a, i) => [i + 1, a[0], a[1], a[2]]);
    const books = [];
    const bookPop = [];
    AUTHORS.forEach((a, ai) => {
      const n = R.int(2, 4);
      const fame = R.weighted([[1, 3], [2, 4], [4, 2], [7, 1]]);
      for (let k = 0; k < n; k++) {
        const genre = R.pick(a[3]);
        const minYear = a[2] ? Math.max(a[2] + 24, 1972) : 1990;
        const g = GENRES[genre];
        books.push({ title: title(genre), author: ai + 1, genre, year: R.int(minYear, 2026), pages: R.int(g.pages[0], g.pages[1]), copies: R.weighted([[1, 40], [2, 35], [3, 15], [4, 10]]) });
        bookPop.push(fame * R.weighted([[0, 2], [1, 4], [2, 4], [4, 2]]));
      }
    });
    // ids in catalogue order: sort by year so ids look like acquisition order
    const order = books.map((b, i) => i).sort((x, y) => books[x].year - books[y].year || x - y);
    const bookRows = [], popByNewId = [];
    const usedIsbn = new Set();
    order.forEach((oi, idx) => {
      const b = books[oi];
      let code; do { code = isbn(); } while (usedIsbn.has(code)); usedIsbn.add(code);
      bookRows.push([idx + 1, b.title, b.author, b.genre, b.year, code, b.pages, b.copies]);
      popByNewId.push([idx + 1, bookPop[oi]]);
    });

    // members
    const used = new Set(), usedEmails = new Set();
    const pickPerson = personPicker(R, used);
    const members = [];
    for (let i = 0; i < 50; i++) {
      const p = pickPerson(R.weighted([['de', 60], ['tr', 8], ['pl', 6], ['it', 5], ['fr', 5], ['uk', 6], ['nl', 4], ['es', 6]]));
      members.push({
        first: p.first, last: p.last,
        email: emailFor(R, p.first, p.last, ['example.com', 'example.org', 'example.de'], usedEmails),
        joined: R.int(toDay('2019-01-01'), toDay('2026-09-20')),
        type: R.weighted([['standard', 60], ['student', 25], ['senior', 15]]),
        activity: R.weighted([[0, 3], [1, 8], [2, 8], [4, 5], [8, 2]]),
      });
    }
    members.sort((a, b) => a.joined - b.joined);
    const memberRows = members.map((m, i) => [i + 1, m.first, m.last, m.email, fromDay(m.joined), m.type]);

    // loans
    const rawLoans = [];
    const activeMembers = members.map((m, i) => [i, m.activity]).filter(x => x[1] > 0);
    const loanable = popByNewId.filter(x => x[1] > 0);
    for (let k = 0; k < 430; k++) {
      const mi = R.weighted(activeMembers);
      const start = Math.max(members[mi].joined, toDay('2025-01-02'));
      if (start >= END) continue;
      const day = R.int(start, END);
      rawLoans.push({ member: mi + 1, book: R.weighted(loanable), day });
    }
    rawLoans.sort((a, b) => a.day - b.day || a.member - b.member);
    const loans = rawLoans.map((l, i) => {
      const due = l.day + 28;
      let ret = null;
      const recent = END - l.day < 35;
      if (recent ? R.chance(0.45) : R.chance(0.97)) {
        const back = l.day + R.weighted([[R.int(3, 14), 40], [R.int(15, 28), 45], [R.int(29, 45), 15]]);
        ret = back <= END ? fromDay(back) : null;
      }
      return [i + 1, l.book, l.member, fromDay(l.day), fromDay(due), ret];
    });

    return {
      ddl: `CREATE TABLE authors (
  id         INTEGER PRIMARY KEY,
  name       VARCHAR(80) NOT NULL,
  country    VARCHAR(50),
  birth_year INTEGER
);
CREATE TABLE books (
  id             INTEGER PRIMARY KEY,
  title          VARCHAR(120) NOT NULL,
  author_id      INTEGER NOT NULL REFERENCES authors(id),
  genre          VARCHAR(30) NOT NULL,
  published_year INTEGER,
  isbn           CHAR(13) UNIQUE,
  pages          INTEGER,
  copies         INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE members (
  id         INTEGER PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name  VARCHAR(50) NOT NULL,
  email      VARCHAR(100) UNIQUE,
  joined_on  DATE NOT NULL,
  membership VARCHAR(10) NOT NULL CHECK (membership IN ('standard', 'student', 'senior'))
);
CREATE TABLE loans (
  id          INTEGER PRIMARY KEY,
  book_id     INTEGER NOT NULL REFERENCES books(id),
  member_id   INTEGER NOT NULL REFERENCES members(id),
  loan_date   DATE NOT NULL,
  due_date    DATE NOT NULL,
  return_date DATE
);`,
      tables: [
        { name: 'authors', columns: ['id', 'name', 'country', 'birth_year'], rows: authors },
        { name: 'books', columns: ['id', 'title', 'author_id', 'genre', 'published_year', 'isbn', 'pages', 'copies'], rows: bookRows },
        { name: 'members', columns: ['id', 'first_name', 'last_name', 'email', 'joined_on', 'membership'], rows: memberRows },
        { name: 'loans', columns: ['id', 'book_id', 'member_id', 'loan_date', 'due_date', 'return_date'], rows: loans },
      ],
    };
  }

  // =====================================================================
  // 3) COMPANY HR
  // =====================================================================
  function buildCompany() {
    const R = rand(777);
    const departments = [
      [1, 'Management', 'Berlin', 1200000], [2, 'Engineering', 'Berlin', 4800000], [3, 'Sales', 'Hamburg', 2200000],
      [4, 'Marketing', 'Hamburg', 1300000], [5, 'Finance', 'Frankfurt', 900000], [6, 'Human Resources', 'Berlin', 650000],
      [7, 'Customer Support', 'Leipzig', 1000000],
    ];
    const used = new Set(), usedEmails = new Set();
    const pickPerson = personPicker(R, used);
    const regionMix = [['de', 70], ['tr', 7], ['pl', 5], ['it', 4], ['fr', 4], ['es', 4], ['nl', 3], ['uk', 3]];
    const emps = [];
    const sal = (a, b) => Math.round(R.int(a, b) / 500) * 500;
    function hire(dept, title, salary, manager, from, to) {
      const p = pickPerson(R.weighted(regionMix));
      const e = { first: p.first, last: p.last, dept, title, salary, manager, hired: R.int(toDay(from), toDay(to)) };
      emps.push(e);
      return e;
    }
    const ceo = hire(1, 'Chief Executive Officer', 182000, null, '2014-04-01', '2014-04-01');
    hire(1, 'Executive Assistant', sal(50000, 56000), ceo, '2015-01-01', '2021-12-31');
    hire(1, 'Office Manager', sal(46000, 52000), ceo, '2016-01-01', '2023-12-31');
    const heads = {
      2: hire(2, 'Head of Engineering', sal(128000, 138000), ceo, '2014-06-01', '2016-12-31'),
      3: hire(3, 'Head of Sales', sal(112000, 124000), ceo, '2014-09-01', '2018-12-31'),
      4: hire(4, 'Head of Marketing', sal(104000, 116000), ceo, '2015-01-01', '2019-12-31'),
      5: hire(5, 'Chief Financial Officer', sal(120000, 132000), ceo, '2015-01-01', '2017-12-31'),
      6: hire(6, 'Head of HR', sal(96000, 106000), ceo, '2015-06-01', '2019-12-31'),
      7: hire(7, 'Head of Customer Support', sal(88000, 96000), ceo, '2016-01-01', '2020-12-31'),
    };
    const em1 = hire(2, 'Engineering Manager', sal(94000, 104000), heads[2], '2016-01-01', '2020-12-31');
    const em2 = hire(2, 'Engineering Manager', sal(94000, 104000), heads[2], '2017-01-01', '2022-12-31');
    const STAFF = {
      2: [['Senior Software Engineer', 78000, 92000, 5, '2016-01-01', '2023-06-30'], ['Software Engineer', 60000, 74000, 5, '2018-01-01', '2025-12-31'],
          ['Junior Software Engineer', 44000, 52000, 3, '2024-01-01', '2026-09-30'], ['QA Engineer', 52000, 64000, 2, '2018-01-01', '2025-06-30'],
          ['DevOps Engineer', 66000, 80000, 2, '2017-01-01', '2024-12-31'], ['Data Engineer', 64000, 78000, 2, '2019-01-01', '2025-12-31'],
          ['UX Designer', 55000, 70000, 2, '2019-01-01', '2026-03-31']],
      3: [['Senior Account Executive', 70000, 82000, 2, '2016-01-01', '2022-12-31'], ['Account Executive', 54000, 66000, 4, '2018-01-01', '2025-12-31'],
          ['Sales Representative', 42000, 52000, 3, '2021-01-01', '2026-08-31'], ['Sales Assistant', 36000, 42000, 1, '2023-01-01', '2026-06-30']],
      4: [['Content Manager', 50000, 60000, 2, '2018-01-01', '2025-12-31'], ['Marketing Specialist', 46000, 56000, 2, '2020-01-01', '2026-08-31'],
          ['Graphic Designer', 44000, 54000, 2, '2019-01-01', '2026-01-31'], ['SEO Specialist', 48000, 58000, 1, '2021-01-01', '2025-12-31']],
      5: [['Controller', 62000, 74000, 1, '2016-01-01', '2021-12-31'], ['Senior Accountant', 60000, 70000, 1, '2016-01-01', '2022-12-31'],
          ['Accountant', 48000, 58000, 2, '2019-01-01', '2026-03-31']],
      6: [['HR Generalist', 46000, 56000, 2, '2017-01-01', '2025-12-31'], ['Recruiter', 44000, 54000, 1, '2022-01-01', '2026-05-31'],
          ['Payroll Specialist', 45000, 52000, 1, '2018-01-01', '2024-12-31']],
      7: [['Support Team Lead', 52000, 58000, 1, '2017-01-01', '2021-12-31'], ['Senior Support Agent', 42000, 48000, 3, '2018-01-01', '2024-12-31'],
          ['Support Agent', 36000, 44000, 5, '2021-01-01', '2026-09-30']],
    };
    let supportLead = null;
    for (const dept of [2, 3, 4, 5, 6, 7]) {
      for (const [title, lo, hi, count, from, to] of STAFF[dept]) {
        for (let i = 0; i < count; i++) {
          let manager = heads[dept];
          if (dept === 2) manager = R.chance(0.5) ? em1 : em2;
          if (dept === 7 && supportLead && title !== 'Support Team Lead') manager = supportLead;
          const e = hire(dept, title, sal(lo, hi), manager, from, to);
          if (title === 'Support Team Lead') supportLead = e;
        }
      }
    }
    // ids by hire date, like a real personnel number sequence
    emps.sort((a, b) => a.hired - b.hired).forEach((e, i) => { e.id = i + 1; });
    const empRows = emps.map(e => [e.id, e.first, e.last, emailFor(R, e.first, e.last, ['company.example'], usedEmails), e.dept,
      e.manager ? e.manager.id : null, e.title, fromDay(e.hired), e.salary]);

    const PROJECTS = [
      ['Data Platform', 2, '2025-02-01', null, 420000], ['Mobile App 2.0', 2, '2025-06-15', null, 310000],
      ['Customer Portal', 2, '2024-09-01', '2025-11-30', 260000], ['Security Audit 2026', 2, '2026-03-01', '2026-06-30', 80000],
      ['Website Relaunch', 4, '2025-10-01', null, 140000], ['Spring Campaign 2026', 4, '2026-02-01', '2026-05-31', 95000],
      ['Partner Program', 3, '2025-04-01', null, 120000], ['CRM Migration', 3, '2025-01-15', '2025-12-15', 180000],
      ['Annual Report 2025', 5, '2026-01-10', '2026-04-15', 30000], ['ERP Rollout', 5, '2024-11-01', '2026-02-28', 350000],
      ['Hiring Drive 2026', 6, '2026-01-05', null, 60000], ['Support Chatbot', 7, '2025-08-01', null, 150000],
    ];
    const projects = PROJECTS.map((p, i) => [i + 1, p[0], p[1], p[2], p[3], p[4]]);
    const roleFor = t => /Designer/.test(t) ? 'Designer' : /QA/.test(t) ? 'Tester' : /Engineer/.test(t) ? 'Developer'
      : /Account|Controller|Data/.test(t) ? 'Analyst' : /Head|Chief|Manager|Lead/.test(t) ? 'Consultant' : 'Coordinator';
    const assignments = [];
    const seen = new Set();
    const add = (e, pid, role, hours) => {
      const key = e.id + ':' + pid;
      if (seen.has(key)) return;
      seen.add(key);
      assignments.push([e.id, pid, role, hours]);
    };
    projects.forEach(([pid, , dept]) => {
      const inDept = emps.filter(e => e.dept === dept && !/Chief Executive/.test(e.title));
      const lead = dept === 2 ? R.pick(emps.filter(e => /Engineering Manager|Senior Software/.test(e.title))) : heads[dept];
      add(lead, pid, 'Lead', R.int(5, 10) * 2);
      const n = dept === 2 ? R.int(5, 8) : R.int(2, 4);
      for (const e of R.shuffle(inDept).slice(0, n)) add(e, pid, roleFor(e.title), R.int(2, 12) * 2);
      const others = emps.filter(e => e.dept !== dept && e.dept !== 1);
      for (const e of R.shuffle(others).slice(0, R.int(1, 2))) add(e, pid, R.chance(0.5) ? 'Consultant' : roleFor(e.title), R.int(2, 4) * 2);
    });
    assignments.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

    return {
      ddl: `CREATE TABLE departments (
  id       INTEGER PRIMARY KEY,
  name     VARCHAR(50) NOT NULL UNIQUE,
  location VARCHAR(50) NOT NULL,
  budget   DECIMAL(12,2)
);
CREATE TABLE employees (
  id            INTEGER PRIMARY KEY,
  first_name    VARCHAR(50) NOT NULL,
  last_name     VARCHAR(50) NOT NULL,
  email         VARCHAR(100) NOT NULL UNIQUE,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  manager_id    INTEGER REFERENCES employees(id),
  job_title     VARCHAR(60) NOT NULL,
  hire_date     DATE NOT NULL,
  salary        DECIMAL(10,2) NOT NULL
);
CREATE TABLE projects (
  id            INTEGER PRIMARY KEY,
  name          VARCHAR(80) NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  start_date    DATE NOT NULL,
  end_date      DATE,
  budget        DECIMAL(12,2)
);
CREATE TABLE project_assignments (
  employee_id    INTEGER NOT NULL REFERENCES employees(id),
  project_id     INTEGER NOT NULL REFERENCES projects(id),
  role           VARCHAR(30) NOT NULL,
  hours_per_week INTEGER NOT NULL,
  PRIMARY KEY (employee_id, project_id)
);`,
      tables: [
        { name: 'departments', columns: ['id', 'name', 'location', 'budget'], rows: departments },
        { name: 'employees', columns: ['id', 'first_name', 'last_name', 'email', 'department_id', 'manager_id', 'job_title', 'hire_date', 'salary'], rows: empRows },
        { name: 'projects', columns: ['id', 'name', 'department_id', 'start_date', 'end_date', 'budget'], rows: projects },
        { name: 'project_assignments', columns: ['employee_id', 'project_id', 'role', 'hours_per_week'], rows: assignments },
      ],
    };
  }

  // =====================================================================
  // 4) MUSIC STREAMING
  // =====================================================================
  function buildMusic() {
    const R = rand(9001);
    // name, country, genre, formed, popularity
    const ARTISTS = [
      ['Velvet Static', 'United Kingdom', 'Indie Rock', 2009, 9], ['Mira Solis', 'Spain', 'Pop', 2016, 14], ['Kalt & Klar', 'Germany', 'Electronic', 2011, 7],
      ['Ochre Fields', 'Ireland', 'Folk', 2013, 4], ['DJ Larkspur', 'Netherlands', 'Electronic', 2015, 10], ['Ruby Okoro', 'Nigeria', 'Afrobeats', 2018, 12],
      ['The Night Ferries', 'Canada', 'Indie Rock', 2010, 6], ['Lumen Quartet', 'Austria', 'Classical', 2004, 2], ['Saffron Skies', 'India', 'Pop', 2019, 8],
      ['Hollow Pines', 'United States', 'Folk', 2012, 5], ['Brass Avenue', 'United States', 'Jazz', 2006, 3], ['Neon Harbor', 'Germany', 'Synthwave', 2017, 6],
      ['Cora Vale', 'United States', 'R&B', 2015, 11], ['Static Bloom', 'Australia', 'Indie Rock', 2014, 4], ['Los Faroles', 'Mexico', 'Latin', 2012, 9],
      ['Marlow & June', 'United Kingdom', 'Folk', 2018, 3], ['Iron Meridian', 'Finland', 'Metal', 2008, 5], ['Sunday Club', 'France', 'Jazz', 2011, 2],
      ['Tala Reyes', 'Philippines', 'Pop', 2020, 7], ['Polar Echo', 'Norway', 'Electronic', 2021, 1],
    ];
    const WA = ['Midnight', 'Paper', 'Golden', 'Electric', 'Silver', 'Neon', 'Velvet', 'Hollow', 'Wild', 'Quiet', 'Endless', 'Burning', 'Lucky', 'Broken', 'Summer', 'Northern', 'Crystal', 'Restless', 'Sweet', 'Distant'];
    const WN = ['Echoes', 'Moons', 'Hearts', 'Lights', 'Roads', 'Waves', 'Dreams', 'Skies', 'Rivers', 'Cities', 'Signals', 'Mirrors', 'Fires', 'Shadows', 'Gardens', 'Letters', 'Stars', 'Tides', 'Wires', 'Bells'];
    const WS = ['Hold On', 'Runaway', 'Slow Motion', 'Back to You', 'Overdrive', 'Afterglow', 'Satellite', 'Daylight', 'No Sleep', 'Home Again', 'Wildfire', 'Undertow', 'Heartbeat', 'Coastline', 'Stay', 'Gravity', 'Paper Planes', 'Long Way Down', 'Blue Hour', 'Static'];
    const usedAlbum = new Set(), usedTrack = new Set();
    const albumTitle = () => { for (;;) { const t = R.chance(0.7) ? `${R.pick(WA)} ${R.pick(WN)}` : R.pick(WN); if (!usedAlbum.has(t)) { usedAlbum.add(t); return t; } } };
    const trackTitle = () => {
      for (let i = 0; i < 200; i++) {
        const t = R.weighted([[`${R.pick(WA)} ${R.pick(WN)}`, 5], [R.pick(WS), 3], [`${R.pick(WS)} (${R.pick(WA)} Mix)`, 1]]);
        if (!usedTrack.has(t)) { usedTrack.add(t); return t; }
      }
      const t = `${R.pick(WA)} ${R.pick(WN)} ${usedTrack.size}`; usedTrack.add(t); return t;
    };
    const DUR = { 'Classical': [240, 620], 'Electronic': [200, 420], 'Jazz': [210, 480], 'Metal': [220, 400] };
    const artists = ARTISTS.map((a, i) => [i + 1, a[0], a[1], a[2], a[3]]);
    const albums = [], tracks = [], trackWeight = [];
    ARTISTS.forEach((a, ai) => {
      const nAlb = R.int(2, 3);
      for (let k = 0; k < nAlb; k++) {
        const albumId = albums.length + 1;
        albums.push([albumId, ai + 1, albumTitle(), R.int(Math.max(a[3], 2008), 2026)]);
        const nTr = R.int(7, 12);
        const albumHeat = R.weighted([[1, 3], [2, 3], [4, 1]]);
        for (let t = 1; t <= nTr; t++) {
          const d = DUR[a[2]] || [150, 290];
          tracks.push([tracks.length + 1, albumId, t, trackTitle(), R.int(d[0], d[1]), (a[2] === 'Afrobeats' || a[2] === 'R&B' || a[2] === 'Metal') && R.chance(0.25) ? 1 : (R.chance(0.04) ? 1 : 0)]);
          const single = t <= 2 ? 3 : (t <= 4 ? 1.6 : 1);
          trackWeight.push([tracks.length, a[4] * albumHeat * single * (0.4 + R.r())]);
        }
      }
    });
    // users
    const used = new Set();
    const pickPerson = personPicker(R, used);
    const usedHandles = new Set();
    const users = [];
    const UC = [['Germany', 30, 'de'], ['United Kingdom', 10, 'uk'], ['France', 8, 'fr'], ['Spain', 8, 'es'], ['Italy', 6, 'it'], ['Netherlands', 6, 'nl'], ['Poland', 5, 'pl'], ['Sweden', 5, 'nordic'], ['Austria', 5, 'de'], ['Turkey', 4, 'tr'], ['Portugal', 3, 'pt'], ['Czechia', 3, 'cz']];
    for (let i = 0; i < 120; i++) {
      const c = R.weighted(UC.map(x => [x, x[1]]));
      const p = pickPerson(c[2]);
      let handle;
      for (let t = 0; t < 50; t++) {
        const f = ascii(p.first), l = ascii(p.last);
        handle = R.weighted([[`${f}_${l[0]}`, 3], [`${f}${R.int(80, 99)}`, 3], [`${f}.${R.pick(['beats', 'sound', 'vinyl', 'waves', 'music', 'loops'])}`, 2], [`${l}${R.int(1, 9)}`, 1], [`the_${f}`, 1]]);
        if (!usedHandles.has(handle)) break;
      }
      usedHandles.add(handle);
      const plan = R.weighted([['free', 48], ['premium', 34], ['family', 12], ['student', 6]]);
      users.push({ handle, country: c[0], plan, joined: R.int(toDay('2021-01-01'), toDay('2026-09-30')), birth: R.int(1960, 2007),
        activity: (plan === 'free' ? 1 : 2.2) * R.weighted([[0.2, 3], [1, 6], [2, 4], [5, 2], [9, 1]]) });
    }
    users.sort((a, b) => a.joined - b.joined);
    const userRows = users.map((u, i) => [i + 1, u.handle, u.country, u.plan, fromDay(u.joined), u.birth]);

    // plays
    const from = toDay('2026-07-01');
    const hours = [[0, 3], [1, 2], [2, 1], [3, 1], [4, 1], [5, 1], [6, 3], [7, 7], [8, 8], [9, 5], [10, 4], [11, 4], [12, 6], [13, 6], [14, 4], [15, 4], [16, 5], [17, 8], [18, 9], [19, 9], [20, 10], [21, 10], [22, 8], [23, 5]];
    const userW = users.map((u, i) => [i, u.activity]);
    const raw = [];
    for (let k = 0; k < 6000; k++) {
      const ui = R.weighted(userW);
      const u = users[ui];
      const start = Math.max(u.joined, from);
      const day = R.int(start, END - 1);
      const trackId = R.weighted(trackWeight);
      const dur = tracks[trackId - 1][4];
      const skipped = R.chance(0.22) ? 1 : 0;
      const secs = skipped ? R.int(4, 29) : (R.chance(0.82) ? dur : R.int(30, dur));
      const ts = `${fromDay(day)} ${pad(R.weighted(hours))}:${pad(R.int(0, 59))}:${pad(R.int(0, 59))}`;
      raw.push([ui + 1, trackId, ts, secs, skipped]);
    }
    raw.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[0] - b[0]));
    const plays = raw.map((p, i) => [i + 1, p[0], p[1], p[2], p[3], p[4]]);

    return {
      ddl: `CREATE TABLE artists (
  id          INTEGER PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  country     VARCHAR(50),
  genre       VARCHAR(30),
  formed_year INTEGER
);
CREATE TABLE albums (
  id           INTEGER PRIMARY KEY,
  artist_id    INTEGER NOT NULL REFERENCES artists(id),
  title        VARCHAR(120) NOT NULL,
  release_year INTEGER
);
CREATE TABLE tracks (
  id           INTEGER PRIMARY KEY,
  album_id     INTEGER NOT NULL REFERENCES albums(id),
  track_no     INTEGER NOT NULL,
  title        VARCHAR(120) NOT NULL,
  duration_sec INTEGER NOT NULL,
  explicit     BOOLEAN NOT NULL DEFAULT 0
);
CREATE TABLE users (
  id         INTEGER PRIMARY KEY,
  username   VARCHAR(40) NOT NULL UNIQUE,
  country    VARCHAR(50),
  plan       VARCHAR(10) NOT NULL,
  joined_on  DATE NOT NULL,
  birth_year INTEGER
);
CREATE TABLE plays (
  id             INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  track_id       INTEGER NOT NULL REFERENCES tracks(id),
  played_at      DATETIME NOT NULL,
  seconds_played INTEGER NOT NULL,
  skipped        BOOLEAN NOT NULL DEFAULT 0
);`,
      tables: [
        { name: 'artists', columns: ['id', 'name', 'country', 'genre', 'formed_year'], rows: artists },
        { name: 'albums', columns: ['id', 'artist_id', 'title', 'release_year'], rows: albums },
        { name: 'tracks', columns: ['id', 'album_id', 'track_no', 'title', 'duration_sec', 'explicit'], rows: tracks },
        { name: 'users', columns: ['id', 'username', 'country', 'plan', 'joined_on', 'birth_year'], rows: userRows },
        { name: 'plays', columns: ['id', 'user_id', 'track_id', 'played_at', 'seconds_played', 'skipped'], rows: plays },
      ],
    };
  }

  // =====================================================================
  // 5) DESIGN LAB: deliberately unnormalized tables for the design lessons
  // =====================================================================
  function buildDesign() {
    const contacts = [
      [1, 'Anna Becker', 'Lindenstraße 12, 10969 Berlin', '030 6152 2210', '0151 4402 1180', null],
      [2, 'Mehmet Yılmaz', 'Hafenweg 3, 20457 Hamburg', '040 3318 9076', null, null],
      [3, 'Sophie Laurent', '41 Rue Lepic, 75018 Paris', '+33 1 4606 3312', '+33 6 1288 4471', null],
      [4, 'Jonas Weber', 'Gartenstraße 8, 04107 Leipzig', '0341 2210 4458', '0160 9912 3301', '0341 2210 4459'],
      [5, 'Clara Hoffmann', 'Am Markt 1, 01067 Dresden', null, null, null],
      [6, 'Luca Romano', 'Via Roma 22, 10121 Torino', '+39 011 562 1180', null, null],
      [7, 'Freya Nilsson', 'Storgatan 5, 11455 Stockholm', '+46 8 663 2041', '+46 70 551 2290', null],
      [8, 'Tom Fischer', 'Bahnhofstraße 17, 80335 München', '089 5501 2234', null, null],
      [9, 'Elif Kaya', 'Schillerstraße 4, 70173 Stuttgart', '0711 2263 9910', '0176 3344 5521', null],
      [10, 'Daan de Vries', 'Keizersgracht 118, 1015 CW Amsterdam', '+31 20 556 7105', null, null],
    ];
    const ordersRaw = [
      [1001, '2026-09-01', 'Jonas Weber', 'jonas.weber@example.de', 'Leipzig', '2x USB-C Hub; 1x Notebook A5', 75.50],
      [1002, '2026-09-02', 'Anna Becker', 'anna.becker@example.com', 'Berlin', '1x Mechanical Keyboard', 89.90],
      [1003, '2026-09-04', 'Sophie Laurent', 'sophie.l@example.org', 'Paris', '1x Yoga Mat; 2x Water Bottle 1L', 62.00],
      [1004, '2026-09-07', 'Jonas Weber', 'jonas.weber@example.de', 'Leipzig', '1x Desk Lamp', 34.90],
      [1005, '2026-09-09', 'Tom Fischer', 'tom.fischer@example.de', 'München', '3x Gel Pens (10-pack)', 29.97],
      [1006, '2026-09-12', 'Anna Becker', 'anna.becker@example.com', 'Berlin', '1x French Press; 1x Electric Kettle', 67.49],
      [1007, '2026-09-15', 'Jonas Weber', 'j.weber@example.de', 'Leipzig', '1x Wireless Mouse', 24.99],
      [1008, '2026-09-18', 'Elif Kaya', 'elif.kaya@example.com', 'Stuttgart', '2x T-Shirt Basic; 1x Hoodie', 79.95],
      [1009, '2026-09-21', 'Sophie Laurent', 'sophie.l@example.org', 'Paris', '1x Rain Jacket', 89.00],
      [1010, '2026-09-24', 'Tom Fischer', 'tom.fischer@example.de', 'Munich', '1x Ergonomic Chair', 289.00],
      [1011, '2026-09-28', 'Anna Becker', 'anna.becker@example.com', 'Berlin', '2x Notebook A5; 1x Monitor Stand', 52.00],
      [1012, '2026-10-02', 'Luca Romano', 'luca.romano@example.it', 'Torino', '1x Cast Iron Pan', 44.95],
    ];
    const students = { 1: 'Anna Becker', 2: 'Mehmet Yılmaz', 3: 'Sophie Laurent', 4: 'Jonas Weber', 5: 'Clara Hoffmann', 6: 'Luca Romano', 7: 'Freya Nilsson', 8: 'Tom Fischer' };
    const courses = { C101: ['SQL Basics', 'Hartmann'], C102: ['Python for Beginners', 'Demir'], C201: ['Web Design', 'Lindqvist'], C202: ['Networking', 'Hartmann'], C301: ['Project Management', 'Brandt'] };
    const enrol = [
      [1, 'C101', 88], [1, 'C102', 92], [1, 'C301', 75], [2, 'C101', 67], [2, 'C202', 81], [3, 'C102', 95], [3, 'C201', 89], [3, 'C301', 70],
      [4, 'C101', 58], [4, 'C201', 77], [4, 'C202', 84], [5, 'C201', 91], [5, 'C301', 86], [6, 'C101', 73], [6, 'C102', 64], [6, 'C202', 90],
      [7, 'C102', 82], [7, 'C201', 96], [8, 'C101', 79], [8, 'C202', 55], [8, 'C301', 88],
    ].map(([s, c, score]) => [s, students[s], c, courses[c][0], courses[c][1], score]);
    const depts = { D1: ['Sales', 2], D2: ['IT', 3], D3: ['Marketing', 4], D4: ['Finance', 1] };
    const staff = [[101, 'Lea Schulz', 'D1'], [102, 'Paul Wagner', 'D2'], [103, 'Mia Koch', 'D1'], [104, 'Ben Richter', 'D3'], [105, 'Emma Klein', 'D2'], [106, 'Noah Wolf', 'D4'],
      [107, 'Hannah Braun', 'D2'], [108, 'Elias Neumann', 'D3'], [109, 'Lina Schwarz', 'D1'], [110, 'Felix Lange', 'D4'], [111, 'Marie Krause', 'D2'], [112, 'Jakob Huber', 'D1']]
      .map(([id, n, d]) => [id, n, d, depts[d][0], depts[d][1]]);
    return {
      ddl: `CREATE TABLE contacts_raw (
  id        INTEGER PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  address   VARCHAR(200),
  phone1    VARCHAR(30),
  phone2    VARCHAR(30),
  phone3    VARCHAR(30)
);
CREATE TABLE orders_raw (
  order_no       INTEGER PRIMARY KEY,
  order_date     DATE NOT NULL,
  customer       VARCHAR(100) NOT NULL,
  customer_email VARCHAR(100),
  customer_city  VARCHAR(50),
  items          VARCHAR(300),
  total          DECIMAL(10,2)
);
CREATE TABLE enrollments (
  student_id   INTEGER NOT NULL,
  student_name VARCHAR(100) NOT NULL,
  course_id    CHAR(4) NOT NULL,
  course_title VARCHAR(100) NOT NULL,
  teacher      VARCHAR(50) NOT NULL,
  score        INTEGER,
  PRIMARY KEY (student_id, course_id)
);
CREATE TABLE staff_raw (
  emp_id     INTEGER PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  dept_id    CHAR(2) NOT NULL,
  dept_name  VARCHAR(50) NOT NULL,
  dept_floor INTEGER
);`,
      tables: [
        { name: 'contacts_raw', columns: ['id', 'full_name', 'address', 'phone1', 'phone2', 'phone3'], rows: contacts },
        { name: 'orders_raw', columns: ['order_no', 'order_date', 'customer', 'customer_email', 'customer_city', 'items', 'total'], rows: ordersRaw },
        { name: 'enrollments', columns: ['student_id', 'student_name', 'course_id', 'course_title', 'teacher', 'score'], rows: enrol },
        { name: 'staff_raw', columns: ['emp_id', 'name', 'dept_id', 'dept_name', 'dept_floor'], rows: staff },
      ],
    };
  }

  // ---------- registry ----------
  QL.DATASETS = [
    { id: 'shop', name: 'Online Shop', icon: 'cart', blurb: 'Customers, products and 21 months of orders',
      order: ['customers', 'orders', 'order_items', 'products', 'categories'], build: buildShop,
      notes: {
        customers: { _: 'People with a shop account. Ids follow sign-up order.', phone: 'Optional: NULL when no number was given', signup_date: 'Date the account was created (YYYY-MM-DD)', newsletter: '1 = subscribed, 0 = not subscribed' },
        orders: { _: 'One row per order. What was bought is in order_items.', status: 'processing, shipped, delivered, cancelled or returned', shipping_cost: 'Free (0) for orders of 50 or more, otherwise 4.90' },
        order_items: { _: 'The lines of each order: which product, how many, at what price.', unit_price: 'Price per unit when the order was placed. Prices went up about 5% in January 2026.' },
        products: { _: 'Everything the shop sells, with the current price.', stock: 'Units in the warehouse right now' },
        categories: { _: 'Product categories.' },
      } },
    { id: 'library', name: 'City Library', icon: 'book', blurb: 'Books, authors, members and loans',
      order: ['books', 'authors', 'members', 'loans'], build: buildLibrary,
      notes: {
        books: { _: 'The catalogue. Ids follow acquisition order.', isbn: '13-digit ISBN with a valid check digit', copies: 'How many copies the library owns' },
        authors: { _: 'Writers in the catalogue.', birth_year: 'NULL when unknown' },
        members: { _: 'Library card holders.', membership: 'standard, student or senior' },
        loans: { _: 'One row each time a book is borrowed. Data runs to 2026-10-15.', due_date: 'Always 28 days after loan_date', return_date: 'NULL while the book is still out' },
      } },
    { id: 'company', name: 'Company HR', icon: 'briefcase', blurb: 'Departments, staff, managers and projects',
      order: ['employees', 'departments', 'projects', 'project_assignments'], build: buildCompany,
      notes: {
        employees: { _: 'Everyone on the payroll. manager_id points to another row in this same table.', manager_id: "The employee's manager (another employees.id). NULL for the CEO.", salary: 'Gross yearly salary in EUR' },
        departments: { _: 'Departments and where they are based.', budget: 'Yearly budget in EUR' },
        projects: { _: 'Internal projects, each owned by one department.', end_date: 'NULL while the project is still running' },
        project_assignments: { _: 'Who works on which project (a many-to-many link table).', hours_per_week: 'Planned hours per week on this project' },
      } },
    { id: 'music', name: 'Music Streaming', icon: 'music', blurb: 'Artists, albums, tracks and 6,000 plays',
      order: ['plays', 'tracks', 'albums', 'artists', 'users'], build: buildMusic,
      notes: {
        plays: { _: 'Every time a user started a track, July 1 to October 14, 2026.', seconds_played: 'How long the track actually played', skipped: '1 = skipped within 30 seconds' },
        tracks: { _: 'Songs, each on one album.', duration_sec: 'Full length in seconds', explicit: '1 = explicit lyrics' },
        albums: { _: 'Albums, each by one artist.' },
        artists: { _: 'Fictional artists.' },
        users: { _: 'Listeners. All names are invented.', plan: 'free, premium, family or student' },
      } },
    { id: 'design', name: 'Design Lab', icon: 'pencil', blurb: 'Deliberately messy tables to normalize',
      order: ['orders_raw', 'contacts_raw', 'enrollments', 'staff_raw'], build: buildDesign,
      notes: {
        orders_raw: { _: 'An order export that repeats customer data in every order. Used in the anomalies lesson.', items: 'A whole list in one cell: not atomic', customer_email: 'Look closely: is it always the same for one customer?' },
        contacts_raw: { _: 'Contact list with composite values and a repeating group. Used in the 1NF lesson.', full_name: 'First and last name in one field', address: 'Street, number, postcode and city in one field', phone1: 'phone1 to phone3 form a repeating group' },
        enrollments: { _: 'Course enrollments with a composite key. Used in the 2NF lesson.', student_name: 'Depends only on student_id', course_title: 'Depends only on course_id', score: 'Depends on student_id and course_id together' },
        staff_raw: { _: 'Staff list with department data in every row. Used in the 3NF lesson.', dept_name: 'Depends on dept_id, not on the employee', dept_floor: 'Depends on dept_id, not on the employee' },
      } },
  ];
  QL._test = { rand, toDay, fromDay, ascii };
  if (typeof module !== 'undefined' && module.exports) module.exports = QL;
})(typeof window !== 'undefined' ? window : globalThis);
