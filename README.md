# Query Lab

Learn and use SQL in the browser. A real SQLite database ([sql.js](https://github.com/sql-js/sql.js)) runs entirely client-side, so there is no server and nothing to install.

## Features

- **Visual query builder**: drag tables onto a canvas; joins, filters, grouping and sorting are generated as readable SQL.
- **SQL editor**: syntax highlighting, autocomplete, and error messages that explain what went wrong, often with one-click fixes.
- **22 lessons, 73 auto-checked exercises**, with hints and model solutions:
  - Basics, summaries and joins
  - Changing data, including transactions and ACID
  - Database design: anomalies, keys and relationships, and 1NF, 2NF and 3NF (plus a note on BCNF). Design exercises are checked structurally: tables, primary keys, foreign keys, removed redundancy, and lossless joins.
  - Going further: CASE, subqueries, window functions
- **Sample databases**: Online Shop, Library, Company, Music Streaming, and Design Lab (messy tables to normalize).
- **Your own data**: import CSV, JSON, SQL or SQLite files. Imported data is kept in your browser (IndexedDB).

## Development

```sh
npm install
npm run build   # → docs/index.html (GitHub Pages) and dist/ (single-file + test page)
npm test        # core and lesson checks in Node
```

The sources live in `src/`. `build.js` concatenates them into a single self-contained HTML page. Browser tests (`test/ui*.py`) use Playwright against `dist/test.html`.

GitHub Pages serves `docs/` from the `main` branch.

## License

MIT
