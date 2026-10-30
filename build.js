// Assemble the single-file page. `node build.js` → dist/query-lab.html (+ a local test copy).
const fs = require('fs');
const path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const lib = ['data.js', 'core.js', 'lessons.js'].map(src).join('\n');
const app = ['app-base.js', 'app-schema.js', 'app-builder.js', 'app-editor.js', 'app-results.js', 'app-learn.js', 'app-import.js', 'app-claude.js', 'app-boot.js'].map(src).join('\n');
const js = `${lib}\n(function () {\n'use strict';\n${app}\n})();\n`;
if (/<\/script/i.test(js) || /<!--/.test(js)) throw new Error('JS contains a closing script tag or HTML comment');
const css = src('style.css');
const html = src('shell.html').replace('/*@@CSS@@*/', () => css).replace('/*@@JS@@*/', () => js);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'query-lab.html'), html);
fs.writeFileSync(path.join(__dirname, 'dist', 'app.js'), js);
// local test copy: same page inside a full document, engine served locally, artifact-like CSP (no eval)
const csp = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; connect-src 'none'";
const test = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${html.replace("'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-asm.js', ", "'sql-asm.js', 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-asm.js', ")}</body></html>`;
fs.writeFileSync(path.join(__dirname, 'dist', 'test.html'), test);
fs.copyFileSync(path.join(__dirname, 'node_modules/sql.js/dist/sql-asm.js'), path.join(__dirname, 'dist', 'sql-asm.js'));

// GitHub Pages: the same page as a complete standalone document → docs/index.html
const headPart = (html.match(/^(?:\s*<(?:title>[^<]*<\/title|meta[^>]*|link[^>]*)>)+/) || [''])[0];
const pages = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${headPart.trim()}
<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}[hidden]{display:none!important}</style>
</head>
<body>
${html.slice(headPart.length)}
</body>
</html>
`;
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs', 'index.html'), pages);
fs.writeFileSync(path.join(__dirname, 'docs', '.nojekyll'), '');
console.log('built', (html.length / 1024).toFixed(1) + ' KB');
